'use server'

import { createClient } from '@supabase/supabase-js'
import { requireClient } from '@/lib/auth'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type TodayTemplate = {
  templateDayId: string
  templateDayLabel: string
  templateName: string
  exerciseCount: number
  muscleGroups: string[]
  exerciseNames: string[]
}

export type TemplateExercise = {
  id: string
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  targetSets: number
  targetReps: string
  restSeconds: number
  notes: string | null
}

export type TemplateWithExercises = {
  id: string
  name: string
  exercises: TemplateExercise[]
}

export type LastSetSnapshot = {
  exerciseId: string
  setNumber: number
  weightKg: number | null
  reps: number | null
}

export type LastSession = {
  sessionId: string
  performedAt: string
  sets: LastSetSnapshot[]
}

export type HistorySession = {
  id: string
  name: string
  performedAt: string
  durationMinutes: number | null
  setCount: number
  totalVolumeKg: number
}

export type SessionDetailExercise = {
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  sets: Array<{
    setNumber: number
    weightKg: number | null
    reps: number | null
  }>
}

export type SessionDetail = {
  id: string
  name: string
  performedAt: string
  durationMinutes: number | null
  notes: string | null
  workspaceId: string
  exercises: SessionDetailExercise[]
}

function getTodayDayOfWeek(): number {
  // 0 = Monday ... 6 = Sunday, using UTC
  const day = new Date().getUTCDay() // 0 = Sun ... 6 = Sat
  return day === 0 ? 6 : day - 1
}

export async function getClientId(email: string): Promise<{ id: string; workspace_id: string } | null> {
  const admin = adminClient()
  const { data } = await admin
    .from('clients')
    .select('id, workspace_id')
    .eq('email', email)
    .maybeSingle()
  return data ?? null
}

export async function hasActivePlan(clientId: string): Promise<boolean> {
  ;({ clientId } = await requireClient())
  const admin = adminClient()
  const { data } = await admin
    .from('workout_programs')
    .select('id')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  return !!data
}


export async function getTodayTemplate(clientId: string): Promise<TodayTemplate | null> {
  ;({ clientId } = await requireClient())
  const admin = adminClient()

  // Check for a date-specific override first
  const todayDate = new Date()
  const todayISO = `${todayDate.getUTCFullYear()}-${String(todayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(todayDate.getUTCDate()).padStart(2, '0')}`
  const { data: override } = await admin
    .from('date_workout_overrides')
    .select('template_day_id')
    .eq('client_id', clientId)
    .eq('assigned_date', todayISO)
    .maybeSingle()

  if (override !== undefined && override !== null) {
    if (!override.template_day_id) return null // explicit rest day override
    const { data: day } = await admin
      .from('workout_template_days')
      .select(`id, label, workout_templates(name), workout_template_exercises(exercises(name, muscle_group))`)
      .eq('id', override.template_day_id)
      .maybeSingle()
    if (!day) return null
    const tpl = day.workout_templates as unknown as { name: string } | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exRows = (day.workout_template_exercises as unknown as { exercises: any }[]) ?? []
    const muscleSet = new Set<string>()
    const names: string[] = []
    for (const r of exRows) {
      const ex = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises
      if (ex?.muscle_group) muscleSet.add(ex.muscle_group as string)
      if (ex?.name) names.push(ex.name as string)
    }
    return {
      templateDayId: day.id,
      templateDayLabel: day.label,
      templateName: tpl?.name ?? day.label,
      exerciseCount: exRows.length,
      muscleGroups: Array.from(muscleSet),
      exerciseNames: names,
    }
  }

  const today = getTodayDayOfWeek()

  // Fetch active program with all program days (includes cyclic columns)
  const { data: program } = await admin
    .from('workout_programs')
    .select('id, schedule_type, cycle_start_date, workout_program_days(template_day_id, day_of_week, cycle_position)')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!program) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pgm = program as any
  const scheduleType: string = pgm.schedule_type ?? 'weekly'
  const days = (pgm.workout_program_days as {
    template_day_id: string | null
    day_of_week: number | null
    cycle_position: number | null
  }[] | undefined) ?? []

  let templateDayId: string | null | undefined

  if (scheduleType === 'cyclic') {
    const cycleStartDate: string | null = pgm.cycle_start_date ?? null
    if (!cycleStartDate) return null

    const sorted = [...days].sort((a, b) => (a.cycle_position ?? 0) - (b.cycle_position ?? 0))
    const cycleLength = sorted.length
    if (cycleLength === 0) return null

    const startMs = new Date(cycleStartDate).getTime()
    const now = new Date()
    const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const daysElapsed = Math.floor((todayMs - startMs) / 86400000)
    if (daysElapsed < 0) return null

    const position = daysElapsed % cycleLength
    const row = sorted.find((d) => d.cycle_position === position)
    if (!row || row.template_day_id === null) return null // rest day
    templateDayId = row.template_day_id
  } else {
    templateDayId = days.find((d) => d.day_of_week === today)?.template_day_id
    if (!templateDayId) return null
  }

  // Fetch the day with its exercises and parent template name
  const { data: day } = await admin
    .from('workout_template_days')
    .select(`
      id, label,
      workout_templates(name),
      workout_template_exercises(exercises(name, muscle_group))
    `)
    .eq('id', templateDayId)
    .maybeSingle()

  if (!day) return null

  const tpl = day.workout_templates as unknown as { name: string } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exRows = (day.workout_template_exercises as unknown as { exercises: any }[]) ?? []
  const muscleSet = new Set<string>()
  const names: string[] = []
  for (const r of exRows) {
    const ex = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises
    if (ex?.muscle_group) muscleSet.add(ex.muscle_group as string)
    if (ex?.name) names.push(ex.name as string)
  }

  return {
    templateDayId: day.id,
    templateDayLabel: day.label,
    templateName: tpl?.name ?? day.label,
    exerciseCount: exRows.length,
    muscleGroups: Array.from(muscleSet),
    exerciseNames: names,
  }
}

