'use server'

/**
 * Read-only data loaders that back the coach-side PDF exports.
 *
 * Everything here goes through the service-role client, so identity is always
 * resolved from the session via `requireCoach()` and never from an argument.
 */

import { createClient } from '@supabase/supabase-js'
import { requireCoach, assertCoachOwnsClient } from '@/lib/auth'
import type { PdfMealPlan } from '@/lib/pdf/meal-plan'
import type { ProgramPdfInput, PdfWorkoutDay, PdfExercise } from '@/lib/pdf/program'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const FALLBACK_BRAND = 'Mitovski Coaching'

/** Workspace name used as the PDF eyebrow/footer brand. */
export async function getBrandName(): Promise<string> {
  const coach = await requireCoach()
  const admin = adminClient()
  const { data } = await admin
    .from('workspaces')
    .select('name')
    .eq('id', coach.workspaceId)
    .maybeSingle()
  return data?.name?.trim() || FALLBACK_BRAND
}

// ─── Meal plans ──────────────────────────────────────────────────────────────

type RawFood = {
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sort_order: number
}
type RawOption = { label: string; sort_order: number; meal_plan_foods: RawFood[] }
type RawMeal = { name: string; sort_order: number; meal_plan_meal_options: RawOption[] }
type RawTemplate = {
  id: string
  name: string
  plan_type: string
  notes: string | null
  recommendations: string | null
  meal_plan_meals: RawMeal[]
}

const TEMPLATE_SELECT = `
  id, name, plan_type, notes, recommendations,
  meal_plan_meals(
    name, sort_order,
    meal_plan_meal_options(
      label, sort_order,
      meal_plan_foods(food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, sort_order)
    )
  )
`

function toPdfPlan(raw: RawTemplate): PdfMealPlan {
  const planType = raw.plan_type === 'rest' || raw.plan_type === 'overall'
    ? raw.plan_type
    : 'training'

  return {
    name: raw.name,
    planType,
    notes: raw.notes,
    recommendations: raw.recommendations,
    meals: (raw.meal_plan_meals ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        name: m.name,
        options: (m.meal_plan_meal_options ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((o) => ({
            label: o.label,
            foods: (o.meal_plan_foods ?? [])
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((f) => ({
                name: f.food_name,
                quantity: Number(f.quantity),
                unit: f.unit,
                calories: Number(f.calories),
                proteinG: Number(f.protein_g),
                carbsG: Number(f.carbs_g),
                fatG: Number(f.fat_g),
              })),
          })),
      })),
  }
}

export type MealPlanExport = {
  brand: string
  clientName: string | null
  plans: PdfMealPlan[]
}

/** Every active meal plan assigned to a client, ordered training → overall → rest. */
export async function getClientMealPlanExport(clientId: string): Promise<MealPlanExport> {
  const coach = await requireCoach()
  await assertCoachOwnsClient(coach, clientId)
  const admin = adminClient()

  const [clientRes, assignmentRes, brand] = await Promise.all([
    admin.from('clients').select('full_name').eq('id', clientId).maybeSingle(),
    admin
      .from('meal_plan_assignments')
      .select('plan_type, template_id')
      .eq('client_id', clientId)
      .eq('is_active', true),
    getBrandName(),
  ])

  const templateIds = Array.from(
    new Set((assignmentRes.data ?? []).map((a) => a.template_id).filter(Boolean))
  ) as string[]

  let plans: PdfMealPlan[] = []
  if (templateIds.length > 0) {
    const { data, error } = await admin
      .from('meal_plan_templates')
      .select(TEMPLATE_SELECT)
      .in('id', templateIds)
      .eq('workspace_id', coach.workspaceId)
    if (error) throw new Error(error.message)
    plans = ((data ?? []) as unknown as RawTemplate[]).map(toPdfPlan)
  }

  const ORDER: Record<PdfMealPlan['planType'], number> = { training: 0, overall: 1, rest: 2 }
  plans.sort((a, b) => ORDER[a.planType] - ORDER[b.planType])

  return {
    brand,
    clientName: clientRes.data?.full_name ?? null,
    plans,
  }
}

/** A single saved meal-plan template, plus the coach's brand name. */
export async function getMealPlanTemplateExport(templateId: string): Promise<MealPlanExport> {
  const coach = await requireCoach()
  const admin = adminClient()

  const [{ data, error }, brand] = await Promise.all([
    admin
      .from('meal_plan_templates')
      .select(TEMPLATE_SELECT)
      .eq('id', templateId)
      .eq('workspace_id', coach.workspaceId)
      .maybeSingle(),
    getBrandName(),
  ])
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Template not found')

  return { brand, clientName: null, plans: [toPdfPlan(data as unknown as RawTemplate)] }
}

// ─── Training programs ───────────────────────────────────────────────────────

