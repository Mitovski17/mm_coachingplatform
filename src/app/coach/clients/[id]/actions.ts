'use server'

import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClientProfile = {
  id: string
  name: string
  email: string
  createdAt: string
  workspaceId: string
}

export type BodyMetric = {
  id: string
  workspaceId: string
  clientId: string
  recordedDate: string
  weight: number | null
  bodyFatPct: number | null
  waistCm: number | null
  chestCm: number | null
  hipsCm: number | null
  leftArmCm: number | null
  rightArmCm: number | null
  leftThighCm: number | null
  rightThighCm: number | null
  notes: string | null
  createdAt: string
}

export type WorkoutCompliance = {
  sessionsThisWeek: number
  sessionsThisMonth: number
  targetPerWeek: number
  lastSessionDate: string | null
  totalSessions: number
}

export type WorkoutSetEntry = {
  id: string
  sessionId: string
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  setNumber: number
  reps: number | null
  weightKg: number | null
  rpe: number | null
  notes: string | null
}

export type WorkoutSession = {
  id: string
  name: string
  performedAt: string
  durationMinutes: number | null
  notes: string | null
  templateId: string | null
  setCount: number
  totalVolumeKg: number
  sets: WorkoutSetEntry[]
}

export type NutritionSummary = {
  last7DaysAvgCalories: number
  last7DaysAvgProtein: number
  last7DaysAvgCarbs: number
  last7DaysAvgFat: number
  loggingDaysThisWeek: number
  loggingDaysLast30: number
}

export type NutritionDay = {
  date: string
  totalCalories: number | null
  totalProtein: number | null
  totalCarbs: number | null
  totalFat: number | null
}

export type Checkin = {
  id: string
  submittedAt: string
  weekStartDate: string
  reviewed: boolean
  notes: string | null
  weight: number | null
  performanceRating: number | null
  nutritionAdherence: number | null
  trainingAdherence: number | null
  sleepQuality: number | null
  stressLevel: string | null
  energyLevel: string | null
  biggestWin: string | null
  biggestChallenge: string | null
  scheduleChanges: string | null
  anythingElse: string | null
  photoPaths: string[]
}

export type ProgressPhoto = {
  path: string
  url: string
  submittedAt: string
  weekStartDate: string
}

export type ClientAssignments = {
  workoutProgram: { id: string; name: string } | null
  trainingMealPlan: { id: string; name: string } | null
  restMealPlan: { id: string; name: string } | null
}

export type RedFlag = {
  type:
    | 'missed_workouts'
    | 'no_checkin'
    | 'low_performance'
    | 'low_adherence'
    | 'not_logging'
  message: string
}

