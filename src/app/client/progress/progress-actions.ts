'use server'

import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const ENERGY_SCORE: Record<string, number> = {
  low: 2,
  sometimes: 4,
  normal: 7,
  high: 9,
}

export type WeightDataPoint = { week: number; w: number }

export type WeekCard = {
  week: number
  label: string
  energy: number
  sleep: number
  adherence: number
}

export type ProgressPhoto = {
  url: string
  date: string
}

export type ProgressData = {
  clientId: string
  workspaceId: string
  starting: number | null
  current: number | null
  unit: string
  weekNum: number
  goal: number | null
  weightData: WeightDataPoint[]
  weekCards: WeekCard[]
  photos: ProgressPhoto[]
}

export async function getProgressData(clientId: string): Promise<ProgressData> {
  const admin = adminClient()

  const [clientResult, checkinsResult, standaloneResult] = await Promise.all([
    admin
      .from('clients')
      .select('workspace_id, desired_weight, desired_weight_unit, onboarding_completed_at')
      .eq('id', clientId)
      .maybeSingle(),
    admin
      .from('checkins')
      .select('week_start_date, answers, submitted_at')
      .eq('client_id', clientId)
      .order('week_start_date', { ascending: true }),
    admin
      .from('progress_photos')
      .select('storage_path, uploaded_at')
      .eq('client_id', clientId),
  ])

  const checkins = checkinsResult.data ?? []
  const client = clientResult.data
  const workspaceId = client?.workspace_id ?? ''

  // Weight history
  const weightCheckins = checkins.filter(
    (c) => (c.answers as Record<string, unknown>)?.current_weight != null
  )
  const weightData: WeightDataPoint[] = weightCheckins.map((c, i) => ({
    week: i + 1,
    w: Number((c.answers as Record<string, unknown>).current_weight),
  }))

  const starting = weightData.length > 0 ? weightData[0].w : null
  const current = weightData.length > 0 ? weightData[weightData.length - 1].w : null
  const goal = client?.desired_weight != null ? Number(client.desired_weight) : null
  const unit = client?.desired_weight_unit ?? 'kg'

  // Week number from first check-in date
  const firstCheckinDate =
    checkins.length > 0 ? new Date(checkins[0].week_start_date) : null
  const startDate =
    firstCheckinDate ??
    (client?.onboarding_completed_at ? new Date(client.onboarding_completed_at) : null)
  const weekNum = startDate
    ? Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))
    : 1

  // Check-in trend cards (last 8)
  const recentCheckins = checkins.slice(-8)
  const weekCards: WeekCard[] = recentCheckins.map((c) => {
    const answers = c.answers as Record<string, unknown>
    const energyRaw = answers?.energy_level as string | undefined
    const energy = energyRaw != null ? (ENERGY_SCORE[energyRaw] ?? 5) : 5
    const sleep = answers?.sleep_quality != null ? Number(answers.sleep_quality) : 5
    const adherenceRaw =
      answers?.training_adherence != null
        ? Math.round(Number(answers.training_adherence) / 10)
        : answers?.nutrition_adherence != null
          ? Math.round(Number(answers.nutrition_adherence) / 10)
          : 5
    const adherence = Math.max(1, Math.min(10, adherenceRaw))
    const weekLabel = new Date(c.week_start_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    const weekIndex = checkins.indexOf(c) + 1
    return { week: weekIndex, label: weekLabel, energy, sleep, adherence }
  })

  // Collect all photo paths with ISO dates for sorting
  const allPhotoPaths: { path: string; dateObj: Date; dateStr: string }[] = []

  for (const c of checkins) {
    const answers = c.answers as Record<string, unknown>
    const photoPaths = answers?.progress_photo as string[] | undefined
    if (Array.isArray(photoPaths) && photoPaths.length > 0) {
      const dateObj = new Date(c.week_start_date)
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      for (const path of photoPaths) {
        allPhotoPaths.push({ path, dateObj, dateStr })
      }
    }
  }

  for (const sp of standaloneResult.data ?? []) {
    const dateObj = new Date(sp.uploaded_at)
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    allPhotoPaths.push({ path: sp.storage_path, dateObj, dateStr })
  }

  // Sort newest first, take up to 8
  allPhotoPaths.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
  const photoSlice = allPhotoPaths.slice(0, 8)

  // Generate signed URLs (bucket is private)
  const photos: ProgressPhoto[] = (
    await Promise.all(
      photoSlice.map(async ({ path, dateStr }) => {
        const { data } = await admin.storage
          .from('progress-photos')
          .createSignedUrl(path, 3600)
        if (!data?.signedUrl) return null
        return { url: data.signedUrl, date: dateStr } as ProgressPhoto
      })
    )
  ).filter((p): p is ProgressPhoto => p !== null)

  return { clientId, workspaceId, starting, current, unit, weekNum, goal, weightData, weekCards, photos }
}

export async function uploadStandalonePhoto(formData: FormData): Promise<void> {
  const file        = formData.get('file')        as File
  const clientId    = formData.get('clientId')    as string
  const workspaceId = formData.get('workspaceId') as string

  if (!file || !clientId || !workspaceId) throw new Error('Missing required fields')

  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${workspaceId}/${clientId}/${Date.now()}.${ext}`

  const admin = adminClient()
  const { data, error } = await admin.storage
    .from('progress-photos')
    .upload(path, file)

  if (error) throw new Error(error.message)

  const { error: dbError } = await admin
    .from('progress_photos')
    .insert({ workspace_id: workspaceId, client_id: clientId, storage_path: data.path })

  if (dbError) throw new Error(dbError.message)
}
