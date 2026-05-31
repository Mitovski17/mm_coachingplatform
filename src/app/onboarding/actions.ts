'use server'

import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type OnboardingData = {
  current_weight: number
  current_weight_unit: string
  goal: string
  desired_weight: number
  desired_weight_unit: string
  meals_per_day: number
  foods_to_avoid: string | null
  activity_level: string
  occupation_notes: string | null
  health_notes: string | null
  training_location: string
  training_days_per_week: number
  preferred_training_time: string
}

export async function completeOnboarding(
  email: string,
  data: OnboardingData
): Promise<{ error: string | null; clientId: string | null; workspaceId: string | null }> {
  const admin = adminClient()

  const { data: existing } = await admin
    .from('clients')
    .select('id, workspace_id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('clients')
      .update({ ...data, onboarding_completed_at: new Date().toISOString() })
      .eq('email', email)
    if (error) return { error: error.message, clientId: null, workspaceId: null }
    return { error: null, clientId: existing.id, workspaceId: existing.workspace_id }
  }

  // No clients row — this means createClientFromInvite failed during signup.
  // Recover by looking up the invite to get workspace_id and coach_id.
  const { data: invite } = await admin
    .from('invites')
    .select('workspace_id, invited_by')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!invite) {
    return {
      error: 'Account setup is incomplete. Please contact your coach to resend your invite.',
      clientId: null,
      workspaceId: null,
    }
  }

  // Look up full_name from Supabase auth metadata
  const { data: authUsers } = await admin.auth.admin.listUsers()
  const authUser = authUsers?.users?.find((u) => u.email === email)
  const fullName = (authUser?.user_metadata?.full_name as string | undefined) ?? email

  const { data: created, error: insertErr } = await admin
    .from('clients')
    .insert({
      email,
      full_name: fullName,
      workspace_id: invite.workspace_id,
      ...(invite.invited_by ? { coach_id: invite.invited_by } : {}),
      ...data,
      onboarding_completed_at: new Date().toISOString(),
    })
    .select('id, workspace_id')
    .single()

  if (insertErr || !created) {
    return {
      error: insertErr?.message ?? 'Failed to complete setup. Please try again.',
      clientId: null,
      workspaceId: null,
    }
  }

  return { error: null, clientId: created.id, workspaceId: created.workspace_id }
}
