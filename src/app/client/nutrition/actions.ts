'use server'

import { cookies } from 'next/headers'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { searchFoods as searchFoodsLib, type FoodSearchResult } from '@/lib/food-search'
import { resolveCarbCycleDay } from '@/lib/utils'
import { requireClient } from '@/lib/auth'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type FoodItem = {
  id: string
  foodName: string
  quantity: number
  unit: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  sortOrder: number
}

export type Option = {
  id: string
  label: string
  sortOrder: number
  foods: FoodItem[]
}

export type Meal = {
  id: string
  name: string
  sortOrder: number
  options: Option[]
}

export type FullMealPlan = {
  id: string
  name: string
  planType: 'training' | 'rest' | 'overall'
  notes: string | null
  recommendations: string | null
  updatedAt: string
  meals: Meal[]
}

export type DayLog = {
  id: string
  mealType: string
  foodName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  quantity: number
  unit: string
  mealOptionId: string | null
  templateFoodId: string | null
}

export async function getCurrentClient(): Promise<{ id: string; workspaceId: string; email: string } | null> {
  let email: string | null = null
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const raw = cookieStore.get('dev_mock_email')?.value
    if (raw) email = decodeURIComponent(raw)
  }
  if (!email) {
    try {
      const supabase = await createServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      email = user?.email ?? null
    } catch {
      return null
    }
  }
  if (!email) return null
  return getClientInfo(email)
}

export async function getClientInfo(email: string): Promise<{ id: string; workspaceId: string; email: string } | null> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('clients')
    .select('id, workspace_id, email')
    .eq('email', email)
    .maybeSingle()
  if (error || !data) return null
  return { id: data.id, workspaceId: data.workspace_id, email: data.email }
}

export async function getDateMealOverride(
  clientId: string,
  date: string
): Promise<FullMealPlan | null> {
  // Ignore the caller-supplied id — always act on the session's own client.
  ;({ clientId } = await requireClient())
  const admin = adminClient()
  const { data: override } = await admin
    .from('date_meal_overrides')
    .select('template_id')
    .eq('client_id', clientId)
    .eq('assigned_date', date)
    .maybeSingle()
  if (!override?.template_id) return null

  const { data: template } = await admin
    .from('meal_plan_templates')
    .select(`
      id, name, plan_type, notes, recommendations, created_at,
      meal_plan_meals(
        id, name, sort_order,
        meal_plan_meal_options(
          id, label, sort_order,
          meal_plan_foods(id, food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, sort_order)
        )
      )
    `)
    .eq('id', override.template_id)
    .maybeSingle()
  if (!template) return null

  type RawFood = { id: string; food_name: string; quantity: number; unit: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; sort_order: number }
  type RawOption = { id: string; label: string; sort_order: number; meal_plan_foods: RawFood[] }
  type RawMeal = { id: string; name: string; sort_order: number; meal_plan_meal_options: RawOption[] }

  const rawMeals = ((template.meal_plan_meals as unknown as RawMeal[]) ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)

  return {
    id: template.id,
    name: template.name,
    planType: template.plan_type as 'training' | 'rest' | 'overall',
    notes: template.notes,
    recommendations: template.recommendations,
    updatedAt: template.created_at,
    meals: rawMeals.map((m) => ({
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
    })),
  }
}

export async function getActiveCarbCyclePlan(
  clientId: string,
  date: string
): Promise<{ plan: FullMealPlan; dayType: 'low' | 'high' } | null> {
  ;({ clientId } = await requireClient())
  const admin = adminClient()
  const { data: cycle, error } = await admin
    .from('carb_cycle_assignments')
    .select('low_plan_id, high_plan_id, cycle_start_date, cycle_length')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .maybeSingle()
  if (error || !cycle) return null

  const dayType = resolveCarbCycleDay(cycle.cycle_start_date, date, cycle.cycle_length)
  const templateId = dayType === 'high' ? cycle.high_plan_id : cycle.low_plan_id

  const { data: template } = await admin
    .from('meal_plan_templates')
    .select(`
      id, name, plan_type, notes, recommendations, created_at,
      meal_plan_meals(
        id, name, sort_order,
        meal_plan_meal_options(
          id, label, sort_order,
          meal_plan_foods(id, food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, sort_order)
        )
      )
    `)
    .eq('id', templateId)
    .maybeSingle()
  if (!template) return null

  type RawFood = { id: string; food_name: string; quantity: number; unit: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; sort_order: number }
  type RawOption = { id: string; label: string; sort_order: number; meal_plan_foods: RawFood[] }
  type RawMeal = { id: string; name: string; sort_order: number; meal_plan_meal_options: RawOption[] }

  const rawMeals = ((template.meal_plan_meals as unknown as RawMeal[]) ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)

  return {
    dayType,
    plan: {
      id: template.id,
      name: template.name,
      planType: template.plan_type as 'training' | 'rest' | 'overall',
      notes: template.notes,
      recommendations: template.recommendations,
      updatedAt: template.created_at,
      meals: rawMeals.map((m) => ({
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
      })),
    },
  }
}

