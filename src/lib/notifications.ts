import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { NotificationType } from '@/types/supabase'

export interface CreateNotificationPayload {
  workspaceId: string
  recipientType: 'coach' | 'client'
  recipientId: string
  type: NotificationType
  title: string
  body?: string
  link: string
}

export async function createNotification(payload: CreateNotificationPayload): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('notifications').insert({
      workspace_id: payload.workspaceId,
      recipient_type: payload.recipientType,
      recipient_id: payload.recipientId,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? '',
      link: payload.link,
    })
    if (error) console.error('[createNotification]', error.message)
  } catch (err) {
    console.error('[createNotification] unexpected error:', err)
  }
}
