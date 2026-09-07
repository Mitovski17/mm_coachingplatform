'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatCountdown } from '@/lib/checkin-window'
import { useLanguage } from '@/lib/i18n'

export default function CheckinWidget({
  submitted,
  nextSundayMs,
}: {
  submitted: boolean
  nextSundayMs: number
}) {
  const { t } = useLanguage()
  const [msLeft, setMsLeft] = useState<number>(() => nextSundayMs - Date.now())

  useEffect(() => {
    if (!submitted) return
    const tick = () => setMsLeft(nextSundayMs - Date.now())
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [submitted, nextSundayMs])

  return (
    <div
      className="cx-card"
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--cx-r-lg)',
        overflow: 'hidden',
      }}
    >
      {/* top accent bar */}
      <div
        style={{
          height: '4px',
          background: submitted
            ? '#22c55e'
            : 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e)',
        }}
      />

      <div style={{ padding: '16px 18px 18px' }}>
        {/* title + badge */}
        <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
          <span className="cx-display" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {t.checkin.title}
          </span>
          {submitted ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#22c55e',
                backgroundColor: 'rgba(34,197,94,0.12)',
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              {t.common.done} ✓
            </span>
          ) : (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#f59e0b',
                backgroundColor: 'rgba(245,158,11,0.12)',
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              {t.home.weeklyCheckinDue}
            </span>
          )}
        </div>

        {submitted ? (
          <>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
              {t.checkin.nextWindowOpens}
            </p>
            <div
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--cx-r-sm)',
                padding: '13px',
                textAlign: 'center',
              }}
            >
              {/* Tabular figures: the countdown must not jitter as digits change */}
              <span
                className="cx-num"
                style={{
                  fontSize: '23px',
                  fontWeight: 800,
                  color: 'var(--color-text-primary)',
                }}
              >
                {formatCountdown(msLeft)}
              </span>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
              {t.home.takesAbout3Min}
            </p>
            <Link
              href="/check-in"
              className="cx-cta cx-display"
              style={{
                display: 'block',
                textAlign: 'center',
                backgroundColor: 'var(--color-accent)',
                color: '#ffffff',
                borderRadius: 'var(--cx-r-sm)',
                padding: '13px',
                fontSize: '15px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              {t.common.start} →
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
