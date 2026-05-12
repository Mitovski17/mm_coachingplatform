'use client'

import { useEffect } from 'react'

export default function CoachError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[coach] page error:', error)
  }, [error])

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-4"
      style={{ backgroundColor: 'var(--color-base)', color: 'var(--color-text-primary)' }}
    >
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
        Something went wrong loading this page.
      </p>
      <p style={{ color: 'var(--color-text-hint)', fontSize: 12, fontFamily: 'monospace' }}>
        {error.message}
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: '8px 20px',
          borderRadius: 8,
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
