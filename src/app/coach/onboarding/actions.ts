'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type CoachingFocus = 'training' | 'nutrition' | 'both'
export type ClientCountRange = 'starting' | '1-10' | '10+'

export async function completeCoachOnboarding(
  coachingFocus: CoachingFocus,
  clientCountRange: ClientCountRange,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = adminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      onboarding_completed: true,
      coaching_focus: coachingFocus,
      client_count_range: clientCountRange,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}
