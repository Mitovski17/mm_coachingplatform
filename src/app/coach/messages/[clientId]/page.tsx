import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import ThreadClient from './ThreadClient'
import { markMessagesRead, type Message } from './actions'

async function fetchThread(clientId: string): Promise<{
  conversationId: string
  clientName: string
  initialMessages: Message[]
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function run(svc: any, workspaceId: string, coachId: string) {
    // Resolve client info first to get name and validate the clientId belongs to this workspace
    const { data: clientRow } = await svc
      .from('clients')
      .select('id, full_name, email')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!clientRow) redirect('/coach/messages')

    // Upsert conversation — coach can initiate even if client hasn't messaged yet
    const { data: convo, error } = await svc
      .from('conversations')
      .upsert(
        { workspace_id: workspaceId, client_id: clientId, coach_id: coachId },
        { onConflict: 'workspace_id,client_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (error || !convo) redirect('/coach/messages')

    const { data: messages } = await svc
      .from('messages')
      .select('*')
      .eq('conversation_id', convo.id)
      .order('created_at', { ascending: true })
      .limit(50)

    const clientName = clientRow.full_name ?? clientRow.email ?? 'Client'

    return {
      conversationId: convo.id as string,
      clientName,
      initialMessages: (messages ?? []) as Message[],
    }
  }

  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const rawMock = cookieStore.get('dev_mock_email')?.value
    if (rawMock) {
      const email = decodeURIComponent(rawMock)
      const svc = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: { users } } = await svc.auth.admin.listUsers({ perPage: 1000 })
      const u = users.find((x) => x.email === email)
      if (!u) redirect('/login')
      const { data: profile } = await svc.from('profiles').select('id, workspace_id').eq('id', u.id).single()
      if (!profile) redirect('/login')
      return run(svc, profile.workspace_id, profile.id)
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('id, workspace_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return run(supabase as any, profile.workspace_id, profile.id)
}

export default async function CoachThreadPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const thread = await fetchThread(clientId)

  // Mark client messages as read (fire-and-forget)
  void markMessagesRead(thread.conversationId, 'coach')

  return (
    <ThreadClient
      conversationId={thread.conversationId}
      clientName={thread.clientName}
      initialMessages={thread.initialMessages}
    />
  )
}
