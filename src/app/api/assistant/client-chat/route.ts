import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60
import { createClient } from '@supabase/supabase-js'
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Intent detection ───────────────────────────────────────────────────────────

const MEAL_PLAN_KEYWORDS = ['meal plan', 'nutrition plan', 'diet plan', 'eating plan', 'food plan']
const ACTION_KEYWORDS = ['create', 'build', 'make', 'generate', 'design', 'write', 'set up', 'prepare', 'put together', 'develop']

function isMealPlanRequest(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    MEAL_PLAN_KEYWORDS.some((k) => lower.includes(k)) &&
    ACTION_KEYWORDS.some((k) => lower.includes(k))
  )
}

// ── Context builders ───────────────────────────────────────────────────────────

function formatCheckins(
  checkins: Array<Record<string, unknown>>
): string {
  if (!checkins.length) return 'No check-ins on record.'
  return checkins
    .slice(0, 16) // last 16 weeks max
    .map((ci) => {
      const parts: string[] = [`Week of ${ci.week_start_date}`]
      if (ci.weight) parts.push(`Weight: ${ci.weight} kg`)
      if (ci.performance_rating) parts.push(`Performance: ${ci.performance_rating}/10`)
      if (ci.nutrition_adherence) parts.push(`Nutrition adherence: ${ci.nutrition_adherence}/10`)
      if (ci.training_adherence) parts.push(`Training adherence: ${ci.training_adherence}/10`)
      if (ci.sleep_quality) parts.push(`Sleep: ${ci.sleep_quality}/10`)
      if (ci.energy_level) parts.push(`Energy: ${ci.energy_level}`)
      if (ci.stress_level) parts.push(`Stress: ${ci.stress_level}`)
      if (ci.biggest_win) parts.push(`Win: ${ci.biggest_win}`)
      if (ci.biggest_challenge) parts.push(`Challenge: ${ci.biggest_challenge}`)
      if (ci.coach_notes) parts.push(`Coach notes: ${ci.coach_notes}`)
      return parts.join(' | ')
    })
    .join('\n')
}

function formatWorkouts(
  sessions: Array<Record<string, unknown>>
): string {
  if (!sessions.length) return 'No workouts logged.'
  return sessions
    .slice(0, 15)
    .map((s) => {
      const date = (s.performed_at as string)?.split('T')[0] ?? 'unknown date'
      const name = s.name ?? 'Untitled'
      const duration = s.duration_minutes ? `${s.duration_minutes} min` : null
      const setCount = s.set_count ?? 0
      const volume = s.total_volume_kg ? `${Number(s.total_volume_kg).toFixed(0)} kg volume` : null
      const parts = [`${date} — ${name}`]
      if (duration) parts.push(duration)
      if (setCount) parts.push(`${setCount} sets`)
      if (volume) parts.push(volume)
      return parts.join(', ')
    })
    .join('\n')
}

function formatNutrition(
  days: Array<Record<string, unknown>>
): string {
  if (!days.length) return 'No nutrition logged.'
  const logged = days.filter((d) => d.total_calories != null)
  if (!logged.length) return 'No nutrition logged.'
  const avg = (key: string) => {
    const vals = logged.map((d) => Number(d[key])).filter((v) => !isNaN(v))
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }
  const avgCal = avg('total_calories')
  const avgPro = avg('total_protein')
  const avgCarb = avg('total_carbs')
  const avgFat = avg('total_fat')
  const lines = [
    `Logged ${logged.length} of last ${days.length} days`,
    avgCal ? `Avg calories: ${avgCal} kcal` : null,
    avgPro ? `Avg protein: ${avgPro} g` : null,
    avgCarb ? `Avg carbs: ${avgCarb} g` : null,
    avgFat ? `Avg fat: ${avgFat} g` : null,
  ].filter(Boolean)
  return lines.join(' | ')
}

