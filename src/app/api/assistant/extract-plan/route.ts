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

const SYSTEM_PROMPT = `You are a data extractor. Analyze this coaching conversation and determine if it contains a finalized meal plan or training program. If it contains a meal plan, output ONLY a JSON object with \`type: 'meal_plan'\` and a \`plan\` field matching this exact schema: \`{ name, plan_type ('training'|'rest'), notes, recommendations, meals: [{ name, sort_order, options: [{ label, sort_order, foods: [{ food_name, quantity, unit, calories, protein_g, carbs_g, fat_g }] }] }] }\`. If nothing is found output \`{ type: 'none' }\`. Output raw JSON only, no markdown, no explanation.`

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { messages, workspace_id } = body as {
    messages?: Array<{ role: string; content: string }>
    workspace_id?: string
  }

  if (!messages || !workspace_id) {
    return Response.json({ error: 'messages and workspace_id are required' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'Coach' : 'Assistant'}: ${m.content}`)
    .join('\n\n')

  let parsed: { type: string; plan?: unknown }
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: conversationText }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    parsed = JSON.parse(text.trim())
  } catch {
    return Response.json({ error: 'Failed to extract plan from conversation' }, { status: 500 })
  }

  if (parsed.type === 'none' || parsed.type !== 'meal_plan') {
    return Response.json({ type: 'none' })
  }

  const supabase = adminClient()
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, full_name')
    .eq('workspace_id', workspace_id)
    .order('full_name')

  if (clientsError) {
    return Response.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }

  return Response.json({ type: 'meal_plan', plan: parsed.plan, clients: clients ?? [] })
}
