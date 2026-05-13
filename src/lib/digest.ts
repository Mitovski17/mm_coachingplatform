import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'

export interface DigestShape {
  summary: string
  wins: string[]
  concerns: string[]
  actions: string[]
  suggested_response: string
  rag_status: 'red' | 'yellow' | 'green'
}

export function getCurrentSunday(): string {
  const now = new Date()
  const day = now.getDay()
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - day)
  return sunday.toISOString().split('T')[0]
}

export type GenerateDigestResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }

export async function generateDigestForClient(
  client_id: string
): Promise<GenerateDigestResult> {
  const supabase = createServiceClient()

  const [clientResult, checkinsResult, digestsResult] = await Promise.all([
    supabase.from('clients').select('*').eq('id', client_id).single(),
    supabase
      .from('checkins')
      .select('*')
      .eq('client_id', client_id)
      .order('week_start_date', { ascending: false })
      .limit(4),
    supabase
      .from('ai_digests')
      .select('*')
      .eq('client_id', client_id)
      .order('week_start_date', { ascending: false })
      .limit(4),
  ])

  if (clientResult.error || !clientResult.data) {
    return { ok: false, error: 'Client not found' }
  }

  const clientData = clientResult.data
  const checkins = checkinsResult.data ?? []
  const pastDigests = digestsResult.data ?? []

  const prompt = `You are an expert fitness coach assistant. Analyze the following client data and produce a weekly digest.

## Client Profile
Name: ${clientData.full_name}
Goal: ${clientData.goal ?? 'Not specified'}
Current weight: ${clientData.current_weight != null ? `${clientData.current_weight} ${clientData.current_weight_unit ?? ''}` : 'Not specified'}
Desired weight: ${clientData.desired_weight != null ? `${clientData.desired_weight} ${clientData.desired_weight_unit ?? ''}` : 'Not specified'}
Activity level: ${clientData.activity_level ?? 'Not specified'}
Training location: ${clientData.training_location ?? 'Not specified'}
Training days per week: ${clientData.training_days_per_week ?? 'Not specified'}
Preferred training time: ${clientData.preferred_training_time ?? 'Not specified'}
Meals per day: ${clientData.meals_per_day ?? 'Not specified'}
Health notes: ${clientData.health_notes ?? 'None'}
Foods to avoid: ${clientData.foods_to_avoid ?? 'None'}
Occupation notes: ${clientData.occupation_notes ?? 'None'}
Notes: ${clientData.notes ?? 'None'}

## Last ${checkins.length} Check-ins (most recent first)
${
  checkins.length === 0
    ? 'No check-ins recorded yet.'
    : checkins
        .map(
          (c, i) => `### Check-in ${i + 1} (week of ${c.week_start_date})
Status: ${c.status}
Answers: ${JSON.stringify(c.answers, null, 2)}
Coach notes: ${c.coach_notes ?? 'None'}`
        )
        .join('\n\n')
}

## Previous AI Digests for Context
${
  pastDigests.length === 0
    ? 'No previous digests.'
    : pastDigests
        .map(
          (d, i) => `### Digest ${i + 1} (week of ${d.week_start_date})
RAG status: ${d.rag_status}
Summary: ${d.summary}`
        )
        .join('\n\n')
}

## Instructions
Based on the above, produce a weekly coaching digest. Be specific, actionable, and empathetic.

For rag_status:
- "green": client is on track, making progress, no major concerns
- "yellow": some concerns or inconsistencies that need attention
- "red": significant issues — missed check-ins, regression, health concerns, or disengagement

Respond with ONLY valid JSON matching this exact shape:
{
  "summary": "2-3 sentence overview of the client's week and overall trajectory",
  "wins": ["specific win 1", "specific win 2"],
  "concerns": ["specific concern 1"],
  "actions": ["actionable step for coach 1", "actionable step for coach 2"],
  "suggested_response": "A warm, personalized message the coach can send directly to the client (2-4 sentences)",
  "rag_status": "green" | "yellow" | "red"
}`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let digestData: DigestShape
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    const jsonText = content.text.trim().replace(/^```json\s*|```\s*$/g, '')
    digestData = JSON.parse(jsonText) as DigestShape

    if (
      typeof digestData.summary !== 'string' ||
      !Array.isArray(digestData.wins) ||
      !Array.isArray(digestData.concerns) ||
      !Array.isArray(digestData.actions) ||
      typeof digestData.suggested_response !== 'string' ||
      !['red', 'yellow', 'green'].includes(digestData.rag_status)
    ) {
      throw new Error('Claude response did not match expected shape')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: `Failed to generate digest: ${msg}` }
  }

  const week_start_date = getCurrentSunday()

  const { data: saved, error: saveError } = await supabase
    .from('ai_digests')
    .upsert(
      {
        client_id,
        workspace_id: clientData.workspace_id,
        week_start_date,
        summary: digestData.summary,
        wins: digestData.wins,
        concerns: digestData.concerns,
        actions: digestData.actions,
        suggested_response: digestData.suggested_response,
        rag_status: digestData.rag_status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,week_start_date' }
    )
    .select()
    .single()

  if (saveError || !saved) {
    return { ok: false, error: saveError?.message ?? 'Failed to save digest' }
  }

  return { ok: true, data: saved as Record<string, unknown> }
}
