'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { updateCheckinNotes, markCheckinReviewed } from './actions'
import type { CheckinCard } from './page'

// ─── Constants ────────────────────────────────────────────────────────────────

const NUMERIC_METRICS = [
  { id: 'performance_rating', label: 'Performance', format: (v: number) => `${v}/10` },
  { id: 'nutrition_adherence', label: 'Nutrition', format: (v: number) => `${v}%` },
  { id: 'training_adherence', label: 'Training', format: (v: number) => `${v}%` },
  { id: 'sleep_quality', label: 'Sleep', format: (v: number) => `${v}/10` },
]

const CHOICE_METRICS = [
  { id: 'stress_level', label: 'Stress' },
  { id: 'energy_level', label: 'Energy' },
]

const STRESS_LABELS: Record<string, string> = {
  none: 'No stress',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

const ENERGY_LABELS: Record<string, string> = {
  low: 'Low',
  sometimes: 'Sometimes low',
  normal: 'Normal',
  high: 'Energetic',
}

const TEXT_ANSWERS = [
  { id: 'biggest_challenge', label: 'Biggest challenge' },
  { id: 'schedule_changes', label: 'Upcoming changes' },
  { id: 'anything_else', label: 'Anything else' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNum(answers: Record<string, unknown>, key: string): number | null {
  const v = answers[key]
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function hasRedFlag(answers: Record<string, unknown>): boolean {
  return NUMERIC_METRICS.some(({ id }) => {
    const v = getNum(answers, id)
    return v !== null && v <= 5
  })
}

function trendArrow(current: number | null, prev: number | null): { symbol: string; color: string } {
  if (prev === null || current === null) return { symbol: '—', color: 'var(--color-text-hint)' }
  if (current > prev) return { symbol: '↑', color: '#22c55e' }
  if (current < prev) return { symbol: '↓', color: '#ef4444' }
  return { symbol: '—', color: 'var(--color-text-hint)' }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function CheckinCard({
  card,
  notes,
  onNotesChange,
  onNotesBlur,
  onMarkReviewed,
  isMarkingReviewed,
  isReviewed,
}: {
  card: CheckinCard
  notes: string
  onNotesChange: (v: string) => void
  onNotesBlur: () => void
  onMarkReviewed: () => void
  isMarkingReviewed: boolean
  isReviewed: boolean
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const redFlag = hasRedFlag(card.answers)

  const photos = card.signedPhotoUrls

  return (
    <>
      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}
          onClick={() => setLightboxSrc(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Progress photo"
            style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: '8px' }}
          />
        </div>
      )}

      <div
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {/* ── Card header ── */}
        <div
          className="flex items-start justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {card.clientName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-hint)' }}>
              submitted {formatDistanceToNow(new Date(card.submittedAt!), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {redFlag && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.12)',
                  color: '#ef4444',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}
              >
                🚩 Needs attention
              </span>
            )}
            {isReviewed && (
              <span
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: 'var(--color-text-hint)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Reviewed
              </span>
            )}
          </div>
        </div>

        {/* ── Metrics row ── */}
        <div
          className="flex flex-wrap gap-x-6 gap-y-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          {NUMERIC_METRICS.map(({ id, label, format }) => {
            const curr = getNum(card.answers, id)
            const prev = getNum(card.prevAnswers ?? {}, id)
            const { symbol, color } = trendArrow(curr, prev)
            return (
              <div key={id} className="flex flex-col gap-0.5">
                <span className="text-xs" style={{ color: 'var(--color-text-hint)' }}>
                  {label}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {curr !== null ? format(curr) : '—'}
                  </span>
                  <span className="text-sm font-bold" style={{ color }}>
                    {symbol}
                  </span>
                </div>
              </div>
            )
          })}

          {CHOICE_METRICS.map(({ id, label }) => {
            const raw = card.answers[id] as string | undefined
            const labelMap = id === 'stress_level' ? STRESS_LABELS : ENERGY_LABELS
            const display = raw ? (labelMap[raw] ?? raw) : '—'
            return (
              <div key={id} className="flex flex-col gap-0.5">
                <span className="text-xs" style={{ color: 'var(--color-text-hint)' }}>
                  {label}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  {display}
                </span>
              </div>
            )
          })}

          {/* Weight */}
          {(() => {
            const w = getNum(card.answers, 'current_weight')
            if (w === null) return null
            const prevW = getNum(card.prevAnswers ?? {}, 'current_weight')
            const { symbol, color } = trendArrow(w, prevW)
            return (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs" style={{ color: 'var(--color-text-hint)' }}>Weight</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {w} kg
                  </span>
                  <span className="text-sm font-bold" style={{ color }}>
                    {symbol}
                  </span>
                </div>
              </div>
            )
          })()}
        </div>

        {/* ── Text answers ── */}
        {TEXT_ANSWERS.some(({ id }) => card.answers[id]) && (
          <div
            className="flex flex-col gap-3 px-5 py-4"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            {TEXT_ANSWERS.map(({ id, label }) => {
              const text = card.answers[id] as string | undefined
              if (!text) return null
              return (
                <div key={id}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-hint)' }}>
                    {label}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {text}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Progress photos ── */}
        {photos.length > 0 && (
          <div
            className="flex flex-wrap gap-2 px-5 py-4"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            {photos.map((src, i) => {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightboxSrc(src)}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    border: '1px solid var(--color-border)',
                    padding: 0,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Progress photo ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </button>
              )
            })}
          </div>
        )}

        {/* ── Coach notes + action ── */}
        <div className="px-5 py-4">
          <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-hint)' }}>
            Coach notes
          </p>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            onBlur={onNotesBlur}
            placeholder="Add a private note…"
            rows={3}
            className="w-full text-sm resize-none"
            style={{
              backgroundColor: 'var(--color-surface-3)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              padding: '8px 12px',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-accent)'
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
            }}
          />

          {!isReviewed && (
            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={onMarkReviewed}
                disabled={isMarkingReviewed}
                className="text-sm font-medium px-4 py-1.5 transition-opacity"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: '#fff',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: isMarkingReviewed ? 'not-allowed' : 'pointer',
                  opacity: isMarkingReviewed ? 0.6 : 1,
                }}
              >
                {isMarkingReviewed ? 'Saving…' : 'Mark as reviewed'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export default function CheckInsClient({
  cards,
}: {
  cards: CheckinCard[]
}) {
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending')
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(cards.map((c) => [c.checkinId, c.coachNotes ?? '']))
  )

  const effectivePending = cards.filter((c) => {
    if (reviewedIds.has(c.checkinId)) return false
    return c.status === 'pending'
  })
  const effectiveReviewed = cards.filter((c) => {
    if (reviewedIds.has(c.checkinId)) return true
    return c.status === 'reviewed'
  })

  const displayed = tab === 'pending' ? effectivePending : effectiveReviewed

  const handleMarkReviewed = async (checkinId: string) => {
    setMarkingIds((prev) => new Set([...prev, checkinId]))
    try {
      await markCheckinReviewed(checkinId)
      setReviewedIds((prev) => new Set([...prev, checkinId]))
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev)
        next.delete(checkinId)
        return next
      })
    }
  }

  const handleNotesBlur = async (checkinId: string) => {
    await updateCheckinNotes(checkinId, notes[checkinId] ?? '')
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-4xl">
      {/* Page title */}
      <div className="mb-6">
        <h1
          className="text-2xl"
          style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
        >
          Check-ins
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {cards.length} {cards.length === 1 ? 'check-in' : 'check-ins'} this week
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 p-1"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          display: 'inline-flex',
        }}
      >
        {(['pending', 'reviewed'] as const).map((t) => {
          const count = t === 'pending' ? effectivePending.length : effectiveReviewed.length
          const active = tab === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t === 'pending' ? 'Pending review' : 'Reviewed'}
              <span
                className="inline-flex items-center justify-center text-xs px-1.5 py-0.5"
                style={{
                  minWidth: 20,
                  backgroundColor: active
                    ? (t === 'pending' && count > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)')
                    : 'var(--color-surface-3)',
                  color: active && t === 'pending' && count > 0 ? '#ef4444' : 'var(--color-text-hint)',
                  borderRadius: '9999px',
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Cards */}
      {displayed.length === 0 ? (
        <div
          className="flex items-center justify-center py-16 text-sm"
          style={{
            color: 'var(--color-text-hint)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          {tab === 'pending'
            ? 'No pending check-ins this week'
            : 'No reviewed check-ins this week'}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayed.map((card) => (
            <CheckinCard
              key={card.checkinId}
              card={card}
              notes={notes[card.checkinId] ?? ''}
              onNotesChange={(v) => setNotes((prev) => ({ ...prev, [card.checkinId]: v }))}
              onNotesBlur={() => handleNotesBlur(card.checkinId)}
              onMarkReviewed={() => handleMarkReviewed(card.checkinId)}
              isMarkingReviewed={markingIds.has(card.checkinId)}
              isReviewed={reviewedIds.has(card.checkinId) || card.status === 'reviewed'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
