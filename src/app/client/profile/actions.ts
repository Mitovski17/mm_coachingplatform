'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireClient } from '@/lib/auth'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function updatePersonalInfo(clientId: string, name: string, phone: string) {
  let ctx
  try {
    ctx = await requireClient()
  } catch {
    return { error: 'Not authenticated' }
  }
  clientId = ctx.clientId

  const admin = adminClient()
  const { error } = await admin
    .from('clients')
    .update({ full_name: name.trim(), phone: phone.trim() || null })
    .eq('id', clientId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', url: null }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { error: 'No file provided', url: null }
  if (file.size > 5 * 1024 * 1024) return { error: 'File too large (max 5 MB)', url: null }

  const admin = adminClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${user.id}/avatar.${ext}`

  // Ensure bucket exists
  const { error: bucketErr } = await admin.storage.createBucket('avatars', { public: true }).catch(() => ({ error: null }))
  void bucketErr

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(path, bytes, { upsert: true, contentType: file.type })

  if (uploadError) return { error: uploadError.message, url: null }

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path)

  // Store avatar URL in user metadata
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, avatar_url: publicUrl },
  })

  return { error: null, url: publicUrl }
}

export async function sendFeedbackToCoach(
  clientId: string,
  workspaceId: string,
  coachId: string,
  message: string
) {
  let ctx
  try {
    ctx = await requireClient()
  } catch {
    return { error: 'Not authenticated' }
  }
  // Derive identity from the session; ignore caller-supplied ids.
  clientId = ctx.clientId
  workspaceId = ctx.workspaceId
  coachId = ctx.coachId ?? ''
  if (!coachId) return { error: 'You are not linked to a coach yet' }

  const admin = adminClient()

  const { data: convo, error: convoErr } = await admin
    .from('conversations')
    .upsert(
      { workspace_id: workspaceId, client_id: clientId, coach_id: coachId },
      { onConflict: 'workspace_id,client_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (convoErr || !convo) return { error: 'Could not reach your coach' }

  const { error } = await admin.from('messages').insert({
    conversation_id: convo.id,
    workspace_id: workspaceId,
    sender_role: 'client',
    body: message.trim(),
    read_by_coach: false,
    read_by_client: true,
  })

  if (error) return { error: error.message }
  return { error: null }
}
