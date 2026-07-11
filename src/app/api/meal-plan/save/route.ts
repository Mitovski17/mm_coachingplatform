import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { requireCoach, assertCoachOwnsClient, authErrorResponse } from '@/lib/auth'

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type MealPlanFood = {
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

type MealPlanOption = {
  label: string
  sort_order: number
  foods: MealPlanFood[]
}

type MealPlanMeal = {
  name: string
  sort_order: number
  options: MealPlanOption[]
}

type MealPlanJSON = {
  name: string
  plan_type: 'training' | 'rest'
  notes: string
  recommendations: string
  meals: MealPlanMeal[]
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { client_id, workspace_id, plan } = body as {
    client_id?: string
    workspace_id?: string
    plan?: MealPlanJSON
  }

  if (!client_id || !workspace_id || !plan) {
    return Response.json({ error: 'client_id, workspace_id, and plan are required' }, { status: 400 })
  }

  try {
    const coach = await requireCoach()
    if (workspace_id !== coach.workspaceId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    await assertCoachOwnsClient(coach, client_id)
  } catch (e) {
    const r = authErrorResponse(e)
    if (r) return r
    throw e
  }

  const supabase = adminClient()

  // Insert template
  const { data: template, error: templateError } = await supabase
    .from('meal_plan_templates')
    .insert({
      workspace_id,
      name: plan.name,
      plan_type: plan.plan_type,
      notes: plan.notes || null,
      recommendations: plan.recommendations || null,
    })
    .select('id')
    .single()

  if (templateError || !template) {
    return Response.json({ error: 'Failed to create template' }, { status: 500 })
  }

  // Insert meals, options, and foods in order
  for (const meal of plan.meals) {
    const { data: mealRow, error: mealError } = await supabase
      .from('meal_plan_meals')
      .insert({
        template_id: template.id,
        name: meal.name,
        sort_order: meal.sort_order,
      })
      .select('id')
      .single()

    if (mealError || !mealRow) {
      return Response.json({ error: 'Failed to create meal' }, { status: 500 })
    }

    for (const option of meal.options) {
      const { data: optionRow, error: optionError } = await supabase
        .from('meal_plan_meal_options')
        .insert({
          meal_id: mealRow.id,
          label: option.label,
          sort_order: option.sort_order,
        })
        .select('id')
        .single()

      if (optionError || !optionRow) {
        return Response.json({ error: 'Failed to create meal option' }, { status: 500 })
      }

      if (option.foods.length > 0) {
        const foodRows = option.foods.map((food, idx) => ({
          option_id: optionRow.id,
          food_name: food.food_name,
          quantity: food.quantity,
          unit: food.unit,
          calories: food.calories,
          protein_g: food.protein_g,
          carbs_g: food.carbs_g,
          fat_g: food.fat_g,
          sort_order: idx,
        }))

        const { error: foodsError } = await supabase.from('meal_plan_foods').insert(foodRows)

        if (foodsError) {
          return Response.json({ error: 'Failed to create foods' }, { status: 500 })
        }
      }
    }
  }

  // Deactivate any existing active assignment for this client + plan_type
  await supabase
    .from('meal_plan_assignments')
    .update({ is_active: false })
    .eq('client_id', client_id)
    .eq('plan_type', plan.plan_type)
    .eq('is_active', true)

  // Create the new active assignment
  const { error: assignError } = await supabase.from('meal_plan_assignments').insert({
    workspace_id,
    client_id,
    template_id: template.id,
    plan_type: plan.plan_type,
    is_active: true,
  })

  if (assignError) {
    return Response.json({ error: 'Failed to assign plan to client' }, { status: 500 })
  }

  return Response.json({ success: true })
}
