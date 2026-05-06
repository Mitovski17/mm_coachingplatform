'use server'

import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function getWeekStartISO(): string {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - daysSinceMonday)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export type RecentWorkout = {
  id: string
  name: string
  performedAt: string
  durationMinutes: number | null
}

export type HomeStats = {
  clientName: string | null
  workoutsLogged: number
  workoutsTarget: number
  caloriesAvg: number | null
  caloriesTrend: 'up' | 'down' | null
  sleepQuality: number | null
  bodyWeight: number | null
  bodyWeightTrend: 'up' | 'down' | null
  recentWorkouts: RecentWorkout[]
  coachNote: string | null
  coachNoteDate: string | null
}

export async function getHomeStats(email: string, clientId: string): Promise<HomeStats> {
  const admin = adminClient()
  const weekStart = getWeekStartISO()

  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setUTCDate(now.getUTCDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString().split('T')[0]

  const [
    clientRow,
    workoutsLoggedResult,
    activeProgramResult,
    nutritionResult,
    checkinResult,
    recentWorkoutsResult,
    coachNoteResult,
  ] = await Promise.all([
    admin.from('clients').select('name').eq('email', email).maybeSingle(),
    admin
      .from('workout_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .gte('performed_at', weekStart),
    admin
      .from('workout_programs')
      .select('id')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('nutrition_logs')
      .select('logged_date, calories')
      .eq('client_id', clientId)
      .gte('logged_date', sevenDaysAgoISO),
    admin
      .from('checkins')
      .select('answers, submitted_at')
      .eq('client_id', clientId)
      .order('submitted_at', { ascending: false })
      .limit(2),
    admin
      .from('workout_sessions')
      .select('id, name, performed_at, duration_minutes')
      .eq('client_id', clientId)
      .order('performed_at', { ascending: false })
      .limit(3),
    admin
      .from('checkins')
      .select('notes, submitted_at')
      .eq('client_id', clientId)
      .not('notes', 'is', null)
      .neq('notes', '')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const clientName = (clientRow.data as { name: string } | null)?.name ?? null
  const workoutsLogged = workoutsLoggedResult.count ?? 0

  // Workout target requires the program id from the parallel batch
  let workoutsTarget = 0
  if (activeProgramResult.data?.id) {
    const { count } = await admin
      .from('workout_program_days')
      .select('*', { count: 'exact', head: true })
      .eq('program_id', activeProgramResult.data.id)
      .not('template_id', 'is', null)
    workoutsTarget = count ?? 0
  }

  // Calories: group by day, average across days, trend = last 3 days vs prior 3 days
  let caloriesAvg: number | null = null
  let caloriesTrend: 'up' | 'down' | null = null
  const nutritionData = nutritionResult.data ?? []
  if (nutritionData.length > 0) {
    const dayTotals = new Map<string, number>()
    for (const row of nutritionData) {
      dayTotals.set(row.logged_date, (dayTotals.get(row.logged_date) ?? 0) + Number(row.calories))
    }
    const totals = Array.from(dayTotals.values())
    caloriesAvg = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)

    const sortedDates = Array.from(dayTotals.keys()).sort()
    if (sortedDates.length >= 4) {
      const recentDates = sortedDates.slice(-3)
      const olderDates = sortedDates.slice(-6, -3)
      if (recentDates.length > 0 && olderDates.length > 0) {
        const recentAvg = recentDates.reduce((s, d) => s + (dayTotals.get(d) ?? 0), 0) / recentDates.length
        const olderAvg = olderDates.reduce((s, d) => s + (dayTotals.get(d) ?? 0), 0) / olderDates.length
        caloriesTrend = recentAvg >= olderAvg ? 'up' : 'down'
      }
    }
  }

  // Check-in data: sleep quality + body weight from latest, weight trend vs previous
  let sleepQuality: number | null = null
  let bodyWeight: number | null = null
  let bodyWeightTrend: 'up' | 'down' | null = null
  const checkins = checkinResult.data ?? []
  if (checkins.length > 0) {
    const answers = checkins[0].answers as Record<string, unknown>
    sleepQuality = answers?.sleep_quality != null ? Number(answers.sleep_quality) : null
    bodyWeight = answers?.current_weight != null ? Number(answers.current_weight) : null

    if (checkins.length > 1) {
      const prevAnswers = checkins[1].answers as Record<string, unknown>
      const prevWeight = prevAnswers?.current_weight != null ? Number(prevAnswers.current_weight) : null
      if (bodyWeight !== null && prevWeight !== null) {
        bodyWeightTrend = bodyWeight > prevWeight ? 'up' : bodyWeight < prevWeight ? 'down' : null
      }
    }
  }

  const recentWorkouts: RecentWorkout[] = (recentWorkoutsResult.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    performedAt: s.performed_at,
    durationMinutes: s.duration_minutes,
  }))

  const coachNote = coachNoteResult.data?.notes ?? null
  const coachNoteDate = coachNoteResult.data?.submitted_at ?? null

  return {
    clientName,
    workoutsLogged,
    workoutsTarget,
    caloriesAvg,
    caloriesTrend,
    sleepQuality,
    bodyWeight,
    bodyWeightTrend,
    recentWorkouts,
    coachNote,
    coachNoteDate,
  }
}
