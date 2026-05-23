'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function flagDigest(id: string, reason: string): Promise<{ ok: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc() as any)
    .from('ai_digests')
    .update({ flagged: true, flag_reason: reason })
    .eq('id', id)
  revalidatePath('/admin/content')
  return { ok: !error }
}

export async function unflagDigest(id: string): Promise<{ ok: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc() as any)
    .from('ai_digests')
    .update({ flagged: false, flag_reason: null })
    .eq('id', id)
  revalidatePath('/admin/content')
  return { ok: !error }
}
