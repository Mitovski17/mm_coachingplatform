import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import Link from 'next/link'

async function fetchWorkspaces() {
  const svc = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: workspaces } = await (svc as any)
    .from('workspaces')
    .select('id, name, slug, plan, subscription_status, trial_ends_at, created_at, owner_id')
    .order('created_at', { ascending: false })

  const { data: profiles } = await svc
    .from('profiles')
    .select('id, full_name, workspace_id')

  const { data: clients } = await svc
    .from('clients')
    .select('id, workspace_id')

  const { data: { users: authUsers } } = await svc.auth.admin.listUsers({ perPage: 1000 })

  return (workspaces ?? []).map((ws: {
    id: string; name: string; slug: string; plan: string;
    subscription_status: string; trial_ends_at: string | null;
    created_at: string; owner_id: string
  }) => {
    const coachCount = (profiles ?? []).filter((p) => p.workspace_id === ws.id).length
    const clientCount = (clients ?? []).filter((c) => c.workspace_id === ws.id).length
    const owner = authUsers.find((u) => u.id === ws.owner_id)
    return {
      ...ws,
      coachCount,
      clientCount,
      ownerEmail: owner?.email ?? '—',
    }
  })
}

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  trial: '#f59e0b',
  past_due: '#ef4444',
  canceled: '#6b7280',
  incomplete: '#f59e0b',
}

export default async function WorkspacesPage() {
  const workspaces = await fetchWorkspaces()

  return (
    <div className="admin-page" style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Workspaces
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-hint)', marginTop: 4 }}>
          {workspaces.length} workspaces total
        </p>
      </div>

      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div className="admin-table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Workspace', 'Owner', 'Plan', 'Status', 'Coaches', 'Clients', 'Created', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--color-text-hint)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workspaces.map((ws: {
                id: string; name: string; slug: string; plan: string;
                subscription_status: string; trial_ends_at: string | null;
                created_at: string; owner_id: string;
                coachCount: number; clientCount: number; ownerEmail: string
              }) => (
              <tr key={ws.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                    {ws.name}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: 0 }}>
                    {ws.slug}
                  </p>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {ws.ownerEmail}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                  {ws.plan}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 600,
                      backgroundColor: (STATUS_COLORS[ws.subscription_status] ?? '#999') + '22',
                      color: STATUS_COLORS[ws.subscription_status] ?? '#999',
                      textTransform: 'capitalize',
                    }}
                  >
                    {ws.subscription_status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  {ws.coachCount}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  {ws.clientCount}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-hint)' }}>
                  {new Date(ws.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Link
                    href={`/admin/billing?workspace=${ws.id}`}
                    style={{ fontSize: 12, color: '#7c3aed', fontWeight: 500, textDecoration: 'none' }}
                  >
                    Billing →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
