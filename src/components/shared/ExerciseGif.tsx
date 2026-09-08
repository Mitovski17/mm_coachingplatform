'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, X } from 'lucide-react'
import { useLanguageOptional } from '@/lib/i18n'
import { resolveExerciseGif } from '@/lib/exercise-gifs'

/**
 * A paused thumbnail of an exercise demonstration that opens the animation
 * centred over the page. Renders nothing when the exercise has no verified GIF,
 * so callers can drop it in unconditionally next to any exercise name.
 *
 * `name` is the canonical English name used for the lookup; `label` is whatever
 * the client should read in the dialog header — the two differ under BG.
 */
export default function ExerciseGif({
  name,
  label,
  size = 40,
  style,
}: {
  name: string
  label?: string
  size?: number
  /** Overrides on the thumbnail button, for callers that need it to fill. */
  style?: React.CSSProperties
}) {
  const { t } = useLanguageOptional()
  // Only ever set from a click, so the portal never runs during SSR.
  const [open, setOpen] = useState(false)
  // The still is cached from the thumbnail; the ~300 KB GIF is not, so it fades
  // in over the still rather than leaving an empty frame.
  const [gifReady, setGifReady] = useState(false)
  // The artwork comes off a third-party CDN. If it ever stops answering, drop
  // the control rather than leave a broken-image icon mid-workout.
  const [failed, setFailed] = useState(false)

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

  const gif = resolveExerciseGif(name)
  if (!gif || failed) return null

  const title = label ?? name

  // Portalled to <body> for the same reason WorkoutInstructions is: this sits
  // inside `.cx-card` / `.cx-press` rows whose transforms would otherwise become
  // the containing block for position:fixed and capture the backdrop blur.
  const overlay = (
    <div
      onClick={() => setOpen(false)}
      className="cx-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
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
          maxWidth: 420,
          overflow: 'hidden',
          boxShadow: 'var(--cx-shadow-lg)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '16px 18px 14px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{ minWidth: 0 }}>
            <p className="cx-display" style={{
              fontSize: 17, fontWeight: 800, color: 'var(--color-text-primary)',
              margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {title}
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--color-text-hint)', margin: '2px 0 0' }}>
              {t.workouts.howToPerform}
            </p>
          </div>
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

        {/* The demonstrations are drawn on white, so the stage stays white in
            both themes rather than letting the artwork float on a dark card. */}
        <div style={{
          position: 'relative',
          backgroundColor: '#fff',
          aspectRatio: '1 / 1',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gif.thumbUrl}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'contain',
            }}
          />
          {/* next/image would re-encode the animation to a still frame, and the
              CDN is already serving these compressed and cached. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gif.gifUrl}
            alt={title}
            onLoad={() => setGifReady(true)}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'contain',
              opacity: gifReady ? 1 : 0,
              transition: 'opacity 200ms ease',
            }}
          />
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        aria-label={`${t.workouts.viewDemo}: ${title}`}
        className="cx-press"
        style={{
          position: 'relative',
          width: size, height: size, flexShrink: 0,
          padding: 0,
          // White to match the artwork; the border is what separates it from
          // the card underneath in light mode.
          backgroundColor: '#fff',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 'var(--cx-r-sm)',
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'block',
          ...style,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gif.thumbUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Play affordance — the still gives no hint that there is more. */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', right: 2, bottom: 2,
            width: 14, height: 14, borderRadius: '50%',
            backgroundColor: 'rgba(0,0,0,0.62)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Play size={7} fill="#fff" color="#fff" />
        </span>
      </button>

      {open && createPortal(overlay, document.body)}
    </>
  )
}
