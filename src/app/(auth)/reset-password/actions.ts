'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { RECOVERY_COOKIE } from '@/lib/recovery-cookie'

export type UpdatePasswordResult = {
  error: string | null
  /** True when the recovery link can no longer be used and a new one is needed. */
  expired?: boolean
}

/**
 * Sets a new password for the user identified by the pending recovery token.
 *
 * This is the only place a recovery token is consumed. It runs on a POST, so
 * mail scanners and link prefetchers — which only ever issue GETs — cannot
 * burn the token before the user gets to it.
 */
export async function updatePassword(password: string): Promise<UpdatePasswordResult> {
  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  const cookieStore = await cookies()
  const tokenHash = cookieStore.get(RECOVERY_COOKIE)?.value
  const supabase = await createClient()

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    })

    if (error) {
      cookieStore.delete(RECOVERY_COOKIE)
      // The token may already have been spent by an earlier submit in this same
      // browser — in which case a valid recovery session exists and we can
      // still finish the job. Only a genuinely unusable link is fatal.
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('[reset-password] verifyOtp(recovery) failed', { error: error.message })
        return {
          error: 'This reset link is no longer valid. Please request a new one.',
          expired: true,
        }
      }
    }
  } else {
    // No pending token: the session must already carry recovery rights (older
    // links that arrive with tokens in the URL fragment take this path).
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return {
        error: 'This reset link is no longer valid. Please request a new one.',
        expired: true,
      }
    }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { error: error.message }
  }

  cookieStore.delete(RECOVERY_COOKIE)

  // Drop the recovery session so the user signs in fresh with the new password,
  // and so any other session opened with the old one is revoked.
  try {
    await supabase.auth.signOut()
  } catch {
    // Best effort — the password change already succeeded.
  }

  return { error: null }
}
