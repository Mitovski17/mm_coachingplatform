import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { format, formatDistanceToNow } from 'date-fns'

type Client = Database['public']['Tables']['clients']['Row']

type CheckIn = {
  client_id: string
  submitted_at: string
  status: string
}

// ─── Label maps ──────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  lose_fat: 'Lose fat',
  build_muscle: 'Build muscle',
  recomposition: 'Body recomposition',
  performance: 'Improve performance',
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly active',
  moderately_active: 'Moderately active',
  very_active: 'Very active',
}

const LOCATION_LABELS: Record<string, string> = {
  gym: 'Gym',
  home: 'Home',
  both: 'Both',
}

const TIME_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  no_preference: 'No preference',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trainingCell(c: Client): string {
  const { training_days_per_week: days, training_location: loc, preferred_training_time: time } = c
  if (!days || !loc || !time) return '—'
  return `${days}x/wk · ${LOCATION_LABELS[loc] ?? loc} · ${TIME_LABELS[time] ?? time}`
}

function checkInStatus(
  clientId: string,
  checkIns: CheckIn[]
): { label: string; hasPending: boolean } {
  const rows = checkIns.filter((ci) => ci.client_id === clientId)
  if (rows.length === 0) return { label: 'Never', hasPending: false }
  const latest = rows.reduce((a, b) =>
    new Date(a.submitted_at) > new Date(b.submitted_at) ? a : b
  )
  return {
    label: formatDistanceToNow(new Date(latest.submitted_at), { addSuffix: true }),
    hasPending: rows.some((ci) => ci.status === 'pending'),
  }
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchDashboardData(): Promise<{ clients: Client[]; checkIns: CheckIn[] }> {
  let clients: Client[] = []
  let checkIns: CheckIn[] = []

  // Dev mock: use service role key to look up by email (no auth session available)
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const rawMockEmail = cookieStore.get('dev_mock_email')?.value

    if (rawMockEmail) {
      const mockEmail = decodeURIComponent(rawMockEmail)
      const svc = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const {
        data: { users },
      } = await svc.auth.admin.listUsers({ perPage: 1000 })
      const adminUser = users.find((u) => u.email === mockEmail)
      if (!adminUser) redirect('/login')

      const { data: profile } = await svc
        .from('profiles')
        .select('workspace_id')
        .eq('id', adminUser.id)
        .single()
      if (!profile) redirect('/login')

      const { data } = await svc
        .from('clients')
        .select('*')
        .eq('workspace_id', profile.workspace_id)
        .order('created_at', { ascending: false })
      clients = data ?? []

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ciData, error: ciError } = await (svc as any)
          .from('checkins')
          .select('client_id, submitted_at, status')
        if (!ciError && ciData) checkIns = ciData as CheckIn[]
      } catch {
        // check_ins table not yet created
      }

      return { clients, checkIns }
    }
  }

  // Production (and dev without mock cookie): SSR client with auth session
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', profile.workspace_id)
    .order('created_at', { ascending: false })
  clients = data ?? []

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ciData, error: ciError } = await (supabase as any)
      .from('checkins')
      .select('client_id, submitted_at, status')
    if (!ciError && ciData) checkIns = ciData as CheckIn[]
  } catch {
    // check_ins table not yet created
  }

  return { clients, checkIns }
}

// ─── Column header config ─────────────────────────────────────────────────────

