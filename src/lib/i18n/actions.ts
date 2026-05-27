'use server'

import { createClient } from '@/lib/supabase/server'

export type Lang = 'en' | 'bg'

export async function updateLanguage(lang: Lang): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ language: lang })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return {}
}
