import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type MealPlanJSON = {
  name: string
  plan_type: 'training' | 'rest'
  notes: string
  recommendations: string
  meals: Array<{
    name: string
    sort_order: number
    options: Array<{
      label: string
      sort_order: number
      foods: Array<{
        food_name: string
        quantity: number
        unit: string
        calories: number
        protein_g: number
        carbs_g: number
        fat_g: number
      }>
    }>
  }>
}

const MEAL_PLAN_KEYWORDS = ['meal plan', 'nutrition plan', 'diet plan', 'eating plan', 'food plan']
const ACTION_KEYWORDS = ['create', 'build', 'make', 'generate', 'design', 'write', 'set up', 'prepare', 'put together', 'develop']

function isMealPlanRequest(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    MEAL_PLAN_KEYWORDS.some((k) => lower.includes(k)) &&
    ACTION_KEYWORDS.some((k) => lower.includes(k))
  )
}

function findClientInMessage(
  message: string,
  clients: Array<{ id: string; full_name: string }>
): { id: string; full_name: string } | null {
  const lower = message.toLowerCase()
  // Prefer full-name match
  for (const c of clients) {
    if (lower.includes(c.full_name.toLowerCase())) return c
  }
  // Fall back to first-name match (>2 chars to avoid false positives)
  for (const c of clients) {
    const first = c.full_name.split(' ')[0].toLowerCase()
    if (first.length > 2 && lower.includes(first)) return c
  }
  return null
}

function buildMealPlanSystemPrompt(): string {
  return `You are a professional sports nutritionist and certified fitness coach. Provide precise macros, realistic food choices, and practical guidance.`
}

function buildNewPlanPrompt(
  clientProfile: Record<string, unknown>,
  clientName: string,
  coachRequest: string
): string {
  const w = clientProfile.current_weight
    ? `${clientProfile.current_weight} ${clientProfile.current_weight_unit ?? ''}`
    : 'not recorded'
  const dw = clientProfile.desired_weight
    ? `${clientProfile.desired_weight} ${clientProfile.desired_weight_unit ?? ''}`
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

function buildRefinementPrompt(draft: MealPlanJSON, feedback: string): string {
  return `The coach wants to revise this meal plan based on new feedback.

**Current meal plan:**
${JSON.stringify(draft, null, 2)}

**Coach's feedback:** ${feedback}

Apply the feedback and write a well-formatted markdown preview of the revised plan showing each meal, each option, every food with quantity and macros, and per-meal macro totals.`
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    messages: incomingMessages,
    workspace_id,
    draft_plan,
    client_id: draftClientId,
  } = body as {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>
    workspace_id?: string
    draft_plan?: MealPlanJSON
    client_id?: string
  }

  if (!incomingMessages || incomingMessages.length === 0 || !workspace_id) {
    return Response.json({ error: 'messages and workspace_id are required' }, { status: 400 })
  }

  const lastUserMessage =
    [...incomingMessages].reverse().find((m) => m.role === 'user')?.content ?? ''

  const supabase = adminClient()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // ── Meal plan refinement mode ───────────────────────────────────────────────
  if (draft_plan && draftClientId) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id, full_name')
      .eq('id', draftClientId)
      .single()

    const clientName = clientRow?.full_name ?? 'the client'
    const userPrompt = buildRefinementPrompt(draft_plan, lastUserMessage)

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const response = await anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: buildMealPlanSystemPrompt(),
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
        'X-Meal-Plan-Client-Id': draftClientId,
        'X-Meal-Plan-Client-Name': encodeURIComponent(clientName),
      },
    })
  }

  // ── Fetch clients for workspace ─────────────────────────────────────────────
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select(
      'id, full_name, goal, current_weight, current_weight_unit, desired_weight, desired_weight_unit, activity_level, meals_per_day, foods_to_avoid, health_notes'
    )
    .eq('workspace_id', workspace_id)

  if (clientsError) {
    return Response.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }

  const clientList = clients ?? []

  // ── New meal plan intent detection ─────────────────────────────────────────
  if (isMealPlanRequest(lastUserMessage)) {
    const matchedClient = findClientInMessage(lastUserMessage, clientList)

    if (matchedClient) {
      const clientProfile = clientList.find((c) => c.id === matchedClient.id) ?? {}
      const userPrompt = buildNewPlanPrompt(
        clientProfile as Record<string, unknown>,
        matchedClient.full_name,
        lastUserMessage
      )

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          try {
            const response = await anthropic.messages.stream({
              model: 'claude-sonnet-4-6',
              max_tokens: 4096,
              system: buildMealPlanSystemPrompt(),
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
          'X-Meal-Plan-Client-Id': matchedClient.id,
          'X-Meal-Plan-Client-Name': encodeURIComponent(matchedClient.full_name),
        },
      })
    }
    // Client not found — fall through to normal chat so assistant can ask for clarification
  }

  // ── Normal chat mode ────────────────────────────────────────────────────────
  const clientIds = clientList.map((c) => c.id)
  let latestCheckinsByClient: Record<string, string> = {}

  if (clientIds.length > 0) {
    const { data: checkins } = await supabase
      .from('checkins')
      .select('client_id, week_start_date, coach_notes, answers')
      .in('client_id', clientIds)
      .eq('workspace_id', workspace_id)
      .order('week_start_date', { ascending: false })

    if (checkins) {
      for (const ci of checkins) {
        if (latestCheckinsByClient[ci.client_id]) continue
        const parts: string[] = [`Week of ${ci.week_start_date}`]
        if (ci.coach_notes) parts.push(`Coach notes: ${ci.coach_notes}`)
        const answers = ci.answers as Record<string, unknown> | null
        if (answers && typeof answers === 'object') {
          const pairs = Object.entries(answers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('; ')
          if (pairs) parts.push(`Responses: ${pairs}`)
        }
        latestCheckinsByClient[ci.client_id] = parts.join(' | ')
      }
    }
  }

  const clientSummaries = clientList
    .map((c) => {
      const lines = [`- ${c.full_name}`]
      if (c.goal) lines.push(`  Goal: ${c.goal}`)
      const checkin = latestCheckinsByClient[c.id]
      if (checkin) lines.push(`  Latest check-in: ${checkin}`)
      return lines.join('\n')
    })
    .join('\n\n')

  const systemPrompt = `You are an AI assistant helping a fitness coach manage their clients. You have access to the following client data for this workspace:

${clientSummaries || 'No clients found for this workspace.'}

Use this context to give the coach accurate, personalised advice about their clients. Be concise and practical.`

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        const response = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: incomingMessages,
        })

        for await (const chunk of response) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
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
