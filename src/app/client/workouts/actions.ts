'use server'

import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type TodayTemplate = {
  templateId: string
  templateName: string
  exerciseCount: number
  muscleGroups: string[]
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

export async function getTodayTemplate(clientId: string): Promise<TodayTemplate | null> {
  const admin = adminClient()
  const today = getTodayDayOfWeek()

  const { data: program } = await admin
    .from('workout_programs')
    .select('id')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!program) return null

  const { data: dayRow } = await admin
    .from('workout_program_days')
    .select('template_id')
    .eq('program_id', program.id)
    .eq('day_of_week', today)
    .maybeSingle()

  if (!dayRow || !dayRow.template_id) return null

  const { data: template } = await admin
    .from('workout_templates')
    .select('id, name')
    .eq('id', dayRow.template_id)
    .maybeSingle()

  if (!template) return null

  const { data: exRows } = await admin
    .from('workout_template_exercises')
    .select('exercises(muscle_group)')
    .eq('template_id', template.id)

  const muscleSet = new Set<string>()
  let count = 0
  for (const r of exRows ?? []) {
    count += 1
    const ex = r.exercises as unknown as { muscle_group: string } | null
    if (ex?.muscle_group) muscleSet.add(ex.muscle_group)
  }

  return {
    templateId: template.id,
    templateName: template.name,
    exerciseCount: count,
    muscleGroups: Array.from(muscleSet),
  }
}

export async function getTemplateWithExercises(templateId: string): Promise<TemplateWithExercises> {
  const admin = adminClient()
  const { data: tpl, error } = await admin
    .from('workout_templates')
    .select('id, name')
    .eq('id', templateId)
    .single()
  if (error || !tpl) throw new Error(error?.message ?? 'Template not found')

  const { data: rows, error: e2 } = await admin
    .from('workout_template_exercises')
    .select('id, exercise_id, sort_order, target_sets, target_reps, rest_seconds, notes, exercises(name, muscle_group)')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true })
  if (e2) throw new Error(e2.message)

  const exercises: TemplateExercise[] = (rows ?? []).map((r) => {
    const ex = r.exercises as unknown as { name: string; muscle_group: string } | null
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

  return { id: tpl.id, name: tpl.name, exercises }
}

export async function getLastSessionForTemplate(
  clientId: string,
  templateId: string
): Promise<LastSession | null> {
  const admin = adminClient()
  const { data: session } = await admin
    .from('workout_sessions')
    .select('id, performed_at')
    .eq('client_id', clientId)
    .eq('template_id', templateId)
    .order('performed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!session) return null

  const { data: sets } = await admin
    .from('workout_sets')
    .select('exercise_id, set_number, weight_kg, reps')
    .eq('session_id', session.id)
    .order('set_number', { ascending: true })

  return {
    sessionId: session.id,
    performedAt: session.performed_at,
    sets: (sets ?? []).map((s) => ({
      exerciseId: s.exercise_id,
      setNumber: s.set_number,
      weightKg: s.weight_kg !== null ? Number(s.weight_kg) : null,
      reps: s.reps !== null ? Number(s.reps) : null,
    })),
  }
}

export async function saveWorkoutSession(payload: {
  clientId: string
  workspaceId: string
  templateId: string
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
  const admin = adminClient()

  const { data: session, error } = await admin
    .from('workout_sessions')
    .insert({
      client_id: payload.clientId,
      workspace_id: payload.workspaceId,
      template_id: payload.templateId,
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
    set_number: number
    weight_kg: number | null
    reps: number | null
  }> = []
  for (const ex of payload.exercises) {
    for (const s of ex.sets) {
      if (s.reps === null) continue
      setRows.push({
        session_id: session.id,
        exercise_id: ex.exerciseId,
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
  const admin = adminClient()
  const { data: session, error } = await admin
    .from('workout_sessions')
    .select('id, name, performed_at, duration_minutes, notes')
    .eq('id', sessionId)
    .single()
  if (error || !session) throw new Error(error?.message ?? 'Session not found')

  const { data: sets, error: e2 } = await admin
    .from('workout_sets')
    .select('exercise_id, set_number, weight_kg, reps, exercises(name, muscle_group)')
    .eq('session_id', sessionId)
    .order('set_number', { ascending: true })
  if (e2) throw new Error(e2.message)

  const byExercise = new Map<string, SessionDetailExercise>()
  for (const s of sets ?? []) {
    const ex = s.exercises as unknown as { name: string; muscle_group: string } | null
    const existing = byExercise.get(s.exercise_id)
    if (existing) {
      existing.sets.push({
        setNumber: s.set_number,
        weightKg: s.weight_kg !== null ? Number(s.weight_kg) : null,
        reps: s.reps !== null ? Number(s.reps) : null,
      })
    } else {
      byExercise.set(s.exercise_id, {
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
    exercises: Array.from(byExercise.values()),
  }
}
