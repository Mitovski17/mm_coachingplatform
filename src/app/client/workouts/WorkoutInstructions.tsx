'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

/**
 * Coach's overall notes for a workout template, surfaced to the client as a
 * button that opens a centred dialog. Renders nothing when the coach left the
 * template notes empty, so callers can drop it in unconditionally.
 */
export default function WorkoutInstructions({
  notes,
  style,
}: {
  notes: string | null | undefined
  style?: React.CSSProperties
}) {
  const { t } = useLanguage()
  // `open` is only ever set from a click, so the portal never runs during SSR.
  const [open, setOpen] = useState(false)

  // Escape closes, and the page behind must not scroll under the dialog.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const text = notes?.trim()
  if (!text) return null

  // Portalled to <body> on purpose. Callers place this button inside cards and
  // headers that carry transforms (.cx-in, .cx-card, .cx-press) — a transformed
  // ancestor becomes the containing block for position:fixed and its own
  // stacking context for backdrop-filter, which docked the dialog to the card
  // and left the blur sampling the card instead of the page behind it.
  const overlay = (
    <div
      onClick={() => setOpen(false)}
      className="cx-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t.workouts.workoutInstructions}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cx-pop"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--cx-r-xl)',
          width: '100%',
          maxWidth: 400,
          maxHeight: 'min(78vh, 620px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--cx-shadow-lg)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <p className="cx-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            {t.workouts.workoutInstructions}
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.common.close}
            className="cx-press"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              backgroundColor: 'var(--color-surface-3)',
              border: 'none', color: 'var(--color-text-hint)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Notes body — the coach's line breaks are the formatting */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '18px 20px 22px' }}>
          <p style={{
            margin: 0,
            fontSize: 14.5,
            lineHeight: 1.65,
            color: 'var(--color-text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {text}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cx-press cx-tint"
        style={{
          // Hugs its label rather than filling the card width.
          display: 'inline-flex', alignItems: 'center', gap: 8,
          alignSelf: 'flex-start',
          width: 'auto',
          verticalAlign: 'top',   // no stray baseline gap under the inline box
          padding: '10px 14px',
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 'var(--cx-r-md)',
          color: 'var(--color-text-secondary)',
          fontSize: 13.5,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          ...style,
        }}
      >
        <Info size={15} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
        {t.workouts.workoutInstructions}
      </button>

      {open && createPortal(overlay, document.body)}
    </>
  )
}
