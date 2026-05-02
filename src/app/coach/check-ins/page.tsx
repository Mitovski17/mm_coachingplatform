import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import CheckInsClient from './CheckInsClient'

export type CheckinCard = {
  clientId: string
  clientName: string
  checkinId: string
  status: 'pending' | 'reviewed'
  submittedAt: string
  reviewedAt: string | null
  coachNotes: string | null
  answers: Record<string, unknown>
  prevAnswers: Record<string, unknown> | null
}

function weekBounds(): { currentWeek: string; prevWeek: string } {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  const prevMonday = new Date(monday)
  prevMonday.setUTCDate(monday.getUTCDate() - 7)
  return {
    currentWeek: monday.toISOString().split('T')[0],
    prevWeek: prevMonday.toISOString().split('T')[0],
  }
}

async function fetchData(): Promise<CheckinCard[]> {
  const { currentWeek, prevWeek } = weekBounds()

  // ── Dev mock path ────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const rawMockEmail = cookieStore.get('dev_mock_email')?.value

    if (rawMockEmail) {
      const mockEmail = decodeURIComponent(rawMockEmail)
      const svc = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: { users } } = await svc.auth.admin.listUsers({ perPage: 1000 })
      const adminUser = users.find((u) => u.email === mockEmail)
      if (!adminUser) redirect('/login')

      const { data: profile } = await svc
        .from('profiles').select('workspace_id').eq('id', adminUser.id).single()
      if (!profile) redirect('/login')

      return buildCards(svc, profile.workspace_id, currentWeek, prevWeek)
    }
  }

  // ── Production SSR path ───────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('workspace_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buildCards(supabase as any, profile.workspace_id, currentWeek, prevWeek)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildCards(svc: any, workspaceId: string, currentWeek: string, prevWeek: string): Promise<CheckinCard[]> {
  const [clientsRes, currentRes, prevRes] = await Promise.all([
    svc.from('clients').select('id, full_name').eq('workspace_id', workspaceId),
    svc
      .from('checkins')
      .select('id, client_id, status, answers, coach_notes, created_at, reviewed_at')
      .eq('workspace_id', workspaceId)
      .eq('week_start_date', currentWeek)
      .order('created_at', { ascending: false }),
    svc
      .from('checkins')
      .select('id, client_id, answers')
      .eq('workspace_id', workspaceId)
      .eq('week_start_date', prevWeek),
  ])

  const clients: { id: string; full_name: string }[] = clientsRes.data ?? []
  const currentCheckins: {
    id: string; client_id: string; status: string; answers: Record<string, unknown>;
    coach_notes: string | null; created_at: string; reviewed_at: string | null
  }[] = currentRes.data ?? []
  const prevCheckins: { id: string; client_id: string; answers: Record<string, unknown> }[] = prevRes.data ?? []

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]))
  const prevMap = new Map(prevCheckins.map((ci) => [ci.client_id, ci.answers]))

  const cards: CheckinCard[] = []
  // One card per client, using the most recent check-in this week
  const seen = new Set<string>()
  for (const ci of currentCheckins) {
    if (seen.has(ci.client_id)) continue
    seen.add(ci.client_id)
    cards.push({
      clientId: ci.client_id,
      clientName: clientMap.get(ci.client_id) ?? 'Unknown client',
      checkinId: ci.id,
      status: ci.status as 'pending' | 'reviewed',
      submittedAt: ci.created_at,
      reviewedAt: ci.reviewed_at,
      coachNotes: ci.coach_notes,
      answers: ci.answers,
      prevAnswers: prevMap.get(ci.client_id) ?? null,
    })
  }

  return cards
}

export default async function CheckInsPage() {
  const cards = await fetchData()
  return (
    <CheckInsClient
      cards={cards}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
    />
  )
}