export async function getTemplateDayWithExercises(templateDayId: string): Promise<TemplateWithExercises> {
  await requireClient()
  const admin = adminClient()
  const { data: day, error } = await admin
    .from('workout_template_days')
    .select(`
      id, label,
      workout_templates(name),
      workout_template_exercises(id, exercise_id, sort_order, target_sets, target_reps, rest_seconds, notes, exercises(name, muscle_group))
    `)
    .eq('id', templateDayId)
    .single()
  if (error || !day) throw new Error(error?.message ?? 'Template day not found')

  const tpl = day.workout_templates as unknown as { name: string } | null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((day.workout_template_exercises as unknown as any[]) ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exercises: TemplateExercise[] = rows.map((r: any) => {
    const ex = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises
    return {
      id: r.id,
      exerciseId: r.exercise_id,
      exerciseName: ex?.name ?? 'Unknown',
      muscleGroup: ex?.muscle_group ?? '',
      targetSets: r.target_sets,
      targetReps: r.target_reps,
      restSeconds: r.rest_seconds,
      notes: r.notes,
    }
  })

  return { id: day.id, name: tpl?.name ? `${tpl.name} — ${day.label}` : day.label, exercises }
}

export async function getLastSessionForTemplateDay(
  clientId: string,
  templateDayId: string
): Promise<LastSession | null> {
  ;({ clientId } = await requireClient())
  const admin = adminClient()
  const { data: session } = await admin
    .from('workout_sessions')
    .select('id, performed_at')
    .eq('client_id', clientId)
    .eq('template_day_id', templateDayId)
    .order('performed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const resolved = session ?? (await recoverOrphanedSessions(clientId, templateDayId))
  if (!resolved) return null

  const { data: sets } = await admin
    .from('workout_sets')
    .select('exercise_id, set_number, weight_kg, reps')
    .eq('session_id', resolved.id)
    .order('set_number', { ascending: true })

  return {
    sessionId: resolved.id,
    performedAt: resolved.performed_at,
    sets: (sets ?? []).map((s) => ({
      exerciseId: s.exercise_id,
      setNumber: s.set_number,
      weightKg: s.weight_kg !== null ? Number(s.weight_kg) : null,
      reps: s.reps !== null ? Number(s.reps) : null,
    })),
  }
}

/**
 * Re-attaches history that lost its template_day_id.
 *
 * Saving a workout template used to delete and re-create its days, and
 * workout_sessions.template_day_id is ON DELETE SET NULL — so sessions logged
 * before a template edit were cut loose and the client stopped seeing any
 * previous weights. The template day's name is still on the session, so match
 * on that, write the id back, and return the most recent one.
 */
async function recoverOrphanedSessions(
  clientId: string,
  templateDayId: string
): Promise<{ id: string; performed_at: string } | null> {
  const admin = adminClient()
  const { data: day } = await admin
    .from('workout_template_days')
    .select('label, workout_templates(name)')
    .eq('id', templateDayId)
    .maybeSingle()
  if (!day) return null

  const tpl = day.workout_templates as unknown as { name: string } | null
  // Mirrors the name getTemplateDayWithExercises builds and the session stores.
  const sessionName = tpl?.name ? `${tpl.name} — ${day.label}` : day.label

  const { data: orphans } = await admin
    .from('workout_sessions')
    .select('id, performed_at')
    .eq('client_id', clientId)
    .is('template_day_id', null)
    .eq('name', sessionName)
    .order('performed_at', { ascending: false })
  if (!orphans || orphans.length === 0) return null

  await admin
    .from('workout_sessions')
    .update({ template_day_id: templateDayId })
    .in('id', orphans.map((s) => s.id))

  return orphans[0]
}

export type ProgramWorkoutDay = {
  templateDayId: string
  label: string
  templateName: string
  exerciseCount: number
  muscleGroups: string[]
}

export async function getProgramWorkoutDays(clientId: string): Promise<ProgramWorkoutDay[]> {
  ;({ clientId } = await requireClient())
  const admin = adminClient()

  const { data: program } = await admin
    .from('workout_programs')
    .select('id, workout_program_days(template_day_id)')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!program) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const days = (program.workout_program_days as any[] ?? [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dayIds = days.map((d: any) => d.template_day_id).filter(Boolean)
  if (dayIds.length === 0) return []

  const { data: dayRows } = await admin
    .from('workout_template_days')
    .select(`
      id, label,
      workout_templates(name),
      workout_template_exercises(exercises(muscle_group))
    `)
    .in('id', dayIds)

  return (dayRows ?? []).map((d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = d.workout_templates as unknown as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exRows = (d.workout_template_exercises as unknown as any[]) ?? []
    const muscleSet = new Set<string>()
    for (const r of exRows) {
      const ex = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises
      if (ex?.muscle_group) muscleSet.add(ex.muscle_group)
    }
    return {
      templateDayId: d.id,
      label: d.label,
      templateName: t?.name ?? '',
      exerciseCount: exRows.length,
      muscleGroups: Array.from(muscleSet),
    }
  })
}

export type LibraryExercise = {
  id: string
  name: string
  muscleGroup: string
  equipment: string
}

export async function getExerciseLibraryForClient(workspaceId: string): Promise<LibraryExercise[]> {
  ;({ workspaceId } = await requireClient())
  const admin = adminClient()
  const { data, error } = await admin
    .from('exercises')
    .select('id, name, muscle_group, equipment')
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    .order('muscle_group', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((e) => ({
    id: e.id, name: e.name,
    muscleGroup: e.muscle_group, equipment: e.equipment,
  }))
}

export async function saveWorkoutSession(payload: {
  clientId: string
  workspaceId: string
  templateDayId: string | null
  templateName: string
  notes: string
  durationMinutes: number
  performedAt: string
  exercises: Array<{
    exerciseId: string
    sets: Array<{
      setNumber: number
      weightKg: number | null
      reps: number | null
    }>
  }>
}): Promise<{ sessionId: string }> {
  const ctx = await requireClient()
  payload.clientId = ctx.clientId
  payload.workspaceId = ctx.workspaceId
  const admin = adminClient()

  const { data: session, error } = await admin
    .from('workout_sessions')
    .insert({
      client_id: payload.clientId,
      workspace_id: payload.workspaceId,
      template_day_id: payload.templateDayId,
      name: payload.templateName,
      notes: payload.notes ? payload.notes : null,
      duration_minutes: payload.durationMinutes,
      performed_at: payload.performedAt,
    })
    .select('id')
    .single()
  if (error || !session) throw new Error(error?.message ?? 'Failed to create session')

  const setRows: Array<{
    session_id: string
    exercise_id: string
    exercise_order: number
    set_number: number
    weight_kg: number | null
    reps: number | null
  }> = []
  for (const [index, ex] of payload.exercises.entries()) {
    for (const s of ex.sets) {
      if (s.reps === null) continue
      setRows.push({
        session_id: session.id,
        exercise_id: ex.exerciseId,
        exercise_order: index,
        set_number: s.setNumber,
        weight_kg: s.weightKg,
        reps: s.reps,
      })
    }
  }

  if (setRows.length > 0) {
    const { error: setErr } = await admin.from('workout_sets').insert(setRows)
    if (setErr) throw new Error(setErr.message)
  }

  return { sessionId: session.id }
}

export async function getWorkoutHistory(clientId: string): Promise<HistorySession[]> {
  ;({ clientId } = await requireClient())
  const admin = adminClient()
  const { data: sessions, error } = await admin
    .from('workout_sessions')
    .select('id, name, performed_at, duration_minutes')
    .eq('client_id', clientId)
    .order('performed_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)

  const ids = (sessions ?? []).map((s) => s.id)
  const statsByMap = new Map<string, { setCount: number; totalVolumeKg: number }>()
  if (ids.length > 0) {
    const { data: sets } = await admin
      .from('workout_sets')
      .select('session_id, weight_kg, reps')
      .in('session_id', ids)
    for (const s of sets ?? []) {
      const cur = statsByMap.get(s.session_id) ?? { setCount: 0, totalVolumeKg: 0 }
      cur.setCount += 1
      const w = s.weight_kg !== null ? Number(s.weight_kg) : 0
      const r = s.reps !== null ? Number(s.reps) : 0
      cur.totalVolumeKg += w * r
      statsByMap.set(s.session_id, cur)
    }
  }

  return (sessions ?? []).map((s) => {
    const stats = statsByMap.get(s.id) ?? { setCount: 0, totalVolumeKg: 0 }
    return {
      id: s.id,
      name: s.name,
      performedAt: s.performed_at,
      durationMinutes: s.duration_minutes,
      setCount: stats.setCount,
      totalVolumeKg: stats.totalVolumeKg,
    }
  })
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  const { clientId } = await requireClient()
  const admin = adminClient()
  const { data: session, error } = await admin
    .from('workout_sessions')
    .select('id, name, performed_at, duration_minutes, notes, workspace_id')
    .eq('id', sessionId)
    .eq('client_id', clientId)
    .single()
  if (error || !session) throw new Error(error?.message ?? 'Session not found')

  const { data: sets, error: e2 } = await admin
    .from('workout_sets')
    .select('exercise_id, exercise_order, set_number, weight_kg, reps, exercises(name, muscle_group)')
    .eq('session_id', sessionId)
    .order('exercise_order', { ascending: true })
    .order('set_number', { ascending: true })
  if (e2) throw new Error(e2.message)

  // Key by compound (exercise_id + exercise_order) so the same exercise appearing
  // at two different positions stays as separate entries, and ordering is preserved.
  const byPosition = new Map<string, SessionDetailExercise>()
  for (const s of sets ?? []) {
    const ex = s.exercises as unknown as { name: string; muscle_group: string } | null
    const key = `${s.exercise_id}|${s.exercise_order}`
    const existing = byPosition.get(key)
    if (existing) {
      existing.sets.push({
        setNumber: s.set_number,
        weightKg: s.weight_kg !== null ? Number(s.weight_kg) : null,
        reps: s.reps !== null ? Number(s.reps) : null,
      })
    } else {
      byPosition.set(key, {
        exerciseId: s.exercise_id,
        exerciseName: ex?.name ?? 'Unknown',
        muscleGroup: ex?.muscle_group ?? '',
        sets: [
          {
            setNumber: s.set_number,
            weightKg: s.weight_kg !== null ? Number(s.weight_kg) : null,
            reps: s.reps !== null ? Number(s.reps) : null,
          },
        ],
      })
    }
  }

  return {
    id: session.id,
    name: session.name,
    performedAt: session.performed_at,
    durationMinutes: session.duration_minutes,
    notes: session.notes,
    workspaceId: (session as any).workspace_id ?? '',
    exercises: Array.from(byPosition.values()),
  }
}

export async function updateWorkoutSession(
  sessionId: string,
  payload: {
    name: string
    notes: string | null
    durationMinutes: number | null
    exercises: Array<{
      exerciseId: string
      sets: Array<{ setNumber: number; weightKg: number | null; reps: number | null }>
    }>
  }
): Promise<void> {
  const { clientId } = await requireClient()
  const admin = adminClient()

  // Verify the session belongs to the caller before mutating it or its sets.
  const { data: owned } = await admin
    .from('workout_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('client_id', clientId)
    .maybeSingle()
  if (!owned) throw new Error('Session not found')

  // Update the session row
  const { error: sessErr } = await admin
    .from('workout_sessions')
    .update({
      name: payload.name,
      notes: payload.notes,
      duration_minutes: payload.durationMinutes,
    })
    .eq('id', sessionId)
    .eq('client_id', clientId)
  if (sessErr) throw new Error(sessErr.message)

  // Delete existing sets and reinsert
  const { error: delErr } = await admin
    .from('workout_sets')
    .delete()
    .eq('session_id', sessionId)
  if (delErr) throw new Error(delErr.message)

  const setRows: object[] = []
  for (const [index, ex] of payload.exercises.entries()) {
    for (const s of ex.sets) {
      setRows.push({
        session_id: sessionId,
        exercise_id: ex.exerciseId,
        exercise_order: index,
        set_number: s.setNumber,
        weight_kg: s.weightKg,
        reps: s.reps,
      })
    }
  }
  if (setRows.length > 0) {
    const { error: insErr } = await admin.from('workout_sets').insert(setRows)
    if (insErr) throw new Error(insErr.message)
  }
}

export async function createExerciseForWorkspace(
  workspaceId: string,
  name: string,
  muscleGroup: string,
  equipment: string,
): Promise<LibraryExercise> {
  ;({ workspaceId } = await requireClient())
  const admin = adminClient()
  const { data, error } = await admin
    .from('exercises')
    .insert({ name, muscle_group: muscleGroup, equipment, workspace_id: workspaceId })
    .select('id, name, muscle_group, equipment')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create exercise')
  return {
    id: data.id,
    name: data.name,
    muscleGroup: data.muscle_group,
    equipment: data.equipment,
  }
}
