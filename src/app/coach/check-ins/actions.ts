'use server'

import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function updateCheckinNotes(checkinId: string, notes: string): Promise<void> {
  const admin = adminClient()
  const { error } = await admin
    .from('checkins')
    .update({ coach_notes: notes })
    .eq('id', checkinId)
  if (error) throw new Error(error.message)
}

export async function markCheckinReviewed(checkinId: string): Promise<void> {
  const admin = adminClient()
  const { error } = await admin
    .from('checkins')
    .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
    .eq('id', checkinId)
  if (error) throw new Error(error.message)
}
