'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache, revalidateTag } from 'next/cache'
import { createNotification } from '@/lib/notifications'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
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

export type TemplateDay = {
  id: string
  label: string
  sortOrder: number
  notes: string | null
  exerciseCount: number
}

export type Template = {
  id: string
  name: string
  notes: string | null
  dayCount: number
  days: TemplateDay[]
  createdAt: string
}

export type TemplateDayWithExercises = {
  id: string
  label: string
  sortOrder: number
  notes: string | null
  exercises: TemplateExerciseRow[]
}

export type TemplateWithDays = {
  id: string
  name: string
  notes: string | null
  workspaceId: string
  days: TemplateDayWithExercises[]
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
  dayOfWeek: number | null
  templateDayId: string | null
  templateDayLabel: string | null
}

export type Program = {
  id: string
  name: string
  isActive: boolean
  clientId: string
  clientName: string
  dayCount: number
  days: ProgramDayPreview[]
  scheduleType: 'weekly' | 'cyclic'
  createdAt: string
}

export type ProgramDay = {
  dayOfWeek: number | null
  cyclePosition: number | null
  templateDayId: string | null
  templateDayLabel: string | null
  templateName: string | null
}

export type ProgramWithDays = {
  id: string
  name: string
  isActive: boolean
  clientId: string
  workspaceId: string
  scheduleType: 'weekly' | 'cyclic'
  cycleStartDate: string | null
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

    const templateIds = (templates ?? []).map((t) => t.id)
    const daysByTemplate = new Map<string, TemplateDay[]>()

    if (templateIds.length > 0) {
      const { data: dayRows, error: e2 } = await admin
        .from('workout_template_days')
        .select('id, template_id, sort_order, label, notes')
        .in('template_id', templateIds)
        .order('sort_order', { ascending: true })
      if (e2) throw new Error(e2.message)

      const dayIds = (dayRows ?? []).map((d) => d.id)
      const exCountsByDay = new Map<string, number>()
      if (dayIds.length > 0) {
        const { data: exRows, error: e3 } = await admin
          .from('workout_template_exercises')
          .select('template_day_id')
          .in('template_day_id', dayIds)
        if (e3) throw new Error(e3.message)
        for (const r of exRows ?? []) {
          exCountsByDay.set(r.template_day_id, (exCountsByDay.get(r.template_day_id) ?? 0) + 1)
        }
      }

      for (const d of dayRows ?? []) {
        const list = daysByTemplate.get(d.template_id) ?? []
        list.push({
          id: d.id,
          label: d.label,
          sortOrder: d.sort_order,
          notes: d.notes,
          exerciseCount: exCountsByDay.get(d.id) ?? 0,
        })
        daysByTemplate.set(d.template_id, list)
      }
    }

    return (templates ?? []).map((t) => {
      const days = daysByTemplate.get(t.id) ?? []
      return {
        id: t.id,
        name: t.name,
        notes: t.notes,
        dayCount: days.length,
        days,
        createdAt: t.created_at,
      }
    })
  },
  ['programs-getTemplates'],
  { tags: ['programs'], revalidate: 60 }
)

export async function getTemplates(workspaceId: string): Promise<Template[]> {
  return _getTemplatesCached(workspaceId)
}

export async function getTemplate(templateId: string): Promise<TemplateWithDays | null> {
  const admin = adminClient()
  const { data: template, error } = await admin
    .from('workout_templates')
    .select(`
      id, name, notes, workspace_id,
      workout_template_days(
        id, sort_order, label, notes,
        workout_template_exercises(
          id, exercise_id, sort_order, target_sets, target_reps, rest_seconds, notes,
          exercises(name, muscle_group),
          workout_template_exercise_sets(id, set_number, target_reps, target_weight, rpe, notes)
        )
      )
    `)
    .eq('id', templateId)
    .single()
  if (error || !template) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawDays = ((template.workout_template_days as unknown as any[]) ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => a.sort_order - b.sort_order)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const days: TemplateDayWithExercises[] = rawDays.map((d: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawExercises = ((d.workout_template_exercises as unknown as any[]) ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.sort_order - b.sort_order)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exercises: TemplateExerciseRow[] = rawExercises.map((r: any) => {
      const ex = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises
      const savedSets = ((r.workout_template_exercise_sets ?? []) as Array<{
        id: string; set_number: number; target_reps: number
        target_weight: string | null; rpe: string | null; notes: string | null
      }>).sort((a, b) => a.set_number - b.set_number)
      const sets: ExerciseSetRow[] = savedSets.length > 0
        ? savedSets.map((s) => ({
            id: s.id, setNumber: s.set_number, targetReps: s.target_reps,
            targetWeight: s.target_weight ?? null, rpe: s.rpe ?? null, notes: s.notes ?? null,
          }))
        : Array.from({ length: r.target_sets }, (_, i) => ({
            setNumber: i + 1, targetReps: Number(r.target_reps) || 10,
          }))
      return {
        id: r.id, exerciseId: r.exercise_id,
        exerciseName: ex?.name ?? 'Unknown', muscleGroup: ex?.muscle_group ?? '',
        sortOrder: r.sort_order, targetSets: r.target_sets,
        targetReps: r.target_reps, restSeconds: r.rest_seconds,
        notes: r.notes, sets,
      }
    })

    return { id: d.id, label: d.label, sortOrder: d.sort_order, notes: d.notes, exercises }
  })

  return {
    id: template.id, name: template.name,
    notes: template.notes, workspaceId: template.workspace_id, days,
  }
}

