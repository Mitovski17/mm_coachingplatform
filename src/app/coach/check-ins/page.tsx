export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import CheckInsClient from './CheckInsClient'

export type CheckinCard = {
  clientId: string
  clientName: string
  checkinId: string
  status: 'pending' | 'reviewed'
  submittedAt: string | null
  reviewedAt: string | null
  coachNotes: string | null
  answers: Record<string, unknown>
  prevAnswers: Record<string, unknown> | null
  signedPhotoUrls: string[]
}

function weekBounds(): { currentWeek: string; prevWeek: string } {
  // Check-in windows open on Sundays - match that boundary here.
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun...6=Sat
  const sunday = new Date(now)
  sunday.setUTCDate(now.getUTCDate() - day)
  sunday.setUTCHours(0, 0, 0, 0)
  const prevSunday = new Date(sunday)
  prevSunday.setUTCDate(sunday.getUTCDate() - 7)
  return {
    currentWeek: sunday.toISOString().split('T')[0],
    prevWeek: prevSunday.toISOString().split('T')[0],
  }
}

async function fetchData(): Promise<CheckinCard[]> {
  const { currentWeek, prevWeek } = weekBounds()

  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const rawMockEmail = cookieStore.get('dev_mock_email')?.value

    if (rawMockEmail) {
      const mockEmail = decodeURIComponent(rawMockEmail)
      const svc = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: { users } } = await svc.auth.admin.listUsers({ perPage: 1000 })
      const adminUser = users.find((u) => u.email === mockEmail)
      if (!adminUser) redirect('/login')

      const { data: profile } = await svc
        .from('profiles').select('workspace_id').eq('id', adminUser.id).single()
      if (!profile) redirect('/login')

      return buildCards(svc, profile.workspace_id, currentWeek, prevWeek)
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('workspace_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buildCards(supabase as any, profile.workspace_id, currentWeek, prevWeek)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildCards(svc: any, workspaceId: string, currentWeek: string, prevWeek: string): Promise<CheckinCard[]> {
  // Always use service role for storage signed-URL generation (private bucket)
  const storageSvc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [clientsRes, currentRes, prevRes] = await Promise.all([
    svc.from('clients').select('id, full_name').eq('workspace_id', workspaceId),
    svc
      .from('checkins')
      .select('id, client_id, status, answers, coach_notes, submitted_at, reviewed_at')
      .eq('workspace_id', workspaceId)
      .eq('week_start_date', currentWeek)
      .order('submitted_at', { ascending: false }),
    svc
      .from('checkins')
      .select('id, client_id, answers')
      .eq('workspace_id', workspaceId)
      .eq('week_start_date', prevWeek),
  ])

  const clients: { id: string; full_name: string }[] = clientsRes.data ?? []
  const currentCheckins: {
    id: string; client_id: string; status: string; answers: Record<string, unknown>;
    coach_notes: string | null; submitted_at: string; reviewed_at: string | null
  }[] = currentRes.data ?? []
  const prevCheckins: { id: string; client_id: string; answers: Record<string, unknown> }[] = prevRes.data ?? []

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]))
  const prevMap = new Map(prevCheckins.map((ci) => [ci.client_id, ci.answers]))

  // Collect all photo paths to batch-generate signed URLs
  const allPhotoPaths: string[] = []
  for (const ci of currentCheckins) {
    const photo = ci.answers?.progress_photo
    const photos: string[] = Array.isArray(photo)
      ? photo.filter((p): p is string => typeof p === 'string' && p.length > 0)
      : typeof photo === 'string' && photo ? [photo] : []
    allPhotoPaths.push(...photos)
  }

  // Use service client so the private bucket allows signed URL creation
  const signedUrlMap = new Map<string, string>()
  if (allPhotoPaths.length > 0) {
    const { data: signedData } = await storageSvc.storage
      .from('progress-photos')
      .createSignedUrls(allPhotoPaths, 3600)
    ;(signedData ?? []).forEach((item) => {
      if (item.path && item.signedUrl) signedUrlMap.set(item.path, item.signedUrl)
    })
  }

  const cards: CheckinCard[] = []
  const seen = new Set<string>()
  for (const ci of currentCheckins) {
    if (seen.has(ci.client_id)) continue
    seen.add(ci.client_id)
    const photo = ci.answers?.progress_photo
    const photoPaths: string[] = Array.isArray(photo)
      ? photo.filter((p): p is string => typeof p === 'string' && p.length > 0)
      : typeof photo === 'string' && photo ? [photo] : []
    cards.push({
      clientId: ci.client_id,
      clientName: clientMap.get(ci.client_id) ?? 'Unknown client',
      checkinId: ci.id,
      status: ci.status as 'pending' | 'reviewed',
      submittedAt: ci.submitted_at,
      reviewedAt: ci.reviewed_at,
      coachNotes: ci.coach_notes,
      answers: ci.answers,
      prevAnswers: prevMap.get(ci.client_id) ?? null,
      signedPhotoUrls: photoPaths.map(p => signedUrlMap.get(p) ?? '').filter(Boolean),
    })
  }

  return cards
}

export default async function CheckInsPage() {
  const cards = await fetchData()
  return <CheckInsClient cards={cards} />
}
