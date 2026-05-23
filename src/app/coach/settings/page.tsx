import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSvc } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import SettingsClient from './SettingsClient'

export type CoachClientRow = {
  id: string
  full_name: string
  email: string
  status: string | null
  goal: string | null
  created_at: string
}

async function fetchData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const rawMock = cookieStore.get('dev_mock_email')?.value
    if (rawMock) {
      const email = decodeURIComponent(rawMock)
      const svc = createSvc<Database>(url, key)
      const { data: { users } } = await svc.auth.admin.listUsers({ perPage: 1000 })
      const u = users.find((x) => x.email === email)
      if (!u) redirect('/login')
      const { data: profile } = await svc
        .from('profiles')
        .select('id, full_name, avatar_url, role, workspace_id')
        .eq('id', u.id)
        .single()
      if (!profile) redirect('/login')
      const [{ data: workspace }, { data: clients }] = await Promise.all([
        svc.from('workspaces').select('name, plan').eq('id', profile.workspace_id).single(),
        svc
          .from('clients')
          .select('id, full_name, email, status, goal, created_at')
          .eq('workspace_id', profile.workspace_id)
          .order('created_at', { ascending: false }),
      ])
      return {
        userId: u.id,
        email: u.email ?? '',
        profileId: profile.id,
        fullName: profile.full_name ?? '',
        avatarUrl:
          profile.avatar_url ??
          ((u.user_metadata?.avatar_url as string | undefined) ?? null),
        role: profile.role ?? 'coach',
        workspaceName: workspace?.name ?? 'My Workspace',
        workspacePlan: workspace?.plan ?? 'free',
        clients: (clients ?? []) as CoachClientRow[],
      }
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, workspace_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  const admin = createSvc<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const [{ data: workspace }, { data: clients }] = await Promise.all([
    admin.from('workspaces').select('name, plan').eq('id', profile.workspace_id).single(),
    admin
      .from('clients')
      .select('id, full_name, email, status, goal, created_at')
      .eq('workspace_id', profile.workspace_id)
      .order('created_at', { ascending: false }),
  ])

  return {
    userId: user.id,
    email: user.email ?? '',
    profileId: profile.id,
    fullName: profile.full_name ?? '',
    avatarUrl:
      profile.avatar_url ??
      ((user.user_metadata?.avatar_url as string | undefined) ?? null),
    role: profile.role ?? 'coach',
    workspaceName: workspace?.name ?? 'My Workspace',
    workspacePlan: workspace?.plan ?? 'free',
    clients: (clients ?? []) as CoachClientRow[],
  }
}

export default async function CoachSettingsPage() {
  const data = await fetchData()
  return <SettingsClient {...data} />
}
