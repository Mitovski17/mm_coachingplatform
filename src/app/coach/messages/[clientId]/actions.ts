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

export async function sendMessage(
  conversationId: string,
  body: string,
  senderRole: 'coach' | 'client'
): Promise<Message> {
  const admin = adminClient()

  // Get workspace_id from conversation
  const { data: convo, error: convoErr } = await admin
    .from('conversations')
    .select('workspace_id, client_id, profiles(full_name)')
    .eq('id', conversationId)
    .single()
  if (convoErr || !convo) throw new Error('Conversation not found')

  const { data, error } = await admin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      workspace_id: convo.workspace_id,
      sender_role: senderRole,
      body: body.trim(),
      read_by_coach: senderRole === 'coach',
      read_by_client: senderRole === 'client',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  if (senderRole === 'coach') {
    const coachName = (convo.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Your coach'
    await createNotification({
      workspaceId: convo.workspace_id,
      recipientType: 'client',
      recipientId: convo.client_id,
      type: 'new_message',
      title: 'New message from your coach',
      body: `${coachName}: ${body.trim().slice(0, 80)}`,
      link: '/client/messages',
    })
  }

  return data as Message
}

export async function markMessagesRead(
  conversationId: string,
  readerRole: 'coach' | 'client'
): Promise<void> {
  const admin = adminClient()
  const field = readerRole === 'coach' ? 'read_by_coach' : 'read_by_client'
  const senderRole = readerRole === 'coach' ? 'client' : 'coach'

  await admin
    .from('messages')
    .update({ [field]: true })
    .eq('conversation_id', conversationId)
    .eq('sender_role', senderRole)
    .eq(field, false)
}
