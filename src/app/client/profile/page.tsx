import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const admin = adminClient()
  const { data: client } = await admin
    .from('clients')
    .select('id, full_name, phone, coach_id, workspace_id, onboarding_completed_at')
    .eq('email', user.email)
    .single()

  // Calculate program week (assume 12-week program from onboarding date)
  let weekNumber = 1
  const totalWeeks = 12
  if (client?.onboarding_completed_at) {
    const started = new Date(client.onboarding_completed_at)
    const diffMs = Date.now() - started.getTime()
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
    weekNumber = Math.min(Math.max(diffWeeks, 1), totalWeeks)
  }

  return (
    <ProfileClient
      userId={user.id}
      email={user.email}
      avatarUrl={(user.user_metadata?.avatar_url as string | undefined) ?? null}
      clientId={client?.id ?? ''}
      fullName={client?.full_name ?? user.email}
      phone={client?.phone ?? null}
      coachId={client?.coach_id ?? null}
      workspaceId={client?.workspace_id ?? ''}
      weekNumber={weekNumber}
      totalWeeks={totalWeeks}
    />
  )
}
