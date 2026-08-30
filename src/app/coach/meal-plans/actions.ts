'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache, revalidateTag } from 'next/cache'
import { createNotification } from '@/lib/notifications'
import { requireCoach, assertCoachOwnsClient } from '@/lib/auth'
import { reconcileRows } from '@/lib/reconcile'
import {
  searchFoods as searchFoodsLib,
  upsertFood as upsertFoodLib,
  type FoodSearchResult,
} from '@/lib/food-search'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** Asserts a meal-plan template belongs to the coach's workspace. */
async function assertCoachOwnsTemplate(workspaceId: string, templateId: string): Promise<void> {
  const admin = adminClient()
  const { data } = await admin
    .from('meal_plan_templates')
    .select('id')
    .eq('id', templateId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (!data) throw new Error('Template not in your workspace')
}

export type PlanType = 'training' | 'rest' | 'overall'

export type MealPlanTemplate = {
  id: string
  workspaceId: string
  name: string
  planType: PlanType
  notes: string | null
  recommendations: string | null
  mealCount: number
  createdAt: string
}

export type FoodRow = {
  id: string
  foodId: string | null
  foodName: string
  quantity: number
  unit: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  sortOrder: number
}

export type OptionRow = {
  id: string
  label: string
  sortOrder: number
  foods: FoodRow[]
}

export type MealRow = {
  id: string
  name: string
  sortOrder: number
  options: OptionRow[]
}

export type FullTemplate = {
  id: string
  workspaceId: string
  name: string
  planType: PlanType
  notes: string | null
  recommendations: string | null
  meals: MealRow[]
}

export type Assignment = {
  id: string
  clientId: string
  clientName: string
  templateId: string
  templateName: string
  planType: PlanType
  isActive: boolean
}

export type ClientAssignments = {
  training: Assignment | null
  rest: Assignment | null
  overall: Assignment | null
}

const _getMealPlanTemplatesCached = unstable_cache(
  async (workspaceId: string): Promise<MealPlanTemplate[]> => {
    const admin = adminClient()
    const { data: templates, error } = await admin
      .from('meal_plan_templates')
      .select('id, workspace_id, name, plan_type, notes, recommendations, created_at')
      .eq('workspace_id', workspaceId)
      .order('plan_type', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    const ids = (templates ?? []).map((t) => t.id)
    const counts = new Map<string, number>()
    if (ids.length > 0) {
      const { data: rows, error: e2 } = await admin
        .from('meal_plan_meals')
        .select('template_id')
        .in('template_id', ids)
      if (e2) throw new Error(e2.message)
      for (const r of rows ?? []) {
        counts.set(r.template_id, (counts.get(r.template_id) ?? 0) + 1)
      }
    }

    return (templates ?? []).map((t) => ({
      id: t.id,
      workspaceId: t.workspace_id,
      name: t.name,
      planType: t.plan_type as PlanType,
      notes: t.notes,
      recommendations: t.recommendations,
      mealCount: counts.get(t.id) ?? 0,
      createdAt: t.created_at,
    }))
  },
  ['meal-plans-getTemplates'],
  { tags: ['meal-plans'], revalidate: 60 }
)

export async function getMealPlanTemplates(workspaceId: string): Promise<MealPlanTemplate[]> {
  // Identity comes from the session, never the passed workspaceId.
  void workspaceId
  const coach = await requireCoach()
  return _getMealPlanTemplatesCached(coach.workspaceId)
}

export async function getMealPlanTemplate(templateId: string): Promise<FullTemplate | null> {
  const coach = await requireCoach()
  await assertCoachOwnsTemplate(coach.workspaceId, templateId)
  const admin = adminClient()
  // Single nested query replaces 4 sequential queries
  const { data: template, error } = await admin
    .from('meal_plan_templates')
    .select(`
      id, workspace_id, name, plan_type, notes, recommendations,
      meal_plan_meals(
        id, name, sort_order,
        meal_plan_meal_options(
          id, label, sort_order,
          meal_plan_foods(id, food_id, food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, sort_order)
        )
      )
    `)
    .eq('id', templateId)
    .single()
  if (error || !template) return null

  type RawFood = { id: string; food_id: string | null; food_name: string; quantity: number; unit: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; sort_order: number }
  type RawOption = { id: string; label: string; sort_order: number; meal_plan_foods: RawFood[] }
  type RawMeal = { id: string; name: string; sort_order: number; meal_plan_meal_options: RawOption[] }

  const rawMeals = ((template.meal_plan_meals as unknown as RawMeal[]) ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)

  const mealRows: MealRow[] = rawMeals.map((m) => ({
    id: m.id,
    name: m.name,
    sortOrder: m.sort_order,
    options: (m.meal_plan_meal_options ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({
        id: o.id,
        label: o.label,
        sortOrder: o.sort_order,
        foods: (o.meal_plan_foods ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((f) => ({
            id: f.id,
            foodId: f.food_id,
            foodName: f.food_name,
            quantity: Number(f.quantity),
            unit: f.unit,
            calories: Number(f.calories),
            proteinG: Number(f.protein_g),
            carbsG: Number(f.carbs_g),
            fatG: Number(f.fat_g),
            sortOrder: f.sort_order,
          })),
      })),
  }))

  return {
    id: template.id,
    workspaceId: template.workspace_id,
    name: template.name,
    planType: template.plan_type as PlanType,
    notes: template.notes,
    recommendations: template.recommendations,
    meals: mealRows,
  }
}

export async function upsertMealPlanTemplate(payload: {
  id?: string
  workspaceId: string
  name: string
  planType: PlanType
  notes: string
  recommendations: string
  meals: Array<{
    id?: string
    name: string
    sortOrder: number
    options: Array<{
      id?: string
      label: string
      sortOrder: number
      foods: Array<{
        id?: string
        foodId: string | null
        foodName: string
        quantity: number
        unit: string
        calories: number
        proteinG: number
        carbsG: number
        fatG: number
        sortOrder: number
      }>
    }>
  }>
}): Promise<{ id: string }> {
  const coach = await requireCoach()
  const admin = adminClient()

  let templateId = payload.id ?? null

  if (templateId) {
    // Only allow editing a template that belongs to the coach's workspace.
    await assertCoachOwnsTemplate(coach.workspaceId, templateId)
    const { error } = await admin
      .from('meal_plan_templates')
      .update({
        name: payload.name,
        plan_type: payload.planType,
        notes: payload.notes || null,
        recommendations: payload.recommendations || null,
      })
      .eq('id', templateId)
      .eq('workspace_id', coach.workspaceId)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await admin
      .from('meal_plan_templates')
      .insert({
        workspace_id: coach.workspaceId,
        name: payload.name,
        plan_type: payload.planType,
        notes: payload.notes || null,
        recommendations: payload.recommendations || null,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Failed to create template')
    templateId = data.id
  }

  // nutrition_logs point at meal_plan_meal_options and meal_plan_foods with
  // ON DELETE SET NULL, so deleting the plan's rows on every save orphans every
  // meal a client has already ticked off — they stop counting as plan foods and
  // the day reads as unlogged. Match the incoming rows onto the existing ones
  // and reuse their ids instead of re-creating them.
  const { data: existingMeals, error: exErr } = await admin
    .from('meal_plan_meals')
    .select(`
      id, name, sort_order,
      meal_plan_meal_options(
        id, label, sort_order,
        meal_plan_foods(id, food_name, sort_order)
      )
    `)
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true })
  if (exErr) throw new Error(exErr.message)

  type ExistingFood = { id: string; food_name: string; sort_order: number }
  type ExistingOption = { id: string; label: string; sort_order: number; meal_plan_foods: ExistingFood[] }
  type ExistingMeal = { id: string; name: string; sort_order: number; meal_plan_meal_options: ExistingOption[] }

  const sortByOrder = <T extends { sort_order: number }>(rows: T[] | null | undefined): T[] =>
    [...(rows ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  const mealMatches = reconcileRows(
    payload.meals,
    sortByOrder(existingMeals as unknown as ExistingMeal[]),
    { idOf: (m) => m.id, keyOf: (m) => m.name, existingKeyOf: (m) => m.name }
  )

  const removedMealIds = mealMatches.removed.map((m) => m.id)
  const removedOptionIds: string[] = []
  const removedFoodIds: string[] = []

  for (const { incoming: meal, existing: existingMeal, id: mealId } of mealMatches.pairs) {
    const mealValues = { template_id: templateId!, name: meal.name, sort_order: meal.sortOrder }
    if (existingMeal) {
      const { error: uErr } = await admin.from('meal_plan_meals').update(mealValues).eq('id', mealId)
      if (uErr) throw new Error(uErr.message)
    } else {
      const { error: iErr } = await admin.from('meal_plan_meals').insert({ id: mealId, ...mealValues })
      if (iErr) throw new Error(iErr.message)
    }

    const optionMatches = reconcileRows(
      meal.options,
      sortByOrder(existingMeal?.meal_plan_meal_options),
      { idOf: (o) => o.id, keyOf: (o) => o.label, existingKeyOf: (o) => o.label }
    )
    removedOptionIds.push(...optionMatches.removed.map((o) => o.id))

    for (const { incoming: option, existing: existingOption, id: optionId } of optionMatches.pairs) {
      const optionValues = { meal_id: mealId, label: option.label, sort_order: option.sortOrder }
      if (existingOption) {
        const { error: uErr } = await admin.from('meal_plan_meal_options').update(optionValues).eq('id', optionId)
        if (uErr) throw new Error(uErr.message)
      } else {
        const { error: iErr } = await admin.from('meal_plan_meal_options').insert({ id: optionId, ...optionValues })
        if (iErr) throw new Error(iErr.message)
      }

      const foodMatches = reconcileRows(
        option.foods,
        sortByOrder(existingOption?.meal_plan_foods),
        { idOf: (f) => f.id, keyOf: (f) => f.foodName, existingKeyOf: (f) => f.food_name }
      )
      removedFoodIds.push(...foodMatches.removed.map((f) => f.id))

      const foodRows = foodMatches.pairs.map(({ incoming: f, id }) => ({
        id,
        option_id: optionId,
        food_id: f.foodId,
        food_name: f.foodName,
        quantity: f.quantity,
        unit: f.unit,
        calories: f.calories,
        protein_g: f.proteinG,
        carbs_g: f.carbsG,
        fat_g: f.fatG,
        sort_order: f.sortOrder,
      }))
      if (foodRows.length > 0) {
        const { error: fErr } = await admin.from('meal_plan_foods').upsert(foodRows)
        if (fErr) throw new Error(fErr.message)
      }
    }
  }

  // Rows the coach actually removed. Deleting meals cascades to their options
  // and foods, so drop the leftovers first and let the cascade cover the rest.
  for (const [table, ids] of [
    ['meal_plan_foods', removedFoodIds],
    ['meal_plan_meal_options', removedOptionIds],
    ['meal_plan_meals', removedMealIds],
  ] as const) {
    if (ids.length === 0) continue
    const { error: dErr } = await admin.from(table).delete().in('id', ids)
    if (dErr) throw new Error(dErr.message)
  }

  revalidateTag('meal-plans', 'max')
  return { id: templateId! }
}

export async function duplicateMealPlanTemplate(templateId: string): Promise<{ id: string }> {
  const template = await getMealPlanTemplate(templateId)
  if (!template) throw new Error('Template not found')

  return upsertMealPlanTemplate({
    workspaceId: template.workspaceId,
    name: `Copy of ${template.name}`,
    planType: template.planType,
    notes: template.notes ?? '',
    recommendations: template.recommendations ?? '',
    meals: template.meals.map((m) => ({
      name: m.name,
      sortOrder: m.sortOrder,
      options: m.options.map((o) => ({
        label: o.label,
        sortOrder: o.sortOrder,
        foods: o.foods.map((f) => ({
          foodId: f.foodId,
          foodName: f.foodName,
          quantity: f.quantity,
          unit: f.unit,
          calories: f.calories,
          proteinG: f.proteinG,
          carbsG: f.carbsG,
          fatG: f.fatG,
          sortOrder: f.sortOrder,
        })),
      })),
    })),
  })
}

export async function deleteMealPlanTemplate(templateId: string): Promise<void> {
  const coach = await requireCoach()
  const admin = adminClient()
  const { error } = await admin
    .from('meal_plan_templates')
    .delete()
    .eq('id', templateId)
    .eq('workspace_id', coach.workspaceId)
  if (error) throw new Error(error.message)
  revalidateTag('meal-plans', 'max')
}

export async function getMealPlanAssignments(workspaceId: string): Promise<Assignment[]> {
  void workspaceId
  const coach = await requireCoach()
  const admin = adminClient()
  const { data, error } = await admin
    .from('meal_plan_assignments')
    .select('id, client_id, template_id, plan_type, is_active, clients(full_name), meal_plan_templates(name)')
    .eq('workspace_id', coach.workspaceId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((a) => {
    const c = a.clients as unknown as { full_name: string } | null
    const t = a.meal_plan_templates as unknown as { name: string } | null
    return {
      id: a.id,
      clientId: a.client_id,
      clientName: c?.full_name ?? 'Unknown client',
      templateId: a.template_id,
      templateName: t?.name ?? 'Unknown',
      planType: a.plan_type as PlanType,
      isActive: a.is_active,
    }
  })
}

export async function getClientAssignments(clientId: string): Promise<ClientAssignments> {
  const coach = await requireCoach()
  await assertCoachOwnsClient(coach, clientId)
  const admin = adminClient()
  const { data, error } = await admin
    .from('meal_plan_assignments')
    .select('id, client_id, template_id, plan_type, is_active, clients(full_name), meal_plan_templates(name)')
    .eq('client_id', clientId)
    .eq('is_active', true)
  if (error) throw new Error(error.message)

  const result: ClientAssignments = { training: null, rest: null, overall: null }
  for (const a of data ?? []) {
    const c = a.clients as unknown as { full_name: string } | null
    const t = a.meal_plan_templates as unknown as { name: string } | null
    const item: Assignment = {
      id: a.id,
      clientId: a.client_id,
      clientName: c?.full_name ?? 'Unknown client',
      templateId: a.template_id,
      templateName: t?.name ?? 'Unknown',
      planType: a.plan_type as PlanType,
      isActive: a.is_active,
    }
    if (item.planType === 'training') result.training = item
    else if (item.planType === 'rest') result.rest = item
    else if (item.planType === 'overall') result.overall = item
  }
  return result
}

export async function upsertClientMealPlanAssignment(payload: {
  workspaceId: string
  clientId: string
  trainingTemplateId: string | null
  restTemplateId: string | null
  overallTemplateId: string | null
}): Promise<void> {
  const coach = await requireCoach()
  await assertCoachOwnsClient(coach, payload.clientId)
  const admin = adminClient()
  // Every template being assigned must belong to the coach's workspace.
  for (const templateId of [payload.trainingTemplateId, payload.restTemplateId, payload.overallTemplateId]) {
    if (templateId) await assertCoachOwnsTemplate(coach.workspaceId, templateId)
  }
  const types: Array<{ planType: PlanType; templateId: string | null }> = [
    { planType: 'training', templateId: payload.trainingTemplateId },
    { planType: 'rest', templateId: payload.restTemplateId },
    { planType: 'overall', templateId: payload.overallTemplateId },
  ]

  for (const { planType, templateId } of types) {
    const { error: dErr } = await admin
      .from('meal_plan_assignments')
      .update({ is_active: false })
      .eq('client_id', payload.clientId)
      .eq('plan_type', planType)
      .eq('is_active', true)
    if (dErr) throw new Error(dErr.message)

    if (templateId) {
      const { error: iErr } = await admin.from('meal_plan_assignments').insert({
        workspace_id: coach.workspaceId,
        client_id: payload.clientId,
        template_id: templateId,
        plan_type: planType,
        is_active: true,
      })
      if (iErr) throw new Error(iErr.message)
    }
  }
  const hasAssignment = payload.trainingTemplateId !== null || payload.restTemplateId !== null || payload.overallTemplateId !== null
  if (hasAssignment) {
    await createNotification({
      workspaceId: coach.workspaceId,
      recipientType: 'client',
      recipientId: payload.clientId,
      type: 'meal_plan_assigned',
      title: 'Meal plan updated',
      body: 'Your coach has assigned a new meal plan',
      link: '/client/nutrition',
    })
  }

  revalidateTag('meal-plans', 'max')
}

export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  await requireCoach()
  const client = adminClient()
  return searchFoodsLib(query, client)
}

export async function upsertFood(result: FoodSearchResult): Promise<string> {
  await requireCoach()
  const client = adminClient()
  return upsertFoodLib(result, client)
}

export async function getWorkspaceIdForCoach(email: string): Promise<string | null> {
  // Identity comes from the session, never the passed email.
  void email
  const coach = await requireCoach()
  return coach.workspaceId
}

// ─── Carb Cycle Assignments ────────────────────────────────────────────────

export type CarbCycleAssignment = {
  id: string
  clientId: string
  lowPlanId: string
  highPlanId: string
  cycleStartDate: string
  cycleLength: number
}

export async function getCarbCycleAssignment(clientId: string): Promise<CarbCycleAssignment | null> {
  const coach = await requireCoach()
  await assertCoachOwnsClient(coach, clientId)
  const admin = adminClient()
  const { data, error } = await admin
    .from('carb_cycle_assignments')
    .select('id, client_id, low_plan_id, high_plan_id, cycle_start_date, cycle_length')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .maybeSingle()
  if (error || !data) return null
  return {
    id: data.id,
    clientId: data.client_id,
    lowPlanId: data.low_plan_id,
    highPlanId: data.high_plan_id,
    cycleStartDate: data.cycle_start_date,
    cycleLength: data.cycle_length,
  }
}

export async function upsertCarbCycleAssignment(payload: {
  workspaceId: string
  clientId: string
  lowPlanId: string | null
  highPlanId: string | null
  cycleStartDate: string
  cycleLength?: number
}): Promise<void> {
  const coach = await requireCoach()
  await assertCoachOwnsClient(coach, payload.clientId)
  for (const planId of [payload.lowPlanId, payload.highPlanId]) {
    if (planId) await assertCoachOwnsTemplate(coach.workspaceId, planId)
  }
  const admin = adminClient()

  // Deactivate any existing active cycle for this client
  const { error: deErr } = await admin
    .from('carb_cycle_assignments')
    .update({ is_active: false })
    .eq('client_id', payload.clientId)
    .eq('is_active', true)
  if (deErr) throw new Error(deErr.message)

  // Insert new cycle only when both plans are provided
  if (payload.lowPlanId && payload.highPlanId) {
    const { error: iErr } = await admin.from('carb_cycle_assignments').insert({
      workspace_id: coach.workspaceId,
      client_id: payload.clientId,
      low_plan_id: payload.lowPlanId,
      high_plan_id: payload.highPlanId,
      cycle_start_date: payload.cycleStartDate,
      cycle_length: payload.cycleLength ?? 4,
      is_active: true,
    })
    if (iErr) throw new Error(iErr.message)
  }

  revalidateTag('meal-plans', 'max')
}

export async function getClients(workspaceId: string): Promise<Array<{ id: string; name: string; email: string }>> {
  void workspaceId
  const coach = await requireCoach()
  const admin = adminClient()
  const { data, error } = await admin
    .from('clients')
    .select('id, full_name, email')
    .eq('workspace_id', coach.workspaceId)
    .order('full_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((c) => ({ id: c.id, name: c.full_name, email: c.email }))
}
