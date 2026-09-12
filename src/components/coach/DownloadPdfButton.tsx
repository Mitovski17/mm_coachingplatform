'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, Loader2, Check } from 'lucide-react'

type Variant = 'solid' | 'outline' | 'subtle'

type Props = {
  /** Builds and saves the PDF. Errors are surfaced as a toast. */
  onDownload: () => Promise<void>
  label?: string
  busyLabel?: string
  variant?: Variant
  accent?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  title?: string
  fullWidth?: boolean
  /** Renders a square icon-only button, for dense card action rows. */
  iconOnly?: boolean
}

export default function DownloadPdfButton({
  onDownload,
  label = 'Download PDF',
  busyLabel = 'Preparing…',
  variant = 'outline',
  accent = 'var(--color-accent)',
  size = 'md',
  disabled = false,
  title,
  fullWidth = false,
  iconOnly = false,
}: Props) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (state === 'busy' || disabled) return
    setState('busy')
    try {
      await onDownload()
      setState('done')
      setTimeout(() => setState('idle'), 1800)
    } catch (err) {
      setState('idle')
      toast.error(err instanceof Error ? err.message : 'Could not generate the PDF')
    }
  }

  const pad = size === 'sm' ? '5px 10px' : '8px 16px'
  const fontSize = size === 'sm' ? 12 : 13
  const icon = size === 'sm' ? 12 : 14

  const palette: React.CSSProperties =
    variant === 'solid'
      ? { backgroundColor: accent, color: '#fff', border: 'none' }
      : variant === 'subtle'
        ? {
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }
        : {
            backgroundColor: 'transparent',
            color: iconOnly ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
          }

  return (
    // Icon-only sits in dense action rows next to the edit/delete buttons, so
    // it takes the same hover treatment. The labelled form reads as a ghost —
    // except when it is filled, where a ghost's grey hover would fight the
    // accent it is painted in. Both drop their own transition in favour of the
    // shared curves.
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || state === 'busy'}
      title={title ?? label}
      className={iconOnly ? 'cx-icon-btn' : variant === 'solid' ? 'cx-cta' : 'cx-ghost'}
      style={{
        ...palette,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: iconOnly ? 0 : pad,
        fontSize,
        fontWeight: 600,
        borderRadius: iconOnly ? 'var(--cx-r-xs)' : 9,
        cursor: disabled || state === 'busy' ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        width: iconOnly ? 30 : fullWidth ? '100%' : undefined,
        height: iconOnly ? 30 : undefined,
        flexShrink: 0,
      }}
    >
      {state === 'busy' ? (
        <>
          <Loader2 size={icon} className="animate-spin" />
          {!iconOnly && busyLabel}
        </>
      ) : state === 'done' ? (
        <>
          {/* The tick pops in so the state change registers without a toast */}
          <Check size={icon} className="cx-pop" style={{ color: '#22c55e' }} />
          {!iconOnly && 'Downloaded'}
        </>
      ) : (
        <>
          <Download size={icon} />
          {!iconOnly && label}
        </>
      )}
    </button>
  )
}
