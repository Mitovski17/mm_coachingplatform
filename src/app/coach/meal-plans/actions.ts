'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache, revalidateTag } from 'next/cache'
import { createNotification } from '@/lib/notifications'
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
  return _getMealPlanTemplatesCached(workspaceId)
}

export async function getMealPlanTemplate(templateId: string): Promise<FullTemplate | null> {
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
  const admin = adminClient()

  let templateId = payload.id ?? null

  if (templateId) {
    const { error } = await admin
      .from('meal_plan_templates')
      .update({
        name: payload.name,
        plan_type: payload.planType,
        notes: payload.notes || null,
        recommendations: payload.recommendations || null,
      })
      .eq('id', templateId)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await admin
      .from('meal_plan_templates')
      .insert({
        workspace_id: payload.workspaceId,
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

  // Cascade-delete via meals; foreign keys cascade to options + foods
  const { error: delErr } = await admin
    .from('meal_plan_meals')
    .delete()
    .eq('template_id', templateId)
  if (delErr) throw new Error(delErr.message)

  for (const meal of payload.meals) {
    const { data: mealRow, error: mErr } = await admin
      .from('meal_plan_meals')
      .insert({
        template_id: templateId!,
        name: meal.name,
        sort_order: meal.sortOrder,
      })
      .select('id')
      .single()
    if (mErr || !mealRow) throw new Error(mErr?.message ?? 'Failed to insert meal')

    for (const option of meal.options) {
      const { data: optRow, error: oErr } = await admin
        .from('meal_plan_meal_options')
        .insert({
          meal_id: mealRow.id,
          label: option.label,
          sort_order: option.sortOrder,
        })
        .select('id')
        .single()
      if (oErr || !optRow) throw new Error(oErr?.message ?? 'Failed to insert option')

      if (option.foods.length > 0) {
        const foodRows = option.foods.map((f) => ({
          option_id: optRow.id,
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
        const { error: fErr } = await admin.from('meal_plan_foods').insert(foodRows)
        if (fErr) throw new Error(fErr.message)
      }
    }
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
  const admin = adminClient()
  const { error } = await admin.from('meal_plan_templates').delete().eq('id', templateId)
  if (error) throw new Error(error.message)
  revalidateTag('meal-plans', 'max')
}

export async function getMealPlanAssignments(workspaceId: string): Promise<Assignment[]> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('meal_plan_assignments')
    .select('id, client_id, template_id, plan_type, is_active, clients(full_name), meal_plan_templates(name)')
    .eq('workspace_id', workspaceId)
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
  const admin = adminClient()
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
        workspace_id: payload.workspaceId,
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
      workspaceId: payload.workspaceId,
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
  const client = adminClient()
  return searchFoodsLib(query, client)
}

export async function upsertFood(result: FoodSearchResult): Promise<string> {
  const client = adminClient()
  return upsertFoodLib(result, client)
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

export async function getClients(workspaceId: string): Promise<Array<{ id: string; name: string; email: string }>> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('clients')
    .select('id, full_name, email')
    .eq('workspace_id', workspaceId)
    .order('full_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((c) => ({ id: c.id, name: c.full_name, email: c.email }))
}
