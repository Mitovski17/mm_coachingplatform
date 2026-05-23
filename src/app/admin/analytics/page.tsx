import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

async function fetchAnalytics() {
  const svc = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const [
    { count: totalWorkspaces },
    { count: totalClients },
    { count: totalProfiles },
    { count: recentClients },
    { count: checkins30d },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { count: workoutSessions30d },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { data: workspaces },
  ] = await Promise.all([
    svc.from('workspaces').select('id', { count: 'exact', head: true }),
    svc.from('clients').select('id', { count: 'exact', head: true }),
    svc.from('profiles').select('id', { count: 'exact', head: true }),
    svc.from('clients').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc as any).from('checkins').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc as any).from('workout_sessions').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc as any).from('workspaces').select('id, name, subscription_status').limit(100),
  ])

  // Subscription breakdown
  const subBreakdown: Record<string, number> = {}
  for (const ws of workspaces ?? []) {
    const s = (ws as { subscription_status: string }).subscription_status
    subBreakdown[s] = (subBreakdown[s] ?? 0) + 1
  }

  return {
    totalWorkspaces: totalWorkspaces ?? 0,
    totalClients: totalClients ?? 0,
    totalProfiles: totalProfiles ?? 0,
    recentClients: recentClients ?? 0,
    checkins30d: checkins30d ?? 0,
    workoutSessions30d: workoutSessions30d ?? 0,
    subBreakdown,
  }
}

function StatRow({ label, value, max, color = '#7c3aed' }: {
  label: string; value: number; max: number; color?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{value}</span>
      </div>
      <div style={{ height: 6, backgroundColor: 'var(--color-surface-3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

export default async function AnalyticsPage() {
  const stats = await fetchAnalytics()

  const featureMax = Math.max(stats.checkins30d, stats.workoutSessions30d, 1)

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Analytics
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-hint)', marginTop: 4 }}>
          Platform-wide activity metrics
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Growth */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '20px 24px',
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>
            Platform Scale
          </h2>
          <StatRow label="Workspaces" value={stats.totalWorkspaces} max={stats.totalWorkspaces} color="#7c3aed" />
          <StatRow label="Coaches" value={stats.totalProfiles} max={stats.totalProfiles} color="var(--color-accent)" />
          <StatRow label="Clients (total)" value={stats.totalClients} max={stats.totalClients} color="#0ea5e9" />
          <StatRow label="New clients (30d)" value={stats.recentClients} max={stats.totalClients} color="#10b981" />
        </div>

        {/* Feature adoption (last 30d) */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '20px 24px',
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>
            Feature Activity (Last 30d)
          </h2>
          <StatRow label="Check-ins submitted" value={stats.checkins30d} max={featureMax} color="#10b981" />
          <StatRow label="Workout sessions" value={stats.workoutSessions30d} max={featureMax} color="#f59e0b" />
        </div>
      </div>

      {/* Subscription breakdown */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '20px 24px',
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>
          Subscription Status Breakdown
        </h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {Object.entries(stats.subBreakdown).map(([status, count]) => (
            <div key={status} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{count}</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '4px 0 0', textTransform: 'capitalize' }}>{status}</p>
            </div>
          ))}
          {Object.keys(stats.subBreakdown).length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-hint)', margin: 0 }}>No subscription data yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
