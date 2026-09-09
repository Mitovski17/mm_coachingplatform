import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { RECOVERY_COOKIE } from '@/lib/recovery-cookie'
import ResetPasswordClient from './ResetPasswordClient'

// The recovery cookie is per-request state — never prerender this page.
export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage() {
  const cookieStore = await cookies()

  // Normal path: /auth/confirm parked a recovery token for us. The token is
  // not verified until the form is submitted, so reaching this page costs
  // nothing and can be repeated (refresh, back button, second tap) safely.
  let ready = Boolean(cookieStore.get(RECOVERY_COOKIE)?.value)

  if (!ready) {
    // Fallback: an already-established session (a link whose token was
    // exchanged elsewhere, or a signed-in user changing their password).
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    ready = Boolean(user)
  }

  return <ResetPasswordClient initialReady={ready} />
}
