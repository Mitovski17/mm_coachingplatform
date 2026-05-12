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

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { message, workspace_id } = body as { message?: string; workspace_id?: string }
  if (!message || !workspace_id) {
    return Response.json({ error: 'message and workspace_id are required' }, { status: 400 })
  }

  const supabase = adminClient()

  // Fetch all clients with their latest check-in
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, full_name, goal')
    .eq('workspace_id', workspace_id)

  if (clientsError) {
    return Response.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }

  // Fetch the latest check-in per client in one query
  const clientIds = (clients ?? []).map((c) => c.id)
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

  const clientSummaries = (clients ?? [])
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

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        const response = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: message }],
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
