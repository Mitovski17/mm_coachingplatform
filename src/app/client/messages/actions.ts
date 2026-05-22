'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type Message = {
  id: string
  conversation_id: string
  workspace_id: string
  sender_role: 'coach' | 'client'
  body: string
  read_by_coach: boolean
  read_by_client: boolean
  created_at: string
}

export async function getOrCreateConversation(
  clientId: string,
  workspaceId: string,
  coachId: string
): Promise<string> {
  const admin = adminClient()

  // Upsert: one conversation per client per workspace
  const { data, error } = await admin
    .from('conversations')
    .upsert(
      { workspace_id: workspaceId, client_id: clientId, coach_id: coachId },
      { onConflict: 'workspace_id,client_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

export async function sendMessage(
  conversationId: string,
  body: string
): Promise<Message> {
  const admin = adminClient()

  const { data: convo, error: convoErr } = await admin
    .from('conversations')
    .select('workspace_id, coach_id, client_id, clients(full_name)')
    .eq('id', conversationId)
    .single()
  if (convoErr || !convo) throw new Error('Conversation not found')

  const { data, error } = await admin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      workspace_id: convo.workspace_id,
      sender_role: 'client',
      body: body.trim(),
      read_by_coach: false,
      read_by_client: true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const clientName = (convo.clients as unknown as { full_name: string } | null)?.full_name ?? 'A client'
  await createNotification({
    workspaceId: convo.workspace_id,
    recipientType: 'coach',
    recipientId: convo.coach_id,
    type: 'new_message',
    title: 'New message',
    body: `${clientName}: ${body.trim().slice(0, 80)}`,
    link: `/coach/messages/${convo.client_id}`,
  })

  return data as Message
}

export async function markMessagesRead(conversationId: string): Promise<void> {
  const admin = adminClient()
  await admin
    .from('messages')
    .update({ read_by_client: true })
    .eq('conversation_id', conversationId)
    .eq('sender_role', 'coach')
    .eq('read_by_client', false)
}
