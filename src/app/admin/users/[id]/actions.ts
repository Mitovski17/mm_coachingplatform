'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function suspendUser(userId: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  const { error } = await svc().auth.admin.updateUserById(userId, {
    ban_duration: '876600h', // 100 years
  })
  return { ok: !error }
}

export async function unsuspendUser(userId: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  const { error } = await svc().auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })
  return { ok: !error }
}
