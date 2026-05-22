export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import ThreadClient from './ThreadClient'
import { getOrCreateConversation, markMessagesRead, type Message } from './actions'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

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

export default async function ClientMessagesPage() {
  const email = await resolveEmail()
  if (!email) redirect('/login')

  const admin = adminClient()

  // ── 1. Resolve client row ──────────────────────────────────────────────────
  const { data: clientRow } = await admin
    .from('clients')
    .select('id, workspace_id, coach_id')
    .eq('email', email)
    .maybeSingle()

  if (!clientRow) redirect('/client')

  // ── 2. Resolve coach ID + name ─────────────────────────────────────────────
  let coachId: string
  let coachName: string

  if (clientRow.coach_id) {
    // Happy path — coach already linked. Fetch name in background alongside conversation.
    coachId = clientRow.coach_id

    const [conversationId, profileResult] = await Promise.all([
      getOrCreateConversation(clientRow.id, clientRow.workspace_id, coachId),
      admin.from('profiles').select('full_name').eq('id', coachId).maybeSingle(),
    ])

    coachName = profileResult.data?.full_name ?? 'Your Coach'

    // Fetch messages + mark read in parallel
    const [messagesResult] = await Promise.all([
      admin
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(50),
      markMessagesRead(conversationId),
    ])

    return (
      <ThreadClient
        conversationId={conversationId}
        coachName={coachName}
        initialMessages={(messagesResult.data ?? []) as Message[]}
      />
    )
  }

  // ── Fallback: coach_id not set — look up workspace owner from profiles ─────
  const { data: coachProfile } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('workspace_id', clientRow.workspace_id)
    .eq('role', 'coach')
    .maybeSingle()

  if (!coachProfile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 68px)', backgroundColor: 'var(--color-base)', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px', textAlign: 'center' }}>No coach assigned yet</p>
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', textAlign: 'center' }}>Your coach will appear here once they set up your account.</p>
      </div>
    )
  }

  coachId = coachProfile.id
  coachName = coachProfile.full_name ?? 'Your Coach'

  // Backfill coach_id so the next visit takes the fast path
  void admin.from('clients').update({ coach_id: coachId }).eq('id', clientRow.id)

  // Get or create conversation now that we have a coachId
  const conversationId = await getOrCreateConversation(
    clientRow.id,
    clientRow.workspace_id,
    coachId,
  )

  // Fetch messages + mark read in parallel
  const [messagesResult] = await Promise.all([
    admin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50),
    markMessagesRead(conversationId),
  ])

  return (
    <ThreadClient
      conversationId={conversationId}
      coachName={coachName}
      initialMessages={(messagesResult.data ?? []) as Message[]}
    />
  )
}
