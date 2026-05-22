import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import SidebarShell from './SidebarShell'

function currentWeekDate(): string {
  // Check-in windows open on Sundays - match that boundary here.
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun...6=Sat
  const sunday = new Date(now)
  sunday.setUTCDate(now.getUTCDate() - day)
  sunday.setUTCHours(0, 0, 0, 0)
  return sunday.toISOString().split('T')[0]
}

async function fetchUnreadMessageCount(): Promise<number> {
  try {
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
        if (!adminUser) return 0
        const { data: profile } = await svc
          .from('profiles').select('workspace_id').eq('id', adminUser.id).single()
        if (!profile) return 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (svc as any)
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', profile.workspace_id)
          .eq('sender_role', 'client')
          .eq('read_by_coach', false)
        return count ?? 0
      }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0
    const { data: profile } = await supabase
      .from('profiles').select('workspace_id').eq('id', user.id).single()
    if (!profile) return 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', profile.workspace_id)
      .eq('sender_role', 'client')
      .eq('read_by_coach', false)
    return count ?? 0
  } catch {
    return 0
  }
}

async function fetchPendingCount(): Promise<number> {
  try {
    const weekDate = currentWeekDate()

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
        if (!adminUser) return 0
        const { data: profile } = await svc
          .from('profiles').select('workspace_id').eq('id', adminUser.id).single()
        if (!profile) return 0
        const { count } = await svc
          .from('checkins')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', profile.workspace_id)
          .eq('status', 'pending')
          .eq('week_start_date', weekDate)
        return count ?? 0
      }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0
    const { data: profile } = await supabase
      .from('profiles').select('workspace_id').eq('id', user.id).single()
    if (!profile) return 0
    const { count } = await supabase
      .from('checkins')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', profile.workspace_id)
      .eq('status', 'pending')
      .eq('week_start_date', weekDate)
    return count ?? 0
  } catch {
    return 0
  }
}

async function fetchCoachId(): Promise<string> {
  try {
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
        return adminUser?.id ?? ''
      }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? ''
  } catch {
    return ''
  }
}

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const [pendingCount, unreadMessageCount, coachId] = await Promise.all([
    fetchPendingCount(),
    fetchUnreadMessageCount(),
    fetchCoachId(),
  ])
  return (
    <SidebarShell pendingCount={pendingCount} unreadMessageCount={unreadMessageCount} coachId={coachId}>
      {children}
    </SidebarShell>
  )
}