function formatBodyMetrics(
  metrics: Array<Record<string, unknown>>
): string {
  if (!metrics.length) return 'No body metrics recorded.'
  return metrics
    .slice(0, 10)
    .map((m) => {
      const parts: string[] = [m.recorded_date as string]
      if (m.weight) parts.push(`Weight: ${m.weight} kg`)
      if (m.body_fat_pct) parts.push(`Body fat: ${m.body_fat_pct}%`)
      if (m.waist_cm) parts.push(`Waist: ${m.waist_cm} cm`)
      if (m.chest_cm) parts.push(`Chest: ${m.chest_cm} cm`)
      if (m.hips_cm) parts.push(`Hips: ${m.hips_cm} cm`)
      return parts.join(' | ')
    })
    .join('\n')
}

type ClientRow = {
  id: string
  full_name: string
  goal: string | null
  current_weight: number | null
  current_weight_unit: string | null
  desired_weight: number | null
  desired_weight_unit: string | null
  activity_level: string | null
  meals_per_day: number | null
  foods_to_avoid: string | null
  health_notes: string | null
  workspace_id: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof adminClient>

async function buildClientSystemPrompt(
  clientId: string,
  supabase: SupabaseClient
): Promise<{ systemPrompt: string; clientName: string; clientProfile: Record<string, unknown> }> {
  // Load client profile
  const { data: clientRaw } = await supabase
    .from('clients')
    .select(
      'id, full_name, goal, current_weight, current_weight_unit, desired_weight, desired_weight_unit, activity_level, meals_per_day, foods_to_avoid, health_notes, workspace_id'
    )
    .eq('id', clientId)
    .single()

  const client = clientRaw as ClientRow | null

  if (!client) {
    return {
      systemPrompt: 'You are a coaching assistant. No client data is available.',
      clientName: 'Unknown',
      clientProfile: {},
    }
  }

  const clientName = client.full_name

  // Load all check-ins
  const { data: checkins } = await supabase
    .from('checkins')
    .select(
      'week_start_date, weight, performance_rating, nutrition_adherence, training_adherence, sleep_quality, energy_level, stress_level, biggest_win, biggest_challenge, coach_notes, submitted_at'
    )
    .eq('client_id', clientId)
    .order('week_start_date', { ascending: false })
    .limit(20)

  // Load recent workouts with aggregated stats
  const { data: workouts } = await supabase
    .from('workout_sessions')
    .select('name, performed_at, duration_minutes, notes, template_id')
    .eq('client_id', clientId)
    .order('performed_at', { ascending: false })
    .limit(20)

  // Load workout set counts + volume per session
  let workoutsWithStats: Array<Record<string, unknown>> = []
  if (workouts && workouts.length > 0) {
    // Get session IDs for volume calc
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, name, performed_at, duration_minutes')
      .eq('client_id', clientId)
      .order('performed_at', { ascending: false })
      .limit(20)

    if (sessions) {
      type SessionRow = { id: string; name: string | null; performed_at: string; duration_minutes: number | null }
      const typedSessions = sessions as SessionRow[]
      const sessionIds = typedSessions.map((s) => s.id)

      const { data: setsRaw } = await supabase
        .from('workout_sets')
        .select('session_id, reps, weight_kg')
        .in('session_id', sessionIds)

      type SetRow = { session_id: string; reps: number | null; weight_kg: number | null }
      const sets = setsRaw as SetRow[] | null

      const statsMap: Record<string, { setCount: number; totalVolume: number }> = {}
      for (const id of sessionIds) statsMap[id] = { setCount: 0, totalVolume: 0 }
      if (sets) {
        for (const s of sets) {
          if (!statsMap[s.session_id]) continue
          statsMap[s.session_id].setCount++
          const vol = (s.reps ?? 0) * (s.weight_kg ?? 0)
          statsMap[s.session_id].totalVolume += vol
        }
      }

      workoutsWithStats = typedSessions.map((s) => ({
        ...s,
        set_count: statsMap[s.id]?.setCount ?? 0,
        total_volume_kg: statsMap[s.id]?.totalVolume ?? 0,
      }))
    } else {
      workoutsWithStats = (workouts as Array<Record<string, unknown>>) ?? []
    }
  }

  // Load last 30 days nutrition (from nutrition_logs, grouped by date)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const { data: nutritionLogsRaw } = await supabase
    .from('nutrition_logs')
    .select('logged_date, calories, protein_g, carbs_g, fat_g')
    .eq('client_id', clientId)
    .gte('logged_date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('logged_date', { ascending: false })

  // Aggregate nutrition_logs into per-day totals
  type NutritionLogRow = { logged_date: string; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }
  const nutritionLogs = (nutritionLogsRaw ?? []) as NutritionLogRow[]
  const dayMap = new Map<string, { total_calories: number; total_protein: number; total_carbs: number; total_fat: number }>()
  for (const row of nutritionLogs) {
    const key = row.logged_date
    const cur = dayMap.get(key) ?? { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 }
    cur.total_calories += row.calories ?? 0
    cur.total_protein += row.protein_g ?? 0
    cur.total_carbs += row.carbs_g ?? 0
    cur.total_fat += row.fat_g ?? 0
    dayMap.set(key, cur)
  }
  const nutritionDays = Array.from(dayMap.entries()).map(([date, totals]) => ({ date, ...totals }))

  // Load body metrics
  const { data: bodyMetrics } = await supabase
    .from('body_metrics')
    .select('recorded_date, weight, body_fat_pct, waist_cm, chest_cm, hips_cm')
    .eq('client_id', clientId)
    .order('recorded_date', { ascending: false })
    .limit(10)

  // Load current program assignment
  const { data: programRow } = await supabase
    .from('workout_programs')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .maybeSingle()
  const programName = (programRow as { id: string; name: string } | null)?.name ?? null

  // Load meal plan assignments
  const { data: mealAssignments } = await supabase
    .from('meal_plan_assignments')
    .select('plan_type, template_id, meal_plan_templates(id, name)')
    .eq('client_id', clientId)
    .eq('is_active', true)

  type MealAssignRow = { plan_type: string; template_id: string; meal_plan_templates: { id: string; name: string } | null }
  let trainingPlanName: string | null = null
  let restPlanName: string | null = null
  for (const a of (mealAssignments ?? []) as unknown as MealAssignRow[]) {
    const tplName = a.meal_plan_templates?.name ?? null
    if (!tplName) continue
    if (a.plan_type === 'training') trainingPlanName = tplName
    else if (a.plan_type === 'rest') restPlanName = tplName
  }

  const currentWeight = client.current_weight
    ? String(client.current_weight) + ' ' + (client.current_weight_unit ?? 'kg')
    : 'Not recorded'
  const desiredWeight = client.desired_weight
    ? String(client.desired_weight) + ' ' + (client.desired_weight_unit ?? 'kg')
    : 'Not recorded'
  const checkinRows = (checkins ?? []) as Array<Record<string, unknown>>
  const nutritionRows = nutritionDays as Array<Record<string, unknown>>
  const metricsRows = (bodyMetrics ?? []) as Array<Record<string, unknown>>

  const systemPrompt = [
    `You are an expert AI coaching assistant helping coach Martin work with his client, ${clientName}.`,
    '',
    'You have full access to all data for this client. Use it to give detailed, specific, and actionable coaching insights. When asked about meal plans or nutrition adjustments, you can propose specific changes with macros. When asked about training, reference their actual workout history. Always be specific and data-driven.',
    '',
    '=== CLIENT PROFILE ===',
    `Name: ${clientName}`,
    `Goal: ${client.goal ?? 'Not specified'}`,
    `Current weight: ${currentWeight}`,
    `Desired weight: ${desiredWeight}`,
    `Activity level: ${client.activity_level ?? 'Not specified'}`,
    `Meals per day: ${client.meals_per_day ?? 'Not specified'}`,
    `Foods to avoid: ${client.foods_to_avoid ?? 'None'}`,
    `Health notes: ${client.health_notes ?? 'None'}`,
    '',
    '=== CURRENT ASSIGNMENTS ===',
    `Workout program: ${programName ?? 'None assigned'}`,
    `Training day meal plan: ${trainingPlanName ?? 'None assigned'}`,
    `Rest day meal plan: ${restPlanName ?? 'None assigned'}`,
    '',
    '=== CHECK-IN HISTORY (most recent first) ===',
    formatCheckins(checkinRows),
    '',
    '=== WORKOUT HISTORY (most recent first) ===',
    formatWorkouts(workoutsWithStats),
    '',
    '=== NUTRITION - LAST 30 DAYS ===',
    formatNutrition(nutritionRows),
    '',
    '=== BODY METRICS HISTORY ===',
    formatBodyMetrics(metricsRows),
    '',
    '=== INSTRUCTIONS ===',
    '- Be specific and reference actual numbers from this client\'s data',
    '- When asked about meal plan changes, propose concrete macros and food suggestions',
    '- When asked about training, reference their recent workout patterns',
    '- When asked for a check-in response, write a personalised message to the client',
    '- Flag any concerning trends (compliance drops, weight stalls, low energy)',
    '- Keep responses practical and actionable for the coach',
  ].join('\n')

  return { systemPrompt, clientName, clientProfile: client as Record<string, unknown> }
}

function buildMealPlanPrompt(
  clientProfile: Record<string, unknown>,
  clientName: string,
  coachRequest: string
): string {
  const w = clientProfile.current_weight
    ? `${clientProfile.current_weight} ${clientProfile.current_weight_unit ?? 'kg'}`
    : 'not recorded'
  const dw = clientProfile.desired_weight
    ? `${clientProfile.desired_weight} ${clientProfile.desired_weight_unit ?? 'kg'}`
    : 'not recorded'

  return `Generate a complete meal plan for the following client.

**Client Profile**
- Name: ${clientName}
- Goal: ${clientProfile.goal ?? 'Not specified'}
- Current weight: ${w}
- Desired weight: ${dw}
- Activity level: ${clientProfile.activity_level ?? 'Not specified'}
- Meals per day: ${clientProfile.meals_per_day ?? 'Not specified'}
- Foods to avoid: ${clientProfile.foods_to_avoid ?? 'None'}
- Health notes: ${clientProfile.health_notes ?? 'None'}

**Coach's request:** ${coachRequest}

Write a well-formatted markdown preview of the full plan: show each meal, each option (A/B/C), every food with quantity and macros, and a per-meal macro total.`
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    messages: incomingMessages,
    client_id: clientId,
    workspace_id: workspaceId,
  } = body as {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>
    client_id?: string
    workspace_id?: string
  }

  if (!incomingMessages || incomingMessages.length === 0 || !clientId || !workspaceId) {
    return Response.json({ error: 'messages, client_id, and workspace_id are required' }, { status: 400 })
  }

  const lastUserMessage =
    [...incomingMessages].reverse().find((m) => m.role === 'user')?.content ?? ''

  const supabase = adminClient()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const { systemPrompt, clientName, clientProfile } = await buildClientSystemPrompt(clientId, supabase)

  // ── Meal plan intent → streaming markdown preview ──────────────────────────
  if (isMealPlanRequest(lastUserMessage)) {
    const userPrompt = buildMealPlanPrompt(clientProfile, clientName, lastUserMessage)

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const response = await anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: `You are a professional sports nutritionist and certified fitness coach. Provide precise macros, realistic food choices, and practical guidance.`,
            messages: [{ role: 'user', content: userPrompt }],
          })
          for await (const chunk of response) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error'
          controller.enqueue(encoder.encode(`\n[Error: ${msg}]`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'X-Is-Meal-Plan': 'true',
        'X-Client-Id': clientId,
        'X-Client-Name': encodeURIComponent(clientName),
      },
    })
  }

  // ── Regular chat ───────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        const response = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: systemPrompt,
          messages: incomingMessages,
        })
        for await (const chunk of response) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`\n[Error: ${msg}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}
