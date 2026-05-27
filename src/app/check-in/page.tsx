import { createClient } from '@/lib/supabase/server'
import { LanguageProvider, type Lang } from '@/lib/i18n'
import CheckInForm from './CheckInForm'

async function resolveLang(): Promise<Lang> {
  try {
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return 'en'
    const { data: profile } = await sb
      .from('profiles')
      .select('language')
      .eq('id', user.id)
      .maybeSingle()
    const lang = profile?.language
    if (lang === 'bg' || lang === 'en') return lang
  } catch {
    // ignore
  }
  return 'en'
}

export default async function CheckInPage() {
  const lang = await resolveLang()
  return (
    <LanguageProvider initialLang={lang}>
      <CheckInForm />
    </LanguageProvider>
  )
}
