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

  // Get workspace_id and invited_by (coach) from the invite
  const { data: invite, error: inviteErr } = await admin
    .from('invites')
    .select('workspace_id, invited_by')
    .eq('id', inviteId)
    .single()

  if (inviteErr || !invite) {
    return { error: 'Invite not found' }
  }

  // Create the clients row (upsert in case it somehow already exists)
  const { error } = await admin
    .from('clients')
    .upsert(
      {
        email,
        full_name: fullName,
        workspace_id: invite.workspace_id,
        ...(invite.invited_by ? { coach_id: invite.invited_by } : {}),
      },
      { onConflict: 'email', ignoreDuplicates: false }
    )

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}