const COLS: { label: string; hide?: string }[] = [
  { label: 'Name' },
  { label: 'Onboarding' },
  { label: 'Goal' },
  { label: 'Activity' },
  { label: 'Meals' },
  { label: 'Training' },
  { label: 'Meal plan', hide: 'hidden xl:table-cell' },
  { label: 'Plan', hide: 'hidden xl:table-cell' },
  { label: 'Check-in' },
  { label: 'Joined' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { clients, checkIns } = await fetchDashboardData()

  return (
    <div className="px-6 py-8">
      {/* Page title */}
      <div className="mb-6">
        <h1
          className="text-2xl"
          style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
        >
          Clients
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {clients.length} {clients.length === 1 ? 'client' : 'clients'}
        </p>
      </div>

      {/* Table card */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '14%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '16%' }} />
            <col className="hidden xl:table-column" style={{ width: '8%' }} />
            <col className="hidden xl:table-column" style={{ width: '8%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>

          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-1)',
              }}
            >
              {COLS.map(({ label, hide }) => (
                <th
                  key={label}
                  className={`text-left px-3 py-2.5 ${hide ?? ''}`}
                  style={{
                    color: 'var(--color-text-hint)',
                    fontWeight: 500,
                    fontSize: '0.72rem',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: 'var(--color-text-hint)' }}
                >
                  No clients yet. Send an invite to get started.
                </td>
              </tr>
            ) : (
              clients.map((client, i) => {
                const ci = checkInStatus(client.id, checkIns)
                const isLast = i === clients.length - 1

                return (
                  <tr
                    key={client.id}
                    className="relative group"
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                    }}
                  >
                    {/* Name — block link covers the full row */}
                    <td className="px-3 py-2.5 relative" style={{ overflow: 'hidden' }}>
                      <Link
                        href={`/coach/clients/${client.id}`}
                        className="absolute inset-0 z-0 group-hover:bg-white/[0.02] transition-colors"
                        aria-label={`View ${client.full_name}`}
                      />
                      <span
                        className="relative z-10 block truncate"
                        style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
                      >
                        {client.full_name}
                      </span>
                    </td>

                    {/* Onboarding */}
                    <td className="px-3 py-2.5 relative z-10">
                      {client.onboarding_completed_at ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 text-xs"
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            color: 'var(--color-text-secondary)',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 500,
                          }}
                        >
                          Done
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center px-2 py-0.5 text-xs"
                          style={{
                            backgroundColor: 'var(--color-surface-3)',
                            color: 'var(--color-text-hint)',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 400,
                          }}
                        >
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Goal */}
                    <td
                      className="px-3 py-2.5 relative z-10"
                      style={{
                        color: 'var(--color-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {client.goal ? (GOAL_LABELS[client.goal] ?? client.goal) : '—'}
                    </td>

                    {/* Activity level */}
                    <td
                      className="px-3 py-2.5 relative z-10"
                      style={{
                        color: 'var(--color-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {client.activity_level
                        ? (ACTIVITY_LABELS[client.activity_level] ?? client.activity_level)
                        : '—'}
                    </td>

                    {/* Meals per day */}
                    <td
                      className="px-3 py-2.5 relative z-10"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {client.meals_per_day ?? '—'}
                    </td>

                    {/* Training */}
                    <td
                      className="px-3 py-2.5 relative z-10"
                      style={{
                        color: 'var(--color-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {trainingCell(client)}
                    </td>

                    {/* Meal plan — placeholder, hidden below xl */}
                    <td
                      className="px-3 py-2.5 relative z-10 hidden xl:table-cell"
                      style={{ color: 'var(--color-text-hint)' }}
                    >
                      —
                    </td>

                    {/* Training plan — placeholder, hidden below xl */}
                    <td
                      className="px-3 py-2.5 relative z-10 hidden xl:table-cell"
                      style={{ color: 'var(--color-text-hint)' }}
                    >
                      —
                    </td>

                    {/* Check-in status */}
                    <td className="px-3 py-2.5 relative z-10">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          style={{
                            color: 'var(--color-text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ci.label}
                        </span>
                        {ci.hasPending && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 text-xs"
                            style={{
                              backgroundColor: 'var(--color-accent-dim)',
                              color: 'var(--color-accent)',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Review
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Joined */}
                    <td
                      className="px-3 py-2.5 relative z-10"
                      style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}
                    >
                      {format(new Date(client.created_at), 'MMM yyyy')}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
