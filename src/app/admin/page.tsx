import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

async function fetchKPIs() {
  const svc = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [
    { count: totalCoaches },
    { count: totalClients },
    { count: totalWorkspaces },
    { count: totalCheckins },
    { count: pendingCheckins },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { data: workspaces },
  ] = await Promise.all([
    svc.from('profiles').select('id', { count: 'exact', head: true }),
    svc.from('clients').select('id', { count: 'exact', head: true }),
    svc.from('workspaces').select('id', { count: 'exact', head: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc as any).from('checkins').select('id', { count: 'exact', head: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc as any).from('checkins').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc as any).from('workspaces').select('subscription_status').limit(1000),
  ])

  const activeWorkspaces = (workspaces ?? []).filter(
    (w: { subscription_status: string }) => w.subscription_status === 'active'
  ).length

  return {
    totalCoaches: totalCoaches ?? 0,
    totalClients: totalClients ?? 0,
    totalWorkspaces: totalWorkspaces ?? 0,
    totalCheckins: totalCheckins ?? 0,
    pendingCheckins: pendingCheckins ?? 0,
    activeWorkspaces,
  }
}

function KpiCard({ label, value, sub, color = '#7c3aed' }: {
  label: string
  value: number | string
  sub?: string
  color?: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '20px 24px',
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 32, fontWeight: 700, color, margin: '8px 0 4px', lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: 0 }}>{sub}</p>
      )}
    </div>
  )
}

export default async function AdminDashboardPage() {
  const kpis = await fetchKPIs()

  return (
    <div className="admin-page" style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Platform Overview
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-hint)', marginTop: 4 }}>
          Real-time stats across all workspaces
        </p>
      </div>

      <div className="admin-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
        <KpiCard label="Total Workspaces" value={kpis.totalWorkspaces} sub={`${kpis.activeWorkspaces} active subscriptions`} />
        <KpiCard label="Coaches" value={kpis.totalCoaches} color="var(--color-accent)" />
        <KpiCard label="Clients" value={kpis.totalClients} color="#0ea5e9" />
        <KpiCard label="Total Check-ins" value={kpis.totalCheckins} color="#10b981" />
        <KpiCard label="Pending Reviews" value={kpis.pendingCheckins} color={kpis.pendingCheckins > 0 ? '#ef4444' : '#10b981'} sub="awaiting coach review" />
      </div>

      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '20px 24px',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
          Quick Actions
        </h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Manage Users', href: '/admin/users' },
            { label: 'View Workspaces', href: '/admin/workspaces' },
            { label: 'Review Content', href: '/admin/content' },
            { label: 'Billing', href: '/admin/billing' },
            { label: 'Analytics', href: '/admin/analytics' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: '#7c3aed',
                color: '#fff',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
