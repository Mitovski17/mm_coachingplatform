'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { en, tx, type Translations } from './en'
import { bg } from './bg'
import { updateLanguage, type Lang } from './actions'

export type { Lang, Translations }
export { tx }

const DICTS: Record<Lang, Translations> = { en, bg }

type LanguageContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Lang
  children: ReactNode
}) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    void updateLanguage(next)
  }, [])

  const value: LanguageContextValue = {
    lang,
    setLang,
    t: DICTS[lang],
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
