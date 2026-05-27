'use client'

import { useLanguage } from '@/lib/i18n'

export default function NoCoachState() {
  const { t } = useLanguage()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 68px)', backgroundColor: 'var(--color-base)', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px', textAlign: 'center' }}>{t.messages.noCoachAssigned}</p>
      <p style={{ fontSize: 13, color: 'var(--color-text-hint)', textAlign: 'center' }}>{t.messages.coachWillAppear}</p>
    </div>
  )
}
