import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCoach, authErrorResponse, ForbiddenError } from '@/lib/auth'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type Params = { params: Promise<{ id: string }> }

/**
 * Loads the session and asserts it belongs to the calling coach's workspace.
 * Throws Unauthorized/Forbidden (mapped to 401/403 by the caller).
 */
async function requireOwnedSession(id: string) {
  const coach = await requireCoach()
  const supabase = adminClient()
  const { data } = await supabase
    .from('coach_chat_sessions')
    .select('id, workspace_id')
    .eq('id', id)
    .maybeSingle()
  if (!data || data.workspace_id !== coach.workspaceId) {
    throw new ForbiddenError('Session not in your workspace')
  }
  return { supabase }
}

// GET /api/assistant/sessions/[id]  — load full session with messages
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  let supabase
  try {
    ({ supabase } = await requireOwnedSession(id))
  } catch (e) {
    const r = authErrorResponse(e)
    if (r) return r
    throw e
  }

  const { data, error } = await supabase
    .from('coach_chat_sessions')
    .select('id, title, messages, created_at, updated_at')
    .eq('id', id)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json({ session: data })
}

// PATCH /api/assistant/sessions/[id]  { title?, messages? }
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  let supabase
  try {
    ({ supabase } = await requireOwnedSession(id))
  } catch (e) {
    const r = authErrorResponse(e)
    if (r) return r
    throw e
  }

  const body = await req.json() as { title?: string; messages?: unknown[] }

  const update: Record<string, unknown> = {}
  if (body.title !== undefined) update.title = body.title
  if (body.messages !== undefined) update.messages = body.messages

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('coach_chat_sessions')
    .update(update)
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

// DELETE /api/assistant/sessions/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  let supabase
  try {
    ({ supabase } = await requireOwnedSession(id))
  } catch (e) {
    const r = authErrorResponse(e)
    if (r) return r
    throw e
  }

  const { error } = await supabase
    .from('coach_chat_sessions')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