export async function getActiveMealPlan(
  clientId: string,
  planType: 'training' | 'rest' | 'overall'
): Promise<FullMealPlan | null> {
  ;({ clientId } = await requireClient())
  const admin = adminClient()
  const { data: assignment, error: aErr } = await admin
    .from('meal_plan_assignments')
    .select('template_id')
    .eq('client_id', clientId)
    .eq('plan_type', planType)
    .eq('is_active', true)
    .maybeSingle()
  if (aErr || !assignment) return null

  // Single nested query replaces 4 sequential queries (template + meals + options + foods)
  const { data: template } = await admin
    .from('meal_plan_templates')
    .select(`
      id, name, plan_type, notes, recommendations, created_at,
      meal_plan_meals(
        id, name, sort_order,
        meal_plan_meal_options(
          id, label, sort_order,
          meal_plan_foods(id, food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, sort_order)
        )
      )
    `)
    .eq('id', assignment.template_id)
    .maybeSingle()
  if (!template) return null

  type RawFood = { id: string; food_name: string; quantity: number; unit: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; sort_order: number }
  type RawOption = { id: string; label: string; sort_order: number; meal_plan_foods: RawFood[] }
  type RawMeal = { id: string; name: string; sort_order: number; meal_plan_meal_options: RawOption[] }

  const rawMeals = ((template.meal_plan_meals as unknown as RawMeal[]) ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)

  return {
    id: template.id,
    name: template.name,
    planType: template.plan_type as 'training' | 'rest' | 'overall',
    notes: template.notes,
    recommendations: template.recommendations,
    updatedAt: template.created_at,
    meals: rawMeals.map((m) => ({
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
    })),
  }
}

export async function getDayLogs(clientId: string, date: string): Promise<DayLog[]> {
  ;({ clientId } = await requireClient())
  const admin = adminClient()
  const { data, error } = await admin
    .from('nutrition_logs')
    .select('id, meal_type, food_name, calories, protein_g, carbs_g, fat_g, quantity, unit, meal_option_id, template_food_id')
    .eq('client_id', clientId)
    .eq('logged_date', date)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map((r) => ({
    id: r.id,
    mealType: r.meal_type,
    foodName: r.food_name,
    calories: Number(r.calories),
    proteinG: Number(r.protein_g),
    carbsG: Number(r.carbs_g),
    fatG: Number(r.fat_g),
    quantity: Number(r.quantity),
    unit: r.unit,
    mealOptionId: r.meal_option_id,
    templateFoodId: r.template_food_id,
  }))
}

export async function logMealOption(payload: {
  clientId: string
  workspaceId: string
  loggedDate: string
  mealType: string
  mealOptionId: string
  foods: Array<{
    templateFoodId: string
    foodName: string
    quantity: number
    unit: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }>
}): Promise<void> {
  // Bind to the session's own client/workspace — never trust the payload ids.
  const ctx = await requireClient()
  payload.clientId = ctx.clientId
  payload.workspaceId = ctx.workspaceId
  const admin = adminClient()
  // Only clear previously-logged PLAN foods for this meal. Custom/external foods
  // (template_food_id IS NULL) the client added themselves must be preserved.
  const { error: dErr } = await admin
    .from('nutrition_logs')
    .delete()
    .eq('client_id', payload.clientId)
    .eq('logged_date', payload.loggedDate)
    .eq('meal_type', payload.mealType)
    .not('template_food_id', 'is', null)
  if (dErr) throw new Error(dErr.message)

  if (payload.foods.length === 0) return
  const rows = payload.foods.map((f) => ({
    client_id: payload.clientId,
    workspace_id: payload.workspaceId,
    logged_date: payload.loggedDate,
    meal_type: payload.mealType,
    meal_option_id: payload.mealOptionId,
    template_food_id: f.templateFoodId,
    food_name: f.foodName,
    quantity: f.quantity,
    unit: f.unit,
    calories: f.calories,
    protein_g: f.proteinG,
    carbs_g: f.carbsG,
    fat_g: f.fatG,
  }))
  const { error: iErr } = await admin.from('nutrition_logs').insert(rows)
  if (iErr) throw new Error(iErr.message)
}

