'use server'

import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

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

  if (notes.trim().length > 0) {
    const { data: checkin } = await admin
      .from('checkins')
      .select('client_id, workspace_id')
      .eq('id', checkinId)
      .single()

    if (checkin) {
      await createNotification({
        workspaceId: checkin.workspace_id,
        recipientType: 'client',
        recipientId: checkin.client_id,
        type: 'checkin_notes_added',
        title: 'Coach added notes',
        body: 'Your coach added notes to your check-in',
        link: '/client/check-in',
      })
    }
  }
}

export async function markCheckinReviewed(checkinId: string): Promise<void> {
  const admin = adminClient()
  const { error } = await admin
    .from('checkins')
    .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
    .eq('id', checkinId)
  if (error) throw new Error(error.message)

  const { data: checkin } = await admin
    .from('checkins')
    .select('client_id, workspace_id')
    .eq('id', checkinId)
    .single()

  if (checkin) {
    await createNotification({
      workspaceId: checkin.workspace_id,
      recipientType: 'client',
      recipientId: checkin.client_id,
      type: 'checkin_reviewed',
      title: 'Check-in reviewed',
      body: 'Your coach has reviewed your weekly check-in',
      link: '/client/check-in',
    })
  }
}
