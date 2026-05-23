import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SuspendUserButton from './SuspendUserButton'

async function fetchUser(id: string) {
  const svc = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [
    { data: { user: authUser } },
    { data: profile },
  ] = await Promise.all([
    svc.auth.admin.getUserById(id),
    svc.from('profiles').select('*, workspaces(id, name, slug, subscription_status)').eq('id', id).single(),
  ])

  if (!authUser && !profile) return null

  // Fetch client count for this workspace
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws = (profile as any)?.workspaces
  let clientCount = 0
  if (ws?.id) {
    const { count } = await svc.from('clients').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id)
    clientCount = count ?? 0
  }

  return { authUser, profile, workspace: ws, clientCount }
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await fetchUser(id)
  if (!data) notFound()

  const { authUser, profile, workspace, clientCount } = data

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/users" style={{ fontSize: 13, color: '#7c3aed', textDecoration: 'none' }}>
          ← Back to Users
        </Link>
      </div>

      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '24px',
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          {profile?.full_name ?? authUser?.email ?? id}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', margin: 0 }}>
          {authUser?.email}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
          {[
            { label: 'Role', value: profile?.role ?? '—' },
            { label: 'Workspace', value: workspace?.name ?? '—' },
            { label: 'Subscription', value: workspace?.subscription_status ?? '—' },
            { label: 'Clients', value: String(clientCount) },
            { label: 'Joined', value: authUser?.created_at ? new Date(authUser.created_at).toLocaleDateString() : '—' },
            { label: 'Last Sign-in', value: authUser?.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleDateString() : 'Never' },
            { label: 'Email Verified', value: authUser?.email_confirmed_at ? 'Yes' : 'No' },
            { label: 'User ID', value: id },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
                {label}
              </p>
              <p style={{ fontSize: 14, color: 'var(--color-text-primary)', margin: 0, wordBreak: 'break-all' }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '20px 24px',
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
          Actions
        </h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SuspendUserButton userId={id} isBanned={authUser?.banned_until != null} />
        </div>
      </div>
    </div>
  )
}
