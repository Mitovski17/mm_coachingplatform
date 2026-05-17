'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache, revalidateTag } from 'next/cache'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type Template = {
  id: string
  name: string
  notes: string | null
  exerciseCount: number
  createdAt: string
}

export type ExerciseSetRow = {
  id?: string
  setNumber: number
  targetReps: number
  targetWeight?: string | null
  rpe?: string | null
  notes?: string | null
}

export type TemplateExerciseRow = {
  id: string
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  sortOrder: number
  targetSets: number
  targetReps: string
  restSeconds: number
  notes: string | null
  sets: ExerciseSetRow[]
}

export type TemplateWithExercises = {
  id: string
  name: string
  notes: string | null
  workspaceId: string
  exercises: TemplateExerciseRow[]
}

export type Client = {
  id: string
  name: string
  email: string
}

export type Exercise = {
  id: string
  name: string
  muscleGroup: string
  equipment: string
  imageUrl?: string | null
  description?: string | null
  workspaceId?: string | null
}

export type ProgramDayPreview = {
  dayOfWeek: number
  templateName: string | null
}

export type Program = {
  id: string
  name: string
  isActive: boolean
  clientId: string
  clientName: string
  dayCount: number
  days: ProgramDayPreview[]
  createdAt: string
}

export type ProgramDay = {
  dayOfWeek: number
  templateId: string | null
  templateName: string | null
}

export type ProgramWithDays = {
  id: string
  name: string
  isActive: boolean
  clientId: string
  workspaceId: string
  days: ProgramDay[]
}

export async function getWorkspaceIdForCoach(email: string): Promise<string | null> {
  const admin = adminClient()
  const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) throw new Error(listErr.message)
  const user = users.users.find((u) => u.email === email)
  if (!user) return null
  const { data: profile, error } = await admin
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .single()
  if (error || !profile) return null
  return profile.workspace_id
}

export async function getAllExercises(): Promise<Exercise[]> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('exercises')
    .select('id, name, muscle_group, equipment')
    .order('muscle_group', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscle_group,
    equipment: e.equipment,
  }))
}

export async function getAllExercisesForWorkspace(workspaceId: string): Promise<Exercise[]> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('exercises')
    .select('id, name, muscle_group, equipment, image_url, description, workspace_id')
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    .order('muscle_group', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscle_group,
    equipment: e.equipment,
    imageUrl: e.image_url ?? null,
    description: e.description ?? null,
    workspaceId: e.workspace_id ?? null,
  }))
}

export async function updateCustomExercise(
  exerciseId: string,
  workspaceId: string,
  payload: { name: string; muscleGroup: string; equipment: string; description?: string }
): Promise<void> {
  const admin = adminClient()
  const { error } = await admin
    .from('exercises')
    .update({
      name: payload.name,
      muscle_group: payload.muscleGroup,
      equipment: payload.equipment,
      description: payload.description ?? null,
    })
    .eq('id', exerciseId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
  revalidateTag('programs', 'max')
}

export async function deleteCustomExercise(
  exerciseId: string,
  workspaceId: string
): Promise<void> {
  const admin = adminClient()
  const { error } = await admin
    .from('exercises')
    .delete()
    .eq('id', exerciseId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
  revalidateTag('programs', 'max')
}

const _getTemplatesCached = unstable_cache(
  async (workspaceId: string): Promise<Template[]> => {
    const admin = adminClient()
    const { data: templates, error } = await admin
      .from('workout_templates')
      .select('id, name, notes, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    const ids = (templates ?? []).map((t) => t.id)
    let countsByTemplate = new Map<string, number>()
    if (ids.length > 0) {
      const { data: rows, error: e2 } = await admin
        .from('workout_template_exercises')
        .select('template_id')
        .in('template_id', ids)
      if (e2) throw new Error(e2.message)
      countsByTemplate = (rows ?? []).reduce((acc, r) => {
        acc.set(r.template_id, (acc.get(r.template_id) ?? 0) + 1)
        return acc
      }, new Map<string, number>())
    }

    return (templates ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      notes: t.notes,
      exerciseCount: countsByTemplate.get(t.id) ?? 0,
      createdAt: t.created_at,
    }))
  },
  ['programs-getTemplates'],
  { tags: ['programs'], revalidate: 60 }
)

export async function getTemplates(workspaceId: string): Promise<Template[]> {
  return _getTemplatesCached(workspaceId)
}

export async function getTemplate(templateId: string): Promise<TemplateWithExercises | null> {
  const admin = adminClient()
  const { data: template, error } = await admin
    .from('workout_templates')
    .select('id, name, notes, workspace_id')
    .eq('id', templateId)
    .single()
  if (error || !template) return null

  const { data: rows, error: e2 } = await admin
    .from('workout_template_exercises')
    .select('id, exercise_id, sort_order, target_sets, target_reps, rest_seconds, notes, exercises(name, muscle_group)')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true })
  if (e2) throw new Error(e2.message)

  const exerciseIds = (rows ?? []).map((r) => r.id)
  let setsByExercise = new Map<string, ExerciseSetRow[]>()
  if (exerciseIds.length > 0) {
    const { data: setRows, error: e3 } = await admin
      .from('workout_template_exercise_sets')
      .select('id, template_exercise_id, set_number, target_reps, target_weight, rpe, notes')
      .in('template_exercise_id', exerciseIds)
      .order('set_number', { ascending: true })
    if (e3) throw new Error(e3.message)
    for (const s of setRows ?? []) {
      const list = setsByExercise.get(s.template_exercise_id) ?? []
      list.push({
        id: s.id,
        setNumber: s.set_number,
        targetReps: s.target_reps,
        targetWeight: s.target_weight ?? null,
        rpe: s.rpe ?? null,
        notes: s.notes ?? null,
      })
      setsByExercise.set(s.template_exercise_id, list)
    }
  }

  const exercises: TemplateExerciseRow[] = (rows ?? []).map((r) => {
    const ex = r.exercises as unknown as { name: string; muscle_group: string } | null
    const savedSets = setsByExercise.get(r.id)
    const sets: ExerciseSetRow[] = savedSets && savedSets.length > 0
      ? savedSets
      : Array.from({ length: r.target_sets }, (_, i) => ({
          setNumber: i + 1,
          targetReps: Number(r.target_reps) || 10,
        }))
    return {
      id: r.id,
      exerciseId: r.exercise_id,
      exerciseName: ex?.name ?? 'Unknown',
      muscleGroup: ex?.muscle_group ?? '',
      sortOrder: r.sort_order,
      targetSets: r.target_sets,
      targetReps: r.target_reps,
      restSeconds: r.rest_seconds,
      notes: r.notes,
      sets,
    }
  })

  return {
    id: template.id,
    name: template.name,
    notes: template.notes,
    workspaceId: template.workspace_id,
    exercises,
  }
}

