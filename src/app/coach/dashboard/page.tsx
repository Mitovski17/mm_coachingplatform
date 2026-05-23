import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { formatDistanceToNow } from 'date-fns'
import DashboardClient, { type ClientData } from './DashboardClient'

type DBClient = Database['public']['Tables']['clients']['Row']

type CheckIn = { client_id: string; submitted_at: string; status: string }
type LastSession = { client_id: string; performed_at: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  lose_fat: 'Fat loss',
  build_muscle: 'Hypertrophy',
  recomposition: 'Recomp',
  performance: 'Performance',
  strength: 'Strength',
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

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

function weeksSince(iso: string | null): number {
  if (!iso) return 0
  return Math.max(1, Math.ceil((Date.now() - new Date(iso).getTime()) / (7 * 24 * 3600 * 1000)))
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchData(): Promise<{
  clients: DBClient[]
  checkIns: CheckIn[]
  lastSessions: LastSession[]
}> {
  async function run(svc: ReturnType<typeof createServiceClient<Database>>, workspaceId: string) {
    const { data: clients } = await svc
      .from('clients').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })

    const clientIds = (clients ?? []).map((c) => c.id)
    let checkIns: CheckIn[] = []
    let lastSessions: LastSession[] = []

    if (clientIds.length > 0) {
      const [checkInRes, sessionRes] = await Promise.allSettled([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).from('checkins').select('client_id, submitted_at, status').in('client_id', clientIds),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any)
          .from('workout_sessions')
          .select('client_id, performed_at')
          .in('client_id', clientIds)
          .order('performed_at', { ascending: false })
          .limit(clientIds.length * 5),
      ])

      if (checkInRes.status === 'fulfilled' && checkInRes.value.data) {
        checkIns = checkInRes.value.data as CheckIn[]
      }

      if (sessionRes.status === 'fulfilled' && sessionRes.value.data) {
        const seen = new Set<string>()
        for (const row of sessionRes.value.data as LastSession[]) {
          if (!seen.has(row.client_id)) {
            seen.add(row.client_id)
            lastSessions.push(row)
          }
        }
      }
    }

    return { clients: clients ?? [], checkIns, lastSessions }
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

// ─── Badge logic ─────────────────────────────────────────────────────────────

function resolveBadge(
  clientId: string,
  checkIns: CheckIn[],
  lastSessions: LastSession[]
): { type: ClientData['badgeType']; lastCheckinLabel: string | null } {
  const rows = checkIns.filter((ci) => ci.client_id === clientId)
  const hasPending = rows.some((ci) => ci.status === 'pending')

  if (hasPending) {
    const latest = rows.reduce((a, b) =>
      new Date(a.submitted_at) > new Date(b.submitted_at) ? a : b
    )
    return {
      type: 'submitted',
      lastCheckinLabel: formatDistanceToNow(new Date(latest.submitted_at), { addSuffix: true }),
    }
  }

  if (rows.length === 0) {
    return { type: 'none', lastCheckinLabel: null }
  }

  const latest = rows.reduce((a, b) =>
    new Date(a.submitted_at) > new Date(b.submitted_at) ? a : b
  )
  const daysSince = (Date.now() - new Date(latest.submitted_at).getTime()) / 86_400_000

  const label = formatDistanceToNow(new Date(latest.submitted_at), { addSuffix: true })

  if (daysSince > 10) return { type: 'overdue', lastCheckinLabel: label }
  return { type: 'active', lastCheckinLabel: label }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { clients, checkIns, lastSessions } = await fetchData()

  // Build serializable ClientData array
  const clientData: ClientData[] = clients.map((c) => {
    const { type: badgeType, lastCheckinLabel } = resolveBadge(c.id, checkIns, lastSessions)

    const session = lastSessions.find((s) => s.client_id === c.id)
    const lastActiveIso = session?.performed_at ?? null
    const lastActiveLabel = lastActiveIso
      ? formatDistanceToNow(new Date(lastActiveIso), { addSuffix: true })
      : null

    const weekNum = weeksSince(c.created_at)

    return {
      id: c.id,
      name: c.full_name,
      initials: getInitials(c.full_name),
      avatarColor: avatarColor(c.full_name),
      goal: c.goal ? (GOAL_LABELS[c.goal] ?? c.goal) : null,
      goalKey: c.goal ?? null,
      weekNumber: weekNum,
      weight: c.current_weight != null ? String(c.current_weight) : null,
      weightUnit: c.current_weight_unit ?? 'kg',
      badgeType,
      lastCheckinLabel,
      lastActiveLabel,
      lastActiveIso,
      compliancePct: badgeType === 'submitted' || badgeType === 'active' ? 100
        : badgeType === 'overdue' ? 0 : 50,
    }
  })

  const pendingNames = clientData
    .filter((c) => c.badgeType === 'submitted')
    .map((c) => c.name)

  return (
    <DashboardClient
      clients={clientData}
      pendingNames={pendingNames}
    />
  )
}
