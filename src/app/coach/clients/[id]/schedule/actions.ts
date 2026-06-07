'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type TemplateDayOption = {
  id: string
  label: string
  templateId: string
  templateName: string
}

export type MealTemplateOption = {
  id: string
  name: string
  planType: string
}

export type WorkoutOverride = {
  id: string
  assignedDate: string
  templateDayId: string | null
  templateDayLabel: string | null
  templateName: string | null
}

export type MealOverride = {
  id: string
  assignedDate: string
  templateId: string | null
  templateName: string | null
}

export async function getScheduleData(clientId: string, workspaceId: string): Promise<{
  workoutOverrides: WorkoutOverride[]
  mealOverrides: MealOverride[]
  templateDays: TemplateDayOption[]
  mealTemplates: MealTemplateOption[]
}> {
  const admin = adminClient()

  const [woRes, moRes, tdRes, mtRes] = await Promise.all([
    // Existing workout overrides for this client
    admin
      .from('date_workout_overrides')
      .select('id, assigned_date, template_day_id, workout_template_days(label, workout_templates(name))')
      .eq('client_id', clientId)
      .order('assigned_date', { ascending: true }),

    // Existing meal overrides for this client
    admin
      .from('date_meal_overrides')
      .select('id, assigned_date, template_id, meal_plan_templates(name)')
      .eq('client_id', clientId)
      .order('assigned_date', { ascending: true }),

    // All template days for this workspace
    admin
      .from('workout_template_days')
      .select('id, label, sort_order, workout_templates!inner(id, name, workspace_id)')
      .eq('workout_templates.workspace_id', workspaceId)
      .order('sort_order', { ascending: true }),

    // All meal plan templates for this workspace
    admin
      .from('meal_plan_templates')
      .select('id, name, plan_type')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workoutOverrides: WorkoutOverride[] = (woRes.data ?? []).map((r: any) => {
    const day = Array.isArray(r.workout_template_days) ? r.workout_template_days[0] : r.workout_template_days
    const tpl = day ? (Array.isArray(day.workout_templates) ? day.workout_templates[0] : day.workout_templates) : null
    return {
      id: r.id,
      assignedDate: r.assigned_date,
      templateDayId: r.template_day_id,
      templateDayLabel: day?.label ?? null,
      templateName: tpl?.name ?? null,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mealOverrides: MealOverride[] = (moRes.data ?? []).map((r: any) => {
    const tpl = Array.isArray(r.meal_plan_templates) ? r.meal_plan_templates[0] : r.meal_plan_templates
    return {
      id: r.id,
      assignedDate: r.assigned_date,
      templateId: r.template_id,
      templateName: tpl?.name ?? null,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templateDays: TemplateDayOption[] = (tdRes.data ?? []).map((r: any) => {
    const tpl = Array.isArray(r.workout_templates) ? r.workout_templates[0] : r.workout_templates
    return {
      id: r.id,
      label: r.label,
      templateId: tpl?.id ?? '',
      templateName: tpl?.name ?? '',
    }
  })

  const mealTemplates: MealTemplateOption[] = (mtRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    planType: r.plan_type,
  }))

  return { workoutOverrides, mealOverrides, templateDays, mealTemplates }
}

export async function upsertWorkoutOverride(payload: {
  workspaceId: string
  clientId: string
  templateDayId: string | null
  dates: string[]
}): Promise<void> {
  const admin = adminClient()
  const rows = payload.dates.map((d) => ({
    workspace_id: payload.workspaceId,
    client_id: payload.clientId,
    template_day_id: payload.templateDayId,
    assigned_date: d,
  }))
  const { error } = await admin
    .from('date_workout_overrides')
    .upsert(rows, { onConflict: 'client_id,assigned_date' })
  if (error) throw new Error(error.message)
  revalidatePath(`/coach/clients/${payload.clientId}/schedule`)
}

export async function upsertMealOverride(payload: {
  workspaceId: string
  clientId: string
  templateId: string | null
  dates: string[]
}): Promise<void> {
  const admin = adminClient()
  const rows = payload.dates.map((d) => ({
    workspace_id: payload.workspaceId,
    client_id: payload.clientId,
    template_id: payload.templateId,
    assigned_date: d,
  }))
  const { error } = await admin
    .from('date_meal_overrides')
    .upsert(rows, { onConflict: 'client_id,assigned_date' })
  if (error) throw new Error(error.message)
  revalidatePath(`/coach/clients/${payload.clientId}/schedule`)
}

export async function deleteWorkoutOverride(overrideId: string, clientId: string): Promise<void> {
  const admin = adminClient()
  const { error } = await admin.from('date_workout_overrides').delete().eq('id', overrideId)
  if (error) throw new Error(error.message)
  revalidatePath(`/coach/clients/${clientId}/schedule`)
}

export async function deleteMealOverride(overrideId: string, clientId: string): Promise<void> {
  const admin = adminClient()
  const { error } = await admin.from('date_meal_overrides').delete().eq('id', overrideId)
  if (error) throw new Error(error.message)
  revalidatePath(`/coach/clients/${clientId}/schedule`)
}
