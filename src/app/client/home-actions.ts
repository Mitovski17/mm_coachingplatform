'use server'

import { createClient } from '@supabase/supabase-js'
import { getSundayStart } from '@/lib/checkin-window'
import { requireClient } from '@/lib/auth'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
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
  checkinSubmittedThisWeek: boolean
  onboardingComplete: boolean
}

export async function getHomeStats(email: string, clientId: string): Promise<HomeStats> {
  // Bind to the session's own client — ignore caller-supplied email/clientId.
  const ctx = await requireClient()
  email = ctx.email
  clientId = ctx.clientId
  const admin = adminClient()
  const weekStart = getSundayStart()

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
    checkinThisWeekResult,
  ] = await Promise.all([
    admin.from('clients').select('full_name, onboarding_completed_at').eq('email', email).maybeSingle(),
    admin
      .from('workout_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .gte('performed_at', weekStart),
    admin
      .from('workout_programs')
      .select('id, workout_program_days(id, template_day_id)')
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
      .select('coach_notes, submitted_at')
      .eq('client_id', clientId)
      .not('coach_notes', 'is', null)
      .neq('coach_notes', '')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('checkins')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('week_start_date', weekStart),
  ])

  const clientName = (clientRow.data as { full_name: string; onboarding_completed_at: string | null } | null)?.full_name ?? null
  // Fail open on query errors — only report "not onboarded" when the row was
  // actually read and says so, otherwise a transient failure kicks the client
  // back to the onboarding wizard mid-session.
  const onboardingComplete = clientRow.error
    ? true
    : !!(clientRow.data as { onboarding_completed_at: string | null } | null)?.onboarding_completed_at
  const workoutsLogged = workoutsLoggedResult.count ?? 0

  const programDays = (activeProgramResult.data as { id: string; workout_program_days: { id: string; template_day_id: string | null }[] } | null)?.workout_program_days ?? []
  const workoutsTarget = programDays.filter((d) => d.template_day_id !== null).length

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

  const coachNote = coachNoteResult.data?.coach_notes ?? null
  const coachNoteDate = coachNoteResult.data?.submitted_at ?? null
  const checkinSubmittedThisWeek = (checkinThisWeekResult.count ?? 0) > 0

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
    checkinSubmittedThisWeek,
    onboardingComplete,
  }
}
