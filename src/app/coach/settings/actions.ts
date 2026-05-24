'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function updateCoachProfile(profileId: string, name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = adminClient()
  const { error } = await admin
    .from('profiles')
    .update({ full_name: name.trim() })
    .eq('id', profileId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function uploadCoachAvatar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', url: null }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { error: 'No file provided', url: null }
  if (file.size > 5 * 1024 * 1024) return { error: 'File too large (max 5 MB)', url: null }

  const admin = adminClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${user.id}/avatar.${ext}`

  await admin.storage.createBucket('avatars', { public: true }).catch(() => ({ error: null }))

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(path, bytes, { upsert: true, contentType: file.type })

  if (uploadError) return { error: uploadError.message, url: null }

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path)

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, avatar_url: publicUrl },
  })
  await admin.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)

  return { error: null, url: publicUrl }
}