export type AiDigest = {
  id: string
  weekStartDate: string
  summary: string
  wins: string[]
  concerns: string[]
  actions: string[]
  suggestedResponse: string
  ragStatus: 'red' | 'yellow' | 'green'
  createdAt: string
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function currentMondayISO(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString()
}

function startOfMonthISO(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

function daysAgoISO(n: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString()
}

function dateOnly(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ─── Generic JSON helpers ─────────────────────────────────────────────────────

function getNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key]
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function getStr(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key]
  if (v === null || v === undefined) return null
  return String(v) || null
}

// ─── Server actions ───────────────────────────────────────────────────────────

export async function getClientProfile(clientId: string): Promise<ClientProfile> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('clients')
    .select('id, full_name, email, created_at, workspace_id')
    .eq('id', clientId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Client not found')
  return {
    id: data.id,
    name: data.full_name,
    email: data.email,
    createdAt: data.created_at,
    workspaceId: data.workspace_id,
  }
}

export async function getWorkoutCompliance(
  clientId: string
): Promise<WorkoutCompliance> {
  const admin = adminClient()
  const monday = currentMondayISO()
  const monthStart = startOfMonthISO()

  const [weekRes, monthRes, totalRes, lastRes, programRes] = await Promise.all([
    admin
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .gte('performed_at', monday),
    admin
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .gte('performed_at', monthStart),
    admin
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId),
    admin
      .from('workout_sessions')
      .select('performed_at')
      .eq('client_id', clientId)
      .order('performed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('workout_programs')
      .select('id, workout_program_days(id, template_day_id)')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const programDays = (programRes.data as { id: string; workout_program_days: { id: string; template_day_id: string | null }[] } | null)?.workout_program_days ?? []
  const targetPerWeek = programDays.filter((d) => d.template_day_id !== null).length

  return {
    sessionsThisWeek: weekRes.count ?? 0,
    sessionsThisMonth: monthRes.count ?? 0,
    targetPerWeek,
    lastSessionDate: lastRes.data?.performed_at ?? null,
    totalSessions: totalRes.count ?? 0,
  }
}

export async function getWorkoutHistory(
  clientId: string
): Promise<WorkoutSession[]> {
  const admin = adminClient()
  const { data: sessions, error } = await admin
    .from('workout_sessions')
    .select('id, name, performed_at, duration_minutes, notes, template_id')
    .eq('client_id', clientId)
    .order('performed_at', { ascending: false })
    .limit(30)
  if (error || !sessions) return []
  if (sessions.length === 0) return []

  const sessionIds = sessions.map((s) => s.id)
  const { data: setsData } = await admin
    .from('workout_sets')
    .select(
      'id, session_id, exercise_id, set_number, reps, weight_kg, rpe, notes, exercises(name, muscle_group)'
    )
    .in('session_id', sessionIds)
    .order('session_id', { ascending: true })
    .order('exercise_id', { ascending: true })
    .order('set_number', { ascending: true })

  const setsBySession = new Map<string, WorkoutSetEntry[]>()
  for (const row of setsData ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    const ex = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises
    const entry: WorkoutSetEntry = {
      id: r.id,
      sessionId: r.session_id,
      exerciseId: r.exercise_id,
      exerciseName: ex?.name ?? 'Exercise',
      muscleGroup: ex?.muscle_group ?? '',
      setNumber: r.set_number,
      reps: r.reps,
      weightKg: r.weight_kg,
      rpe: r.rpe,
      notes: r.notes,
    }
    const arr = setsBySession.get(r.session_id) ?? []
    arr.push(entry)
    setsBySession.set(r.session_id, arr)
  }

  return sessions.map((s) => {
    const sets = setsBySession.get(s.id) ?? []
    const totalVolumeKg = sets.reduce(
      (sum, st) => sum + (st.weightKg ?? 0) * (st.reps ?? 0),
      0
    )
    return {
      id: s.id,
      name: s.name,
      performedAt: s.performed_at,
      durationMinutes: s.duration_minutes,
      notes: s.notes,
      templateId: s.template_id,
      setCount: sets.length,
      totalVolumeKg,
      sets,
    }
  })
}

export async function getNutritionSummary(
  clientId: string
): Promise<NutritionSummary> {
  const admin = adminClient()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setUTCDate(today.getUTCDate() - 6)
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setUTCDate(today.getUTCDate() - 29)
  const mondayStr = currentMondayISO().split('T')[0]

  const [{ data: last7 }, { data: last30 }] = await Promise.all([
    admin
      .from('nutrition_logs')
      .select('logged_date, calories, protein_g, carbs_g, fat_g')
      .eq('client_id', clientId)
      .gte('logged_date', dateOnly(sevenDaysAgo)),
    admin
      .from('nutrition_logs')
      .select('logged_date')
      .eq('client_id', clientId)
      .gte('logged_date', dateOnly(thirtyDaysAgo)),
  ])

  const dayTotals = new Map<
    string,
    { cal: number; p: number; c: number; f: number }
  >()
  for (const r of last7 ?? []) {
    const key = r.logged_date
    const cur = dayTotals.get(key) ?? { cal: 0, p: 0, c: 0, f: 0 }
    cur.cal += r.calories ?? 0
    cur.p += r.protein_g ?? 0
    cur.c += r.carbs_g ?? 0
    cur.f += r.fat_g ?? 0
    dayTotals.set(key, cur)
  }
  const days = Array.from(dayTotals.values())
  const n = Math.max(days.length, 1)
  const sum = days.reduce(
    (acc, d) => ({
      cal: acc.cal + d.cal,
      p: acc.p + d.p,
      c: acc.c + d.c,
      f: acc.f + d.f,
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  )

  const loggingDaysThisWeek = new Set(
    (last7 ?? [])
      .filter((r) => r.logged_date >= mondayStr)
      .map((r) => r.logged_date)
  ).size

  const loggingDaysLast30 = new Set((last30 ?? []).map((r) => r.logged_date)).size

  return {
    last7DaysAvgCalories: Math.round(sum.cal / n),
    last7DaysAvgProtein: Math.round(sum.p / n),
    last7DaysAvgCarbs: Math.round(sum.c / n),
    last7DaysAvgFat: Math.round(sum.f / n),
    loggingDaysThisWeek,
    loggingDaysLast30,
  }
}

export async function getNutritionHistory(
  clientId: string
): Promise<NutritionDay[]> {
  const admin = adminClient()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setUTCDate(today.getUTCDate() - 27)

  const { data } = await admin
    .from('nutrition_logs')
    .select('logged_date, calories, protein_g, carbs_g, fat_g')
    .eq('client_id', clientId)
    .gte('logged_date', dateOnly(start))

  const totals = new Map<
    string,
    { cal: number; p: number; c: number; f: number }
  >()
  for (const r of data ?? []) {
    const cur = totals.get(r.logged_date) ?? { cal: 0, p: 0, c: 0, f: 0 }
    cur.cal += r.calories ?? 0
    cur.p += r.protein_g ?? 0
    cur.c += r.carbs_g ?? 0
    cur.f += r.fat_g ?? 0
    totals.set(r.logged_date, cur)
  }

  const out: NutritionDay[] = []
  for (let i = 0; i < 28; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const key = dateOnly(d)
    const t = totals.get(key)
    out.push({
      date: key,
      totalCalories: t ? t.cal : null,
      totalProtein: t ? t.p : null,
      totalCarbs: t ? t.c : null,
      totalFat: t ? t.f : null,
    })
  }
  return out
}

export async function getCheckinHistory(clientId: string): Promise<Checkin[]> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('checkins')
    .select('id, answers, coach_notes, status, reviewed_at, week_start_date, submitted_at')
    .eq('client_id', clientId)
    .order('week_start_date', { ascending: false })
  if (error || !data) return []

  return data.map((row) => {
    const answers = (row.answers ?? {}) as Record<string, unknown>
    const photo = answers.progress_photo
    const photoPaths: string[] = Array.isArray(photo)
      ? photo.filter((p): p is string => typeof p === 'string' && p.length > 0)
      : typeof photo === 'string' && photo
        ? [photo]
        : []
    return {
      id: row.id,
      submittedAt: row.submitted_at,
      weekStartDate: row.week_start_date,
      reviewed: row.status === 'reviewed',
      notes: row.coach_notes,
      weight: getNum(answers, 'current_weight'),
      performanceRating: getNum(answers, 'performance_rating'),
      nutritionAdherence: getNum(answers, 'nutrition_adherence'),
      trainingAdherence: getNum(answers, 'training_adherence'),
      sleepQuality: getNum(answers, 'sleep_quality'),
      stressLevel: getStr(answers, 'stress_level'),
      energyLevel: getStr(answers, 'energy_level'),
      biggestWin: getStr(answers, 'biggest_win'),
      biggestChallenge: getStr(answers, 'biggest_challenge'),
      scheduleChanges: getStr(answers, 'schedule_changes'),
      anythingElse: getStr(answers, 'anything_else'),
      photoPaths,
    }
  })
}

export async function getProgressPhotos(
  clientId: string,
  checkins: Checkin[]
): Promise<ProgressPhoto[]> {
  const admin = adminClient()

  // Start standalone photos fetch immediately while we build checkin paths list
  const standalonePromise = admin
    .from('progress_photos')
    .select('storage_path, uploaded_at')
    .eq('client_id', clientId)

  const toSign: { path: string; submittedAt: string; weekStartDate: string }[] = []
  for (const ci of checkins) {
    for (const path of ci.photoPaths) {
      if (!path) continue
      toSign.push({ path, submittedAt: ci.submittedAt, weekStartDate: ci.weekStartDate })
    }
  }

  const { data: standalone } = await standalonePromise
  for (const sp of standalone ?? []) {
    toSign.push({
      path: sp.storage_path,
      submittedAt: sp.uploaded_at,
      weekStartDate: sp.uploaded_at.split('T')[0],
    })
  }

  if (toSign.length === 0) return []

  // Batch all signed-URL requests into a single round-trip instead of N parallel ones
  const { data: signedData } = await admin.storage
    .from('progress-photos')
    .createSignedUrls(toSign.map((t) => t.path), 3600)

  // Match by index — entry.path can be null in some Supabase client versions
  return toSign
    .map(({ path, submittedAt, weekStartDate }, i) => {
      const signedUrl = signedData?.[i]?.signedUrl
      if (!signedUrl) return null
      return { path, url: signedUrl, submittedAt, weekStartDate } as ProgressPhoto
    })
    .filter((p): p is ProgressPhoto => p !== null)
    .sort((a, b) => new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime())
}

export async function getLatestDigest(clientId: string): Promise<AiDigest | null> {
  const admin = adminClient()
  const { data } = await admin
    .from('ai_digests')
    .select(
      'id, week_start_date, summary, wins, concerns, actions, suggested_response, rag_status, created_at'
    )
    .eq('client_id', clientId)
    .order('week_start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    weekStartDate: data.week_start_date,
    summary: data.summary,
    wins: (data.wins as string[]) ?? [],
    concerns: (data.concerns as string[]) ?? [],
    actions: (data.actions as string[]) ?? [],
    suggestedResponse: data.suggested_response,
    ragStatus: data.rag_status as 'red' | 'yellow' | 'green',
    createdAt: data.created_at,
  }
}

// ─── Body metrics ─────────────────────────────────────────────────────────────

function mapBodyMetric(row: Record<string, unknown>): BodyMetric {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    clientId: row.client_id as string,
    recordedDate: row.recorded_date as string,
    weight: row.weight != null ? Number(row.weight) : null,
    bodyFatPct: row.body_fat_pct != null ? Number(row.body_fat_pct) : null,
    waistCm: row.waist_cm != null ? Number(row.waist_cm) : null,
    chestCm: row.chest_cm != null ? Number(row.chest_cm) : null,
    hipsCm: row.hips_cm != null ? Number(row.hips_cm) : null,
    leftArmCm: row.left_arm_cm != null ? Number(row.left_arm_cm) : null,
    rightArmCm: row.right_arm_cm != null ? Number(row.right_arm_cm) : null,
    leftThighCm: row.left_thigh_cm != null ? Number(row.left_thigh_cm) : null,
    rightThighCm: row.right_thigh_cm != null ? Number(row.right_thigh_cm) : null,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
  }
}

export async function saveBodyMetric(payload: {
  clientId: string
  workspaceId: string
  recordedDate: string
  weight?: number
  bodyFatPct?: number
  waistCm?: number
  chestCm?: number
  hipsCm?: number
  leftArmCm?: number
  rightArmCm?: number
  leftThighCm?: number
  rightThighCm?: number
  notes?: string
}): Promise<BodyMetric> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('body_metrics')
    .insert({
      client_id: payload.clientId,
      workspace_id: payload.workspaceId,
      recorded_date: payload.recordedDate,
      weight: payload.weight ?? null,
      body_fat_pct: payload.bodyFatPct ?? null,
      waist_cm: payload.waistCm ?? null,
      chest_cm: payload.chestCm ?? null,
      hips_cm: payload.hipsCm ?? null,
      left_arm_cm: payload.leftArmCm ?? null,
      right_arm_cm: payload.rightArmCm ?? null,
      left_thigh_cm: payload.leftThighCm ?? null,
      right_thigh_cm: payload.rightThighCm ?? null,
      notes: payload.notes ?? null,
    })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to save body metric')
  return mapBodyMetric(data as Record<string, unknown>)
}

export async function getBodyMetrics(clientId: string): Promise<BodyMetric[]> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('body_metrics')
    .select('*')
    .eq('client_id', clientId)
    .order('recorded_date', { ascending: false })
  if (error || !data) return []
  return data.map((r) => mapBodyMetric(r as Record<string, unknown>))
}

export async function saveCoachNotes(
  checkinId: string,
  notes: string
): Promise<void> {
  const admin = adminClient()
  await admin
    .from('checkins')
    .update({ coach_notes: notes })
    .eq('id', checkinId)
}

export async function getClientAssignments(
  clientId: string
): Promise<ClientAssignments> {
  const admin = adminClient()
  const [progRes, mealRes] = await Promise.all([
    admin
      .from('workout_programs')
      .select('id, name')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .maybeSingle(),
    admin
      .from('meal_plan_assignments')
      .select('plan_type, template_id, meal_plan_templates(id, name)')
      .eq('client_id', clientId)
      .eq('is_active', true),
  ])

  let trainingMealPlan: ClientAssignments['trainingMealPlan'] = null
  let restMealPlan: ClientAssignments['restMealPlan'] = null
  for (const a of mealRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tpl = Array.isArray((a as any).meal_plan_templates)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a as any).meal_plan_templates[0]
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a as any).meal_plan_templates
    if (!tpl) continue
    const entry = { id: tpl.id as string, name: tpl.name as string }
    if (a.plan_type === 'training') trainingMealPlan = entry
    else if (a.plan_type === 'rest') restMealPlan = entry
  }

  return {
    workoutProgram: progRes.data
      ? { id: progRes.data.id, name: progRes.data.name }
      : null,
    trainingMealPlan,
    restMealPlan,
  }
}