export async function upsertTemplate(payload: {
  id?: string
  workspaceId: string
  name: string
  notes?: string
  days: Array<{
    id?: string
    label: string
    sortOrder: number
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
  }>
}): Promise<{ id: string }> {
  const admin = adminClient()

  let templateId = payload.id ?? null

  if (templateId) {
    const { error } = await admin
      .from('workout_templates')
      .update({ name: payload.name, notes: payload.notes ?? null })
      .eq('id', templateId)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await admin
      .from('workout_templates')
      .insert({ workspace_id: payload.workspaceId, name: payload.name, notes: payload.notes ?? null })
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Failed to create template')
    templateId = data.id
  }

  // Delete all existing days (cascade deletes exercises and sets)
  await admin.from('workout_template_days').delete().eq('template_id', templateId)

  // Re-insert all days with their exercises
  for (const day of payload.days) {
    const { data: insertedDay, error: dayErr } = await admin
      .from('workout_template_days')
      .insert({ template_id: templateId, sort_order: day.sortOrder, label: day.label, notes: day.notes ?? null })
      .select('id')
      .single()
    if (dayErr || !insertedDay) throw new Error(dayErr?.message ?? 'Failed to create day')
    const dayId = insertedDay.id

    if (day.exercises.length === 0) continue

    const exRows = day.exercises.map((ex) => ({
      template_day_id: dayId,
      exercise_id: ex.exerciseId,
      sort_order: ex.sortOrder,
      target_sets: ex.sets.length,
      target_reps: String(ex.sets[0]?.targetReps ?? 10),
      rest_seconds: ex.restSeconds,
      notes: ex.notes ?? null,
    }))
    const { data: insertedExercises, error: exErr } = await admin
      .from('workout_template_exercises')
      .insert(exRows)
      .select('id')
    if (exErr || !insertedExercises) throw new Error(exErr?.message ?? 'Failed to insert exercises')

    const setInserts = day.exercises.flatMap((ex, idx) =>
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
      const { error: setsErr } = await admin.from('workout_template_exercise_sets').insert(setInserts)
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

export async function duplicateTemplate(templateId: string): Promise<{ id: string }> {
  const template = await getTemplate(templateId)
  if (!template) throw new Error('Template not found')

  return upsertTemplate({
    workspaceId: template.workspaceId,
    name: `Copy of ${template.name}`,
    notes: template.notes ?? '',
    days: template.days.map((d) => ({
      label: d.label,
      sortOrder: d.sortOrder,
      notes: d.notes ?? '',
      exercises: d.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        sortOrder: ex.sortOrder,
        restSeconds: ex.restSeconds,
        notes: ex.notes ?? '',
        sets: ex.sets.map((s) => ({
          setNumber: s.setNumber,
          targetReps: s.targetReps,
          targetWeight: s.targetWeight ?? undefined,
          rpe: s.rpe ?? undefined,
          notes: s.notes ?? undefined,
        })),
      })),
    })),
  })
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
      .select('id, name, is_active, client_id, created_at, schedule_type, clients(full_name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    const ids = (programs ?? []).map((p) => p.id)
    const daysByProgram = new Map<string, ProgramDayPreview[]>()
    if (ids.length > 0) {
      const { data: dayRows, error: e2 } = await admin
        .from('workout_program_days')
        .select('program_id, day_of_week, template_day_id, workout_template_days(label)')
        .in('program_id', ids)
      if (e2) throw new Error(e2.message)
      for (const r of dayRows ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const td = r.workout_template_days as unknown as { label: string } | null
        const list = daysByProgram.get(r.program_id) ?? []
        list.push({
          dayOfWeek: r.day_of_week,
          templateDayId: r.template_day_id,
          templateDayLabel: td?.label ?? null,
        })
        daysByProgram.set(r.program_id, list)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (programs ?? []).map((p: any) => {
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
        scheduleType: (p.schedule_type ?? 'weekly') as 'weekly' | 'cyclic',
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
    .select('id, name, is_active, client_id, workspace_id, schedule_type, cycle_start_date')
    .eq('id', programId)
    .single()
  if (error || !program) return null

  const { data: dayRows, error: e2 } = await admin
    .from('workout_program_days')
    .select('day_of_week, cycle_position, template_day_id, workout_template_days(label, workout_templates(name))')
    .eq('program_id', programId)
  if (e2) throw new Error(e2.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pgm = program as any
  const scheduleType: 'weekly' | 'cyclic' = (pgm.schedule_type ?? 'weekly') as 'weekly' | 'cyclic'

  if (scheduleType === 'cyclic') {
    const days: ProgramDay[] = (dayRows ?? [])
      .slice()
      .sort((a, b) => ((a as any).cycle_position ?? 0) - ((b as any).cycle_position ?? 0))
      .map((row) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const td = row.workout_template_days as unknown as any
        return {
          dayOfWeek: null,
          cyclePosition: (row as any).cycle_position ?? null,
          templateDayId: row.template_day_id,
          templateDayLabel: td?.label ?? null,
          templateName: td?.workout_templates?.name ?? null,
        }
      })
    return {
      id: program.id,
      name: program.name,
      isActive: program.is_active,
      clientId: program.client_id,
      workspaceId: program.workspace_id,
      scheduleType,
      cycleStartDate: pgm.cycle_start_date ?? null,
      days,
    }
  }

  // Weekly: build 7-slot array (rest days are implicit)
  const byDay = new Map<number, { templateDayId: string | null; templateDayLabel: string | null; templateName: string | null }>()
  for (const row of dayRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const td = row.workout_template_days as unknown as any
    if (row.day_of_week !== null) {
      byDay.set(row.day_of_week, {
        templateDayId: row.template_day_id,
        templateDayLabel: td?.label ?? null,
        templateName: td?.workout_templates?.name ?? null,
      })
    }
  }

  const days: ProgramDay[] = []
  for (let i = 0; i < 7; i++) {
    const found = byDay.get(i)
    days.push({
      dayOfWeek: i,
      cyclePosition: null,
      templateDayId: found?.templateDayId ?? null,
      templateDayLabel: found?.templateDayLabel ?? null,
      templateName: found?.templateName ?? null,
    })
  }

  return {
    id: program.id,
    name: program.name,
    isActive: program.is_active,
    clientId: program.client_id,
    workspaceId: program.workspace_id,
    scheduleType,
    cycleStartDate: null,
    days,
  }
}

export async function upsertProgram(payload: {
  id?: string
  workspaceId: string
  clientId: string
  name: string
  isActive: boolean
  scheduleType: 'weekly' | 'cyclic'
  cycleStartDate?: string | null
  days: Array<{ dayOfWeek?: number | null; cyclePosition?: number | null; templateDayId: string | null }>
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
        schedule_type: payload.scheduleType,
        cycle_start_date: payload.cycleStartDate ?? null,
      } as Record<string, unknown>)
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
        schedule_type: payload.scheduleType,
        cycle_start_date: payload.cycleStartDate ?? null,
      } as Record<string, unknown>)
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

  // Cyclic: store all positions (including rest days). Weekly: skip rest days (implicit by absence).
  const inserts: Record<string, unknown>[] = payload.scheduleType === 'cyclic'
    ? payload.days.map((d) => ({
        program_id: programId!,
        day_of_week: null,
        cycle_position: d.cyclePosition ?? null,
        template_day_id: d.templateDayId,
      }))
    : payload.days
        .filter((d) => d.templateDayId !== null)
        .map((d) => ({
          program_id: programId!,
          day_of_week: d.dayOfWeek ?? null,
          cycle_position: null,
          template_day_id: d.templateDayId,
        }))

  if (inserts.length > 0) {
    const { error: insErr } = await admin
      .from('workout_program_days')
      .insert(inserts)
    if (insErr) throw new Error(insErr.message)
  }

  if (payload.isActive) {
    await createNotification({
      workspaceId: payload.workspaceId,
      recipientType: 'client',
      recipientId: payload.clientId,
      type: 'program_assigned',
      title: 'New training program',
      body: `Your coach assigned you "${payload.name}"`,
      link: '/client/workouts',
    })
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
