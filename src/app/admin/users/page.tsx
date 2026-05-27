import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import Link from 'next/link'

async function fetchUsers() {
  const svc = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: { users: authUsers } } = await svc.auth.admin.listUsers({ perPage: 1000 })
  const { data: profiles } = await svc
    .from('profiles')
    .select('id, full_name, role, workspace_id, created_at')
    .order('created_at', { ascending: false })

  const { data: workspaces } = await svc
    .from('workspaces')
    .select('id, name, slug')

  const workspaceMap = Object.fromEntries((workspaces ?? []).map((w) => [w.id, w]))

  const rows = (profiles ?? []).map((p) => {
    const auth = authUsers.find((u) => u.id === p.id)
    const ws = workspaceMap[p.workspace_id]
    return {
      id: p.id,
      name: p.full_name ?? auth?.email ?? 'Unknown',
      email: auth?.email ?? '—',
      role: p.role,
      workspace: ws?.name ?? p.workspace_id,
      workspaceId: p.workspace_id,
      createdAt: p.created_at,
      lastSignIn: auth?.last_sign_in_at ?? null,
    }
  })

  return rows
}

const ROLE_COLORS: Record<string, string> = {
  owner: '#7c3aed',
  admin: '#0ea5e9',
  coach: 'var(--color-accent)',
}

export default async function UsersPage() {
  const users = await fetchUsers()

  return (
    <div className="admin-page" style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Users
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-hint)', marginTop: 4 }}>
          {users.length} profiles across all workspaces
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
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Name', 'Email', 'Role', 'Workspace', 'Joined', 'Last Sign-in', ''].map((h) => (
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
            {users.map((u) => (
              <tr
                key={u.id}
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {u.name}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {u.email}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 600,
                      backgroundColor: (ROLE_COLORS[u.role] ?? '#999') + '22',
                      color: ROLE_COLORS[u.role] ?? '#999',
                    }}
                  >
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {u.workspace}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-hint)' }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-hint)' }}>
                  {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : 'Never'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Link
                    href={`/admin/users/${u.id}`}
                    style={{
                      fontSize: 12,
                      color: '#7c3aed',
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    View →
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
