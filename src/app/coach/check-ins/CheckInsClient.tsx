'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { updateCheckinNotes, markCheckinReviewed } from './actions'
import type { CheckinCard } from './page'

// ─── Constants ────────────────────────────────────────────────────────────────

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

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNum(answers: Record<string, unknown>, key: string): number | null {
  const v = answers[key]
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function hasRedFlag(answers: Record<string, unknown>): boolean {
  const numericIds = ['performance_rating', 'nutrition_adherence', 'training_adherence', 'sleep_quality']
  return numericIds.some((id) => {
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

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function pillColor(value: number, scale: 'ten' | 'pct'): string {
  const isHigh = scale === 'ten' ? value >= 7 : value >= 70
  const isMid = scale === 'ten' ? value >= 5 : value >= 50
  if (isHigh) return '#22c55e'
  if (isMid) return '#f59e0b'
  return '#ef4444'
}

function MetricPill({ label, value, scale, trend }: {
  label: string
  value: number | null
  scale: 'ten' | 'pct'
  trend?: { symbol: string; color: string }
}) {
  if (value === null) return null
  const c = pillColor(value, scale)
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs"
      style={{
        backgroundColor: c + '22',
        color: c,
        borderRadius: 'var(--radius-sm)',
        fontWeight: 600,
      }}
    >
      {label}: {value}{scale === 'ten' ? '/10' : '%'}
      {trend && trend.symbol !== '—' && (
        <span style={{ color: trend.color, fontWeight: 700 }}>{trend.symbol}</span>
      )}
    </span>
  )
}

function ChoicePill({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs"
      style={{
        backgroundColor: 'var(--color-surface-3)',
        color: 'var(--color-text-secondary)',
        borderRadius: 'var(--radius-sm)',
        fontWeight: 500,
      }}
    >
      {label}: {value}
    </span>
  )
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
  const [notesExpanded, setNotesExpanded] = useState(!!notes)
  const redFlag = hasRedFlag(card.answers)
  const photos = card.signedPhotoUrls
  const bgColor = avatarColor(card.clientName)
  const initials = getInitials(card.clientName)

  const perfVal = getNum(card.answers, 'performance_rating')
  const nutVal = getNum(card.answers, 'nutrition_adherence')
  const trainVal = getNum(card.answers, 'training_adherence')
  const sleepVal = getNum(card.answers, 'sleep_quality')
  const weightVal = getNum(card.answers, 'current_weight')
  const prevPerf = getNum(card.prevAnswers ?? {}, 'performance_rating')
  const prevNut = getNum(card.prevAnswers ?? {}, 'nutrition_adherence')
  const prevTrain = getNum(card.prevAnswers ?? {}, 'training_adherence')
  const prevSleep = getNum(card.prevAnswers ?? {}, 'sleep_quality')
  const prevWeight = getNum(card.prevAnswers ?? {}, 'current_weight')

  const stressRaw = card.answers['stress_level'] as string | undefined
  const energyRaw = card.answers['energy_level'] as string | undefined
  const stressDisplay = stressRaw ? (STRESS_LABELS[stressRaw] ?? stressRaw) : null
  const energyDisplay = energyRaw ? (ENERGY_LABELS[energyRaw] ?? energyRaw) : null

  const weightTrend = trendArrow(weightVal, prevWeight)

  return (
    <>
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
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '0.02em',
              }}
            >
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {card.clientName}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-hint)' }}>
                submitted {formatDistanceToNow(new Date(card.submittedAt!), { addSuffix: true })}
              </p>
            </div>
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
                  backgroundColor: 'rgba(34,197,94,0.12)',
                  color: '#22c55e',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Reviewed
              </span>
            )}
            <Link
              href={`/coach/clients/${card.clientId}?tab=check-ins`}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1"
              style={{
                backgroundColor: 'var(--color-surface-3)',
                color: 'var(--color-text-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                textDecoration: 'none',
              }}
            >
              View full check-in ↗
            </Link>
          </div>
        </div>

        {/* ── Metric pills ── */}
        <div className="flex flex-wrap gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <MetricPill label="Performance" value={perfVal} scale="ten" trend={trendArrow(perfVal, prevPerf)} />
          <MetricPill label="Nutrition" value={nutVal} scale="pct" trend={trendArrow(nutVal, prevNut)} />
          <MetricPill label="Training" value={trainVal} scale="pct" trend={trendArrow(trainVal, prevTrain)} />
          <MetricPill label="Sleep" value={sleepVal} scale="ten" trend={trendArrow(sleepVal, prevSleep)} />
          {weightVal !== null && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs"
              style={{
                backgroundColor: 'var(--color-surface-3)',
                color: 'var(--color-text-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 500,
              }}
            >
              Weight: {weightVal} kg
              {weightTrend.symbol !== '—' && (
                <span style={{ color: weightTrend.color, fontWeight: 700 }}>{weightTrend.symbol}</span>
              )}
            </span>
          )}
          {stressDisplay && <ChoicePill label="Stress" value={stressDisplay} />}
          {energyDisplay && <ChoicePill label="Energy" value={energyDisplay} />}
        </div>

        {/* ── Text answers + photos side by side ── */}
        {(TEXT_ANSWERS.some(({ id }) => card.answers[id]) || photos.length > 0) && (
          <div
            className="flex gap-4 px-4 py-3"
            style={{ borderBottom: '1px solid var(--color-border)', alignItems: 'flex-start' }}
          >
            {/* Text answers */}
            {TEXT_ANSWERS.some(({ id }) => card.answers[id]) && (
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {TEXT_ANSWERS.map(({ id, label }) => {
                  const text = card.answers[id] as string | undefined
                  if (!text) return null
                  return (
                    <div key={id}>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-hint)' }}>{label}</p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{text}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Progress photos */}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2" style={{ flexShrink: 0 }}>
                {photos.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightboxSrc(src)}
                    style={{
                      width: 80,
                      height: 80,
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
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Coach notes + actions ── */}
        <div className="px-4 py-3">
          {(notesExpanded || notes) && (
            <div className="mb-2">
              <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-hint)' }}>Coach notes</p>
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                onBlur={() => { onNotesBlur(); if (!notes) setNotesExpanded(false) }}
                placeholder="Add a private note…"
                rows={2}
                autoFocus={notesExpanded && !notes}
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
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
                onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              {!notesExpanded && !notes && (
                <button
                  type="button"
                  onClick={() => setNotesExpanded(true)}
                  className="text-xs"
                  style={{ color: 'var(--color-text-hint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  + Add note
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/coach/messages/${card.clientId}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5"
                style={{
                  backgroundColor: 'var(--color-surface-3)',
                  color: 'var(--color-text-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  textDecoration: 'none',
                }}
              >
                💬 Send message
              </Link>
              {!isReviewed && (
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
              )}
            </div>
          </div>
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
