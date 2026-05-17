import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export const maxDuration = 60

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { message, workspace_id } = body as {
    message?: string
    workspace_id?: string
    conversation_history?: Array<{ role: string; content: string }>
  }

  if (!message || !workspace_id) {
    return Response.json({ error: 'message and workspace_id are required' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const supabase = adminClient()

  // Step 1: Extract client name from message
  const nameResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 50,
    temperature: 0,
    system: "Extract only the client name from this message, respond with just the name or 'unknown'",
    messages: [{ role: 'user', content: message }],
  })

  const extractedName = (nameResponse.content[0] as { text: string }).text.trim()

  if (!extractedName || extractedName.toLowerCase() === 'unknown') {
    return Response.json({ error: 'Could not identify a client name in your message' }, { status: 422 })
  }

  // Step 2: Look up client by name (case-insensitive)
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select(
      'id, full_name, goal, current_weight, current_weight_unit, desired_weight, desired_weight_unit, meals_per_day, foods_to_avoid, health_notes, activity_level'
    )
    .eq('workspace_id', workspace_id)
    .ilike('full_name', `%${extractedName}%`)

  if (clientsError) {
    return Response.json({ error: 'Failed to search clients' }, { status: 500 })
  }

  const client = clients?.[0]
  if (!client) {
    return Response.json(
      { error: `Client "${extractedName}" not found in your workspace` },
      { status: 404 }
    )
  }

  const w = client.current_weight
    ? `${client.current_weight} ${client.current_weight_unit ?? ''}`.trim()
    : 'not recorded'
  const dw = client.desired_weight
    ? `${client.desired_weight} ${client.desired_weight_unit ?? ''}`.trim()
    : 'not recorded'

  // Step 3: Generate structured meal plan
  const planResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    temperature: 0,
    system:
      'You are a nutrition expert. Output ONLY a JSON object, no markdown, no explanation, nothing else.',
    messages: [
      {
        role: 'user',
        content: `Generate a complete meal plan for this client.

Client Profile:
- Name: ${client.full_name}
- Goal: ${client.goal ?? 'Not specified'}
- Current weight: ${w}
- Desired weight: ${dw}
- Activity level: ${client.activity_level ?? 'Not specified'}
- Meals per day: ${client.meals_per_day ?? 'Not specified'}
- Foods to avoid: ${client.foods_to_avoid ?? 'None'}
- Health notes: ${client.health_notes ?? 'None'}

Coach's request: ${message}

Output a JSON object with this exact schema (no other text):
{
  "name": "string",
  "plan_type": "training",
  "notes": "string",
  "recommendations": "string",
  "display_summary": "human readable markdown summary of the plan for the coach to read",
  "meals": [
    {
      "name": "string",
      "sort_order": 0,
      "options": [
        {
          "label": "Option A",
          "sort_order": 0,
          "foods": [
            {
              "food_name": "string",
              "quantity": 0,
              "unit": "string",
              "calories": 0,
              "protein_g": 0,
              "carbs_g": 0,
              "fat_g": 0
            }
          ]
        }
      ]
    }
  ]
}`,
      },
    ],
  })

  const rawText = (planResponse.content[0] as { text: string }).text.trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawText)
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/)
    if (!match) {
      return Response.json({ error: 'Failed to parse generated meal plan' }, { status: 500 })
    }
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return Response.json({ error: 'Failed to parse generated meal plan' }, { status: 500 })
    }
  }

  const { display_summary, ...plan } = parsed

  return Response.json({
    display_summary,
    plan,
    client_id: client.id,
    client_name: client.full_name,
  })
}