export async function upsertTemplate(payload: {
  id?: string
  workspaceId: string
  name: string
  notes?: string
  exercises: Array<{
    id?: string
    exerciseId: string
    sortOrder: number
    restSeconds: number
    notes?: string
    sets: Array<{
      setNumber: number
      targetReps: number
      targetWeight?: string
      rpe?: string
      notes?: string
    }>
  }>
}): Promise<{ id: string }> {
  const admin = adminClient()

  let templateId = payload.id ?? null

  if (templateId) {
    const { error } = await admin
      .from('workout_templates')
      .update({
        name: payload.name,
        notes: payload.notes ?? null,
      })
      .eq('id', templateId)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await admin
      .from('workout_templates')
      .insert({
        workspace_id: payload.workspaceId,
        name: payload.name,
        notes: payload.notes ?? null,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Failed to create template')
    templateId = data.id
  }

  // Replace all exercises (cascade deletes sets too)
  const { error: delErr } = await admin
    .from('workout_template_exercises')
    .delete()
    .eq('template_id', templateId)
  if (delErr) throw new Error(delErr.message)

  if (payload.exercises.length > 0) {
    const insertRows = payload.exercises.map((ex) => ({
      template_id: templateId!,
      exercise_id: ex.exerciseId,
      sort_order: ex.sortOrder,
      target_sets: ex.sets.length,
      target_reps: String(ex.sets[0]?.targetReps ?? 10),
      rest_seconds: ex.restSeconds,
      notes: ex.notes ?? null,
    }))
    const { data: insertedExercises, error: insErr } = await admin
      .from('workout_template_exercises')
      .insert(insertRows)
      .select('id')
    if (insErr || !insertedExercises) throw new Error(insErr?.message ?? 'Failed to insert exercises')

    const setInserts = payload.exercises.flatMap((ex, idx) =>
      ex.sets.map((s) => ({
        template_exercise_id: insertedExercises[idx].id,
        set_number: s.setNumber,
        target_reps: s.targetReps,
        target_weight: s.targetWeight || null,
        rpe: s.rpe || null,
        notes: s.notes || null,
      }))
    )
    if (setInserts.length > 0) {
      const { error: setsErr } = await admin
        .from('workout_template_exercise_sets')
        .insert(setInserts)
      if (setsErr) throw new Error(setsErr.message)
    }
  }

  revalidateTag('programs', 'max')
  return { id: templateId! }
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const admin = adminClient()
  const { error } = await admin.from('workout_templates').delete().eq('id', templateId)
  if (error) throw new Error(error.message)
  revalidateTag('programs', 'max')
}

export async function getClients(workspaceId: string): Promise<Client[]> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('clients')
    .select('id, full_name, email')
    .eq('workspace_id', workspaceId)
    .order('full_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.full_name,
    email: c.email,
  }))
}

