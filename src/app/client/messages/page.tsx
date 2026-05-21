export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import ThreadClient from './ThreadClient'
import { getOrCreateConversation, markMessagesRead, type Message } from './actions'

async function resolveEmail(): Promise<string | null> {
  if (process.env.NODE_ENV === 'development') {
    const cs = await cookies()
    const raw = cs.get('dev_mock_email')?.value
    if (raw) return decodeURIComponent(raw)
  }
  try {
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    return user?.email ?? null
  } catch {
    return null
  }
}

async function fetchThread(): Promise<{
  conversationId: string
  coachName: string
  initialMessages: Message[]
} | null> {
  const email = await resolveEmail()
  if (!email) redirect('/login')

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Resolve client record
  const { data: clientRow } = await admin
    .from('clients')
    .select('id, workspace_id, coach_id')
    .eq('email', email)
    .maybeSingle()

  if (!clientRow) redirect('/login')

  // Get or create conversation
  const conversationId = await getOrCreateConversation(
    clientRow.id,
    clientRow.workspace_id,
    clientRow.coach_id
  )

  // Fetch messages
  const { data: messages } = await admin
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(50)

  // Fetch coach name
  const { data: coachProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', clientRow.coach_id)
    .single()

  const coachName = coachProfile?.full_name ?? 'Your Coach'

  return {
    conversationId,
    coachName,
    initialMessages: (messages ?? []) as Message[],
  }
}

export default async function ClientMessagesPage() {
  const thread = await fetchThread()
  if (!thread) redirect('/login')

  // Mark coach messages as read
  void markMessagesRead(thread.conversationId)

  return (
    <ThreadClient
      conversationId={thread.conversationId}
      coachName={thread.coachName}
      initialMessages={thread.initialMessages}
    />
  )
}