export async function removeOptionLog(
  clientId: string,
  date: string,
  mealType: string,
  planFoodsOnly = true
): Promise<void> {
  ;({ clientId } = await requireClient())
  const admin = adminClient()
  let query = admin
    .from('nutrition_logs')
    .delete()
    .eq('client_id', clientId)
    .eq('logged_date', date)
    .eq('meal_type', mealType)
  // Unchecking a plan meal should only remove its plan foods, leaving any
  // custom/external foods the client added intact. Removing a whole custom
  // meal (planFoodsOnly = false) clears everything under that name.
  if (planFoodsOnly) {
    query = query.not('template_food_id', 'is', null)
  }
  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function logCustomFood(payload: {
  clientId: string
  workspaceId: string
  loggedDate: string
  mealType: string
  foodName: string
  quantity: number
  unit: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}): Promise<void> {
  const ctx = await requireClient()
  payload.clientId = ctx.clientId
  payload.workspaceId = ctx.workspaceId
  const admin = adminClient()
  const { error } = await admin.from('nutrition_logs').insert({
    client_id: payload.clientId,
    workspace_id: payload.workspaceId,
    logged_date: payload.loggedDate,
    meal_type: payload.mealType,
    template_food_id: null,
    food_name: payload.foodName,
    quantity: payload.quantity,
    unit: payload.unit,
    calories: payload.calories,
    protein_g: payload.proteinG,
    carbs_g: payload.carbsG,
    fat_g: payload.fatG,
  })
  if (error) throw new Error(error.message)
}

export async function searchFoodsForClient(query: string): Promise<FoodSearchResult[]> {
  await requireClient()
  const client = adminClient()
  return searchFoodsLib(query, client)
}

export async function lookupBarcode(barcode: string): Promise<FoodSearchResult | null> {
  await requireClient()
  // 1. Check our own database first — includes products clients contributed
  //    manually as well as previously-cached Open Food Facts imports.
  try {
    const admin = adminClient()
    const { data: local } = await admin
      .from('foods')
      .select('name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, external_id')
      .eq('barcode', barcode)
      .maybeSingle()
    if (local) {
      return {
        externalId: local.external_id ?? `off_${barcode}`,
        name: local.name,
        brand: local.brand ?? null,
        caloriesPer100g: Number(local.calories_per_100g ?? 0),
        proteinPer100g: Number(local.protein_per_100g ?? 0),
        carbsPer100g: Number(local.carbs_per_100g ?? 0),
        fatPer100g: Number(local.fat_per_100g ?? 0),
        source: 'custom',
      }
    }
  } catch {
    // fall through to Open Food Facts
  }

  // 2. Fall back to the Open Food Facts public database.
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,brands,nutriments`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      status?: number
      product?: {
        product_name?: string
        brands?: string
        nutriments?: Record<string, number>
      }
    }
    if (!json.product) return null
    const nutriments = json.product.nutriments ?? {}
    const calories = nutriments['energy-kcal_100g']
    const protein = nutriments['proteins_100g']
    const carbs = nutriments['carbohydrates_100g']
    const fat = nutriments['fat_100g']
    if (calories == null || protein == null || carbs == null || fat == null) return null
    return {
      externalId: `off_${barcode}`,
      name: json.product.product_name ?? 'Unknown Product',
      brand: json.product.brands ?? null,
      caloriesPer100g: Number(calories),
      proteinPer100g: Number(protein),
      carbsPer100g: Number(carbs),
      fatPer100g: Number(fat),
      source: 'custom',
    }
  } catch {
    return null
  }
}

/**
 * Client-contributed barcode product. Saves the product to the global `foods`
 * database (so every client benefits from it in future scans) and logs the
 * scanned quantity into the client's day. All nutrition values are per 100g.
 */
export async function addBarcodeFood(payload: {
  clientId: string
  workspaceId: string
  loggedDate: string
  mealType: string
  barcode: string
  name: string
  brand?: string | null
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fiberPer100g?: number | null
  quantity: number
}): Promise<void> {
  const ctx = await requireClient()
  payload.clientId = ctx.clientId
  payload.workspaceId = ctx.workspaceId
  const admin = adminClient()
  const name = payload.name.trim()
  if (!name) throw new Error('Product name is required')

  // Save/refresh the product in the global database, keyed by barcode so the
  // same product scanned again by anyone resolves without a re-entry.
  const { error: fErr } = await admin.from('foods').upsert(
    {
      name,
      brand: payload.brand?.trim() || null,
      calories_per_100g: payload.caloriesPer100g,
      protein_per_100g: payload.proteinPer100g,
      carbs_per_100g: payload.carbsPer100g,
      fat_per_100g: payload.fatPer100g,
      fiber_per_100g: payload.fiberPer100g ?? null,
      source: 'manual',
      barcode: payload.barcode,
      external_id: `off_${payload.barcode}`,
    },
    { onConflict: 'external_id' }
  )
  if (fErr) throw new Error(fErr.message)

  // Log the scanned quantity into the client's day.
  const q = payload.quantity
  const ratio = q / 100
  await logCustomFood({
    clientId: payload.clientId,
    workspaceId: payload.workspaceId,
    loggedDate: payload.loggedDate,
    mealType: payload.mealType,
    foodName: payload.brand?.trim() ? `${name} (${payload.brand.trim()})` : name,
    quantity: q,
    unit: 'g',
    calories: Math.round(payload.caloriesPer100g * ratio * 10) / 10,
    proteinG: Math.round(payload.proteinPer100g * ratio * 10) / 10,
    carbsG: Math.round(payload.carbsPer100g * ratio * 10) / 10,
    fatG: Math.round(payload.fatPer100g * ratio * 10) / 10,
  })
}

export async function deleteNutritionLog(logId: string): Promise<void> {
  const { clientId } = await requireClient()
  const admin = adminClient()
  // Scope the delete to the caller's own client so a log id alone can't be
  // used to delete another client's row.
  const { error } = await admin
    .from('nutrition_logs')
    .delete()
    .eq('id', logId)
    .eq('client_id', clientId)
  if (error) throw new Error(error.message)
}

export async function renameCustomMealLogs(
  clientId: string,
  date: string,
  oldMealType: string,
  newMealType: string
): Promise<void> {
  ;({ clientId } = await requireClient())
  const admin = adminClient()
  const { error } = await admin
    .from('nutrition_logs')
    .update({ meal_type: newMealType })
    .eq('client_id', clientId)
    .eq('logged_date', date)
    .eq('meal_type', oldMealType)
  if (error) throw new Error(error.message)
}

export async function updateNutritionLogQuantity(
  logId: string,
  newQty: number,
): Promise<void> {
  if (!(newQty > 0)) throw new Error('Quantity must be greater than zero')
  const { clientId } = await requireClient()
  const admin = adminClient()

  // Recompute macros server-side from the stored row (never trust caller-sent
  // originals) and only touch the caller's own log.
  const { data: row, error: readErr } = await admin
    .from('nutrition_logs')
    .select('quantity, calories, protein_g, carbs_g, fat_g')
    .eq('id', logId)
    .eq('client_id', clientId)
    .maybeSingle()
  if (readErr) throw new Error(readErr.message)
  if (!row) throw new Error('Log not found')

  const origQty = Number(row.quantity)
  if (!(origQty > 0)) throw new Error('Cannot rescale a zero-quantity log')
  const ratio = newQty / origQty

  const { error } = await admin.from('nutrition_logs').update({
    quantity: newQty,
    calories: Math.round(Number(row.calories) * ratio * 10) / 10,
    protein_g: Math.round(Number(row.protein_g) * ratio * 10) / 10,
    carbs_g: Math.round(Number(row.carbs_g) * ratio * 10) / 10,
    fat_g: Math.round(Number(row.fat_g) * ratio * 10) / 10,
  }).eq('id', logId).eq('client_id', clientId)
  if (error) throw new Error(error.message)
}