const _getProgramsCached = unstable_cache(
  async (workspaceId: string): Promise<Program[]> => {
    const admin = adminClient()
    const { data: programs, error } = await admin
      .from('workout_programs')
      .select('id, name, is_active, client_id, created_at, clients(full_name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    const ids = (programs ?? []).map((p) => p.id)
    const daysByProgram = new Map<string, ProgramDayPreview[]>()
    if (ids.length > 0) {
      const { data: dayRows, error: e2 } = await admin
        .from('workout_program_days')
        .select('program_id, day_of_week, workout_templates(name)')
        .in('program_id', ids)
      if (e2) throw new Error(e2.message)
      for (const r of dayRows ?? []) {
        const t = r.workout_templates as unknown as { name: string } | null
        const list = daysByProgram.get(r.program_id) ?? []
        list.push({ dayOfWeek: r.day_of_week, templateName: t?.name ?? null })
        daysByProgram.set(r.program_id, list)
      }
    }

    return (programs ?? []).map((p) => {
      const c = p.clients as unknown as { full_name: string } | null
      const programDays = daysByProgram.get(p.id) ?? []
      return {
        id: p.id,
        name: p.name,
        isActive: p.is_active,
        clientId: p.client_id,
        clientName: c?.full_name ?? 'Unknown client',
        dayCount: programDays.length,
        days: programDays,
        createdAt: p.created_at,
      }
    })
  },
  ['programs-getPrograms'],
  { tags: ['programs'], revalidate: 60 }
)

export async function getPrograms(workspaceId: string): Promise<Program[]> {
  return _getProgramsCached(workspaceId)
}

export async function getProgram(programId: string): Promise<ProgramWithDays | null> {
  const admin = adminClient()
  const { data: program, error } = await admin
    .from('workout_programs')
    .select('id, name, is_active, client_id, workspace_id')
    .eq('id', programId)
    .single()
  if (error || !program) return null

  const { data: dayRows, error: e2 } = await admin
    .from('workout_program_days')
    .select('day_of_week, template_id, workout_templates(name)')
    .eq('program_id', programId)
  if (e2) throw new Error(e2.message)

  const byDay = new Map<number, { templateId: string | null; templateName: string | null }>()
  for (const row of dayRows ?? []) {
    const t = row.workout_templates as unknown as { name: string } | null
    byDay.set(row.day_of_week, {
      templateId: row.template_id,
      templateName: t?.name ?? null,
    })
  }

  const days: ProgramDay[] = []
  for (let i = 0; i < 7; i++) {
    const found = byDay.get(i)
    days.push({
      dayOfWeek: i,
      templateId: found?.templateId ?? null,
      templateName: found?.templateName ?? null,
    })
  }

  return {
    id: program.id,
    name: program.name,
    isActive: program.is_active,
    clientId: program.client_id,
    workspaceId: program.workspace_id,
    days,
  }
}

export async function upsertProgram(payload: {
  id?: string
  workspaceId: string
  clientId: string
  name: string
  isActive: boolean
  days: Array<{ dayOfWeek: number; templateId: string | null }>
}): Promise<{ id: string }> {
  const admin = adminClient()

  let programId = payload.id ?? null

  if (programId) {
    const { error } = await admin
      .from('workout_programs')
      .update({
        client_id: payload.clientId,
        name: payload.name,
        is_active: payload.isActive,
      })
      .eq('id', programId)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await admin
      .from('workout_programs')
      .insert({
        workspace_id: payload.workspaceId,
        client_id: payload.clientId,
        name: payload.name,
        is_active: payload.isActive,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Failed to create program')
    programId = data.id
  }

  // Replace all days
  const { error: delErr } = await admin
    .from('workout_program_days')
    .delete()
    .eq('program_id', programId)
  if (delErr) throw new Error(delErr.message)

  const inserts = payload.days
    .filter((d) => d.templateId !== null)
    .map((d) => ({
      program_id: programId!,
      day_of_week: d.dayOfWeek,
      template_id: d.templateId,
    }))

  if (inserts.length > 0) {
    const { error: insErr } = await admin
      .from('workout_program_days')
      .insert(inserts)
    if (insErr) throw new Error(insErr.message)
  }

  revalidateTag('programs', 'max')
  return { id: programId! }
}

export async function deleteProgram(programId: string): Promise<void> {
  const admin = adminClient()
  const { error } = await admin.from('workout_programs').delete().eq('id', programId)
  if (error) throw new Error(error.message)
  revalidateTag('programs', 'max')
}

export async function createCustomExercise(payload: {
  workspaceId: string
  name: string
  muscleGroup: string
  equipment: string
}): Promise<Exercise> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('exercises')
    .insert({
      workspace_id: payload.workspaceId,
      name: payload.name,
      muscle_group: payload.muscleGroup,
      equipment: payload.equipment,
    })
    .select('id, name, muscle_group, equipment')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create exercise')
  revalidateTag('programs', 'max')
  return {
    id: data.id,
    name: data.name,
    muscleGroup: data.muscle_group,
    equipment: data.equipment,
  }
}
