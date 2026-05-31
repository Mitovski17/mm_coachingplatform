import { SupabaseClient } from '@supabase/supabase-js'

export interface FoodSearchResult {
  externalId: string | null
  name: string
  brand: string | null
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  source: 'custom' | 'usda'
}

async function searchLocalFoods(
  query: string,
  adminClient: SupabaseClient
): Promise<FoodSearchResult[]> {
  if (!query || query.trim().length < 2) return []

  const { data, error } = await adminClient
    .from('foods')
    .select('id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, external_id, source')
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(15)

  if (error) return []

  const rows = (data ?? []).sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1
    const bStarts = b.name.toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1
    if (aStarts !== bStarts) return aStarts - bStarts
    return a.name.localeCompare(b.name)
  })

  return rows.map((f) => ({
    externalId: f.external_id ?? null,
    name: f.name,
    brand: f.brand ?? null,
    caloriesPer100g: Number(f.calories_per_100g ?? 0),
    proteinPer100g: Number(f.protein_per_100g ?? 0),
    carbsPer100g: Number(f.carbs_per_100g ?? 0),
    fatPer100g: Number(f.fat_per_100g ?? 0),
    source: 'custom' as const,
  }))
}

type USDAFood = {
  fdcId: number
  description: string
  foodNutrients: Array<{ nutrientId: number; value: number }>
}

async function searchUSDA(query: string): Promise<FoodSearchResult[]> {
  const apiKey = process.env.USDA_API_KEY
  if (!apiKey) return []

  let foods: USDAFood[] = []
  try {
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search` +
      `?query=${encodeURIComponent(query)}` +
      `&api_key=${apiKey}` +
      `&dataType=Foundation,SR%20Legacy` +
      `&pageSize=10`
    const res = await fetch(url)
    if (!res.ok) return []
    const json = (await res.json()) as { foods?: USDAFood[] }
    foods = json.foods ?? []
  } catch {
    return []
  }

  const results: FoodSearchResult[] = []
  for (const food of foods) {
    const nutrient = (id: number) =>
      food.foodNutrients.find((n) => n.nutrientId === id)?.value ?? 0

    const calories = nutrient(1008)
    if (!calories) continue

    results.push({
      externalId: `usda_${food.fdcId}`,
      name: food.description,
      brand: null,
      caloriesPer100g: calories,
      proteinPer100g: nutrient(1003),
      carbsPer100g: nutrient(1005),
      fatPer100g: nutrient(1004),
      source: 'usda' as const,
    })

    if (results.length >= 8) break
  }

  return results
}

export async function searchFoods(
  query: string,
  adminClient: SupabaseClient
): Promise<FoodSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const local = await searchLocalFoods(trimmed, adminClient)
  if (local.length >= 5) return local

  const usda = await searchUSDA(trimmed)

  const localNamesLower = new Set(local.map((r) => r.name.toLowerCase()))
  const merged = [...local]
  for (const r of usda) {
    if (!localNamesLower.has(r.name.toLowerCase())) {
      merged.push(r)
    }
  }

  return merged.slice(0, 12)
}

export async function upsertFood(
  result: FoodSearchResult,
  adminClient: SupabaseClient
): Promise<string> {
  if (result.externalId) {
    const { data, error } = await adminClient
      .from('foods')
      .upsert(
        {
          name: result.name,
          brand: result.brand,
          calories_per_100g: result.caloriesPer100g,
          protein_per_100g: result.proteinPer100g,
          carbs_per_100g: result.carbsPer100g,
          fat_per_100g: result.fatPer100g,
          source: result.source,
          external_id: result.externalId,
        },
        { onConflict: 'external_id' }
      )
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Failed to upsert food')
    return data.id
  }

  // Return existing manual food with the same name instead of creating a duplicate
  const { data: existing } = await adminClient
    .from('foods')
    .select('id')
    .ilike('name', result.name)
    .eq('source', 'manual')
    .maybeSingle()
  if (existing) return existing.id

  const { data, error } = await adminClient
    .from('foods')
    .insert({
      name: result.name,
      brand: result.brand,
      calories_per_100g: result.caloriesPer100g,
      protein_per_100g: result.proteinPer100g,
      carbs_per_100g: result.carbsPer100g,
      fat_per_100g: result.fatPer100g,
      source: 'manual',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to insert food')
  return data.id
}
