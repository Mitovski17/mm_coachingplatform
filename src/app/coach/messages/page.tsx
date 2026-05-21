import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { formatDistanceToNow } from 'date-fns'
import { MessageCircle } from 'lucide-react'

type ConversationRow = {
  id: string
  client_id: string
  last_message_at: string | null
  clients: {
    full_name: string
    email: string
  }
  unread: number
  lastBody: string | null
}

async function fetchConversations(): Promise<{ workspaceId: string; rows: ConversationRow[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function run(svc: any, workspaceId: string): Promise<{ workspaceId: string; rows: ConversationRow[] }> {
    const { data: convos } = await svc
      .from('conversations')
      .select('id, client_id, last_message_at, clients(full_name, email)')
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (!convos || convos.length === 0) return { workspaceId, rows: [] }

    const convoIds = convos.map((c: { id: string }) => c.id)

    // Fetch unread counts and last message body in parallel
    const [unreadRes, lastMsgRes] = await Promise.all([
      svc
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convoIds)
        .eq('sender_role', 'client')
        .eq('read_by_coach', false),
      svc
        .from('messages')
        .select('conversation_id, body, created_at')
        .in('conversation_id', convoIds)
        .order('created_at', { ascending: false }),
    ])

    const unreadCounts: Record<string, number> = {}
    for (const msg of (unreadRes.data ?? [])) {
      unreadCounts[msg.conversation_id] = (unreadCounts[msg.conversation_id] ?? 0) + 1
    }

    const lastMsgByConvo: Record<string, string> = {}
    for (const msg of (lastMsgRes.data ?? [])) {
      if (!lastMsgByConvo[msg.conversation_id]) {
        lastMsgByConvo[msg.conversation_id] = msg.body
      }
    }

    const rows: ConversationRow[] = convos.map((c: {
      id: string
      client_id: string
      last_message_at: string | null
      clients: { full_name: string; email: string }
    }) => ({
      id: c.id,
      client_id: c.client_id,
      last_message_at: c.last_message_at,
      clients: c.clients,
      unread: unreadCounts[c.id] ?? 0,
      lastBody: lastMsgByConvo[c.id] ?? null,
    }))

    return { workspaceId, rows }
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
      const { data: profile } = await svc.from('profiles').select('workspace_id').eq('id', u.id).single()
      if (!profile) redirect('/login')
      return run(svc, profile.workspace_id)
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('workspace_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return run(supabase as any, profile.workspace_id)
}

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  '#FF6B35', '#7C3AED', '#0EA5E9', '#10B981',
  '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
]
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default async function MessagesPage() {
  const { rows } = await fetchConversations()

  return (
    <div style={{ padding: '32px 40px', maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Messages
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-hint)', margin: '4px 0 0' }}>
          Direct messages with your clients
        </p>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 0',
            color: 'var(--color-text-hint)',
            gap: 12,
          }}
        >
          <MessageCircle size={40} style={{ opacity: 0.3 }} />
          <p style={{ fontSize: 14, margin: 0 }}>No conversations yet. Clients can message you from their app.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-1)',
          }}
        >
          {rows.map((row, i) => {
            const name = row.clients?.full_name ?? row.clients?.email ?? 'Client'
            const initials = getInitials(name)
            const color = avatarColor(name)
            const timeAgo = row.last_message_at
              ? formatDistanceToNow(new Date(row.last_message_at), { addSuffix: true })
              : null

            return (
              <Link
                key={row.id}
                href={`/coach/messages/${row.client_id}`}
                className="messages-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  textDecoration: 'none',
                  color: 'inherit',
                  borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {initials}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: row.unread > 0 ? 700 : 500,
                        color: 'var(--color-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {name}
                    </span>
                    {timeAgo && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-hint)', flexShrink: 0 }}>
                        {timeAgo}
                      </span>
                    )}
                  </div>
                  {row.lastBody && (
                    <p
                      style={{
                        fontSize: 13,
                        color: row.unread > 0 ? 'var(--color-text-secondary)' : 'var(--color-text-hint)',
                        margin: '2px 0 0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: row.unread > 0 ? 500 : 400,
                      }}
                    >
                      {row.lastBody}
                    </p>
                  )}
                </div>

                {/* Unread badge */}
                {row.unread > 0 && (
                  <span
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: 'var(--color-accent)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 6px',
                      flexShrink: 0,
                    }}
                  >
                    {row.unread}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
