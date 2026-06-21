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

export type CheckinSnippet = {
  checkinId: string
  submittedAt: string
  metrics: {
    performance: number | null
    nutrition: number | null
    training: number | null
    sleep: number | null
    weight: number | null
  }
}

export type Message = {
  id: string
  conversation_id: string
  workspace_id: string
  sender_role: 'coach' | 'client'
  body: string
  checkin_attachment: CheckinSnippet | null
  read_by_coach: boolean
  read_by_client: boolean
  created_at: string
}

export async function fetchCheckinSnippet(checkinId: string): Promise<CheckinSnippet | null> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('checkins')
    .select('id, submitted_at, answers')
    .eq('id', checkinId)
    .maybeSingle()
  if (error || !data) return null

  const answers = (data.answers ?? {}) as Record<string, unknown>
  function getNum(key: string): number | null {
    const v = answers[key]
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return isNaN(n) ? null : n
  }

  return {
    checkinId: data.id,
    submittedAt: data.submitted_at,
    metrics: {
      performance: getNum('performance_rating'),
      nutrition: getNum('nutrition_adherence'),
      training: getNum('training_adherence'),
      sleep: getNum('sleep_quality'),
      weight: getNum('current_weight'),
    },
  }
}

export async function sendMessage(
  conversationId: string,
  body: string,
  senderRole: 'coach' | 'client',
  checkinAttachment?: CheckinSnippet | null
): Promise<Message> {
  const admin = adminClient()

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
      checkin_attachment: checkinAttachment ?? null,
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