type RawSet = {
  set_number: number
  target_reps: number
  target_weight: string | null
  rpe: string | null
  notes: string | null
}
type RawTemplateExercise = {
  sort_order: number
  target_sets: number
  target_reps: string
  rest_seconds: number
  notes: string | null
  exercises: { name: string; muscle_group: string } | { name: string; muscle_group: string }[] | null
  workout_template_exercise_sets: RawSet[]
}
type RawTemplateDay = {
  id: string
  label: string
  notes: string | null
  workout_templates: { name: string } | { name: string }[] | null
  workout_template_exercises: RawTemplateExercise[]
}
type RawProgramDay = {
  day_of_week: number | null
  cycle_position: number | null
  template_day_id: string | null
  workout_template_days: RawTemplateDay | RawTemplateDay[] | null
}

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function toPdfExercises(day: RawTemplateDay): PdfExercise[] {
  return (day.workout_template_exercises ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => {
      const ex = one(r.exercises)
      const savedSets = (r.workout_template_exercise_sets ?? [])
        .slice()
        .sort((a, b) => a.set_number - b.set_number)
      return {
        name: ex?.name ?? 'Unknown exercise',
        muscleGroup: ex?.muscle_group ?? '',
        targetSets: r.target_sets,
        targetReps: String(r.target_reps ?? ''),
        restSeconds: r.rest_seconds ?? 0,
        notes: r.notes,
        sets: savedSets.length > 0
          ? savedSets.map((s) => ({
              setNumber: s.set_number,
              targetReps: s.target_reps,
              targetWeight: s.target_weight,
              rpe: s.rpe,
              notes: s.notes,
            }))
          : Array.from({ length: r.target_sets }, (_, i) => ({
              setNumber: i + 1,
              targetReps: Number(r.target_reps) || 0,
            })),
      }
    })
}

async function buildProgramExport(programId: string): Promise<ProgramPdfInput> {
  const coach = await requireCoach()
  const admin = adminClient()

  const { data: program, error } = await admin
    .from('workout_programs')
    .select('id, name, is_active, client_id, schedule_type, cycle_start_date, clients(full_name)')
    .eq('id', programId)
    .eq('workspace_id', coach.workspaceId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!program) throw new Error('Program not found')

  const { data: dayRows, error: dayErr } = await admin
    .from('workout_program_days')
    .select(`
      day_of_week, cycle_position, template_day_id,
      workout_template_days(
        id, label, notes,
        workout_templates(name),
        workout_template_exercises(
          sort_order, target_sets, target_reps, rest_seconds, notes,
          exercises(name, muscle_group),
          workout_template_exercise_sets(set_number, target_reps, target_weight, rpe, notes)
        )
      )
    `)
    .eq('program_id', programId)
  if (dayErr) throw new Error(dayErr.message)

  const rows = (dayRows ?? []) as unknown as RawProgramDay[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scheduleType: 'weekly' | 'cyclic' = ((program as any).schedule_type ?? 'weekly') === 'cyclic'
    ? 'cyclic'
    : 'weekly'

  let days: PdfWorkoutDay[]

  if (scheduleType === 'cyclic') {
    days = rows
      .slice()
      .sort((a, b) => (a.cycle_position ?? 0) - (b.cycle_position ?? 0))
      .map((row, i) => {
        const td = one(row.workout_template_days)
        if (!td) {
          return { title: `Day ${(row.cycle_position ?? i) + 1}`, isRest: true, exercises: [] }
        }
        return {
          title: `Day ${(row.cycle_position ?? i) + 1}`,
          label: td.label,
          templateName: one(td.workout_templates)?.name ?? null,
          notes: td.notes,
          exercises: toPdfExercises(td),
          isRest: false,
        }
      })
  } else {
    const byDay = new Map<number, RawProgramDay>()
    for (const row of rows) {
      if (row.day_of_week !== null) byDay.set(row.day_of_week, row)
    }
    days = DAY_NAMES.map((name, i) => {
      const row = byDay.get(i)
      const td = row ? one(row.workout_template_days) : null
      if (!td) return { title: name, isRest: true, exercises: [] }
      return {
        title: name,
        label: td.label,
        templateName: one(td.workout_templates)?.name ?? null,
        notes: td.notes,
        exercises: toPdfExercises(td),
        isRest: false,
      }
    })
  }

  const brand = await getBrandName()
  const client = one(program.clients as unknown as { full_name: string } | { full_name: string }[] | null)

  return {
    brand,
    clientName: client?.full_name ?? null,
    programName: program.name,
    scheduleType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cycleStartDate: (program as any).cycle_start_date ?? null,
    isActive: program.is_active,
    days,
  }
}

/** Full training plan for one program. */
export async function getProgramExport(programId: string): Promise<ProgramPdfInput> {
  return buildProgramExport(programId)
}

/** Full training plan for a client's active program. */
export async function getClientProgramExport(clientId: string): Promise<ProgramPdfInput | null> {
  const coach = await requireCoach()
  await assertCoachOwnsClient(coach, clientId)
  const admin = adminClient()

  const { data } = await admin
    .from('workout_programs')
    .select('id')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return buildProgramExport(data.id)
}
