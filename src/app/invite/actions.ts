'use server'

import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function createClientFromInvite(
  inviteId: string,
  email: string,
  fullName: string
): Promise<{ error: string | null }> {
  const admin = adminClient()
  const normalizedEmail = email.toLowerCase().trim()

  // Get workspace_id and invited_by (coach) from the invite
  const { data: invite, error: inviteErr } = await admin
    .from('invites')
    .select('workspace_id, invited_by')
    .eq('id', inviteId)
    .single()

  if (inviteErr || !invite) {
    return { error: 'Invite not found' }
  }

  // Check if a clients row already exists for this email
  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existing) {
    // Row already exists — just ensure coach reference is set
    const { error } = await admin
      .from('clients')
      .update({ ...(invite.invited_by ? { coach_id: invite.invited_by } : {}) })
      .eq('email', normalizedEmail)
    return { error: error?.message ?? null }
  }

  // Insert new clients row
  const { error } = await admin
    .from('clients')
    .insert({
      email: normalizedEmail,
      full_name: fullName,
      workspace_id: invite.workspace_id,
      ...(invite.invited_by ? { coach_id: invite.invited_by } : {}),
    })

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}
