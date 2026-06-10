'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/shared/NotificationBell'

export default function ClientNotificationBell() {
  const [clientId, setClientId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user?.email) return
      supabase
        .from('clients')
        .select('id')
        .eq('email', user.email)
        .single()
        .then(({ data }) => {
          if (data?.id) setClientId(data.id)
        })
    })
  }, [])

  if (!clientId) return null

  return <NotificationBell recipientType="client" recipientId={clientId} />
}
