import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/assistant/sessions?client_id=xxx
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return Response.json({ error: 'client_id required' }, { status: 400 })

  const supabase = adminClient()
  const { data, error } = await supabase
    .from('coach_chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ sessions: data })
}

// POST /api/assistant/sessions  { client_id, workspace_id, title, messages }
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    client_id: string
    workspace_id: string
    title?: string
    messages?: unknown[]
  }
  const { client_id, workspace_id, title, messages } = body
  if (!client_id || !workspace_id) {
    return Response.json({ error: 'client_id and workspace_id required' }, { status: 400 })
  }

  const supabase = adminClient()
  const { data, error } = await supabase
    .from('coach_chat_sessions')
    .insert({
      client_id,
      workspace_id,
      title: title ?? 'New conversation',
      messages: messages ?? [],
    })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id })
}
