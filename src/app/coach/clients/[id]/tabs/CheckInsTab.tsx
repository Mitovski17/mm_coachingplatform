'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import type { Checkin, ProgressPhoto } from '../actions'

const cardBase: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-1)',
  borderRadius: 'var(--radius-2xl, 16px)',
  border: '1px solid var(--color-border)',
  padding: 16,
}

function pillColor(value: number, scale: 'ten' | 'pct'): string {
  const isHigh = scale === 'ten' ? value >= 7 : value >= 70
  const isMid = scale === 'ten' ? value >= 5 : value >= 50
  if (isHigh) return '#22c55e'
  if (isMid) return '#f59e0b'
  return '#ef4444'
}

function MetricPill({
  label,
  value,
  scale,
}: {
  label: string
  value: number | null
  scale: 'ten' | 'pct'
}) {
  if (value === null) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-xs"
        style={{
          backgroundColor: 'var(--color-surface-3)',
          color: 'var(--color-text-hint)',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 500,
        }}
      >
        {label}: —
      </span>
    )
  }
  const c = pillColor(value, scale)
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs"
      style={{
        backgroundColor: c + '22',
        color: c,
        borderRadius: 'var(--radius-sm)',
        fontWeight: 600,
      }}
    >
      {label}: {value}
      {scale === 'ten' ? '/10' : '%'}
    </span>
  )
}

function MiniSparkline({
  values,
  color,
}: {
  values: number[]
  color: string
}) {
  if (values.length < 2) {
    return (
      <div
        style={{ height: 40, color: 'var(--color-text-hint)', fontSize: 11 }}
        className="flex items-center"
      >
        Not enough data
      </div>
    )
  }
  const W = 120
  const H = 40
  const pad = 4
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = (W - pad * 2) / (values.length - 1)
  const pts = values.map((v, i) => {
    const x = pad + i * step
    const y = pad + ((max - v) / range) * (H - pad * 2)
    return [x, y] as const
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <polyline
        points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2} fill={color} />
      ))}
    </svg>
  )
}

function TrendCard({
  title,
  values,
  unit,
}: {
  title: string
  values: number[]
  unit: string
}) {
  const last = values[values.length - 1]
  const first = values[0]
  const declining =
    values.length >= 2 && last !== undefined && first !== undefined && last < first
  const color = declining ? '#ef4444' : '#22c55e'
  return (
    <div
      style={{
        ...cardBase,
        padding: 14,
      }}
    >
      <div
        className="text-xs uppercase tracking-wide mb-1"
        style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
      >
        {title}
      </div>
      <div
        className="text-lg mb-1"
        style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
      >
        {last !== undefined ? `${last}${unit}` : '—'}
      </div>
      <MiniSparkline values={values} color={color} />
    </div>
  )
}

function PhotoModal({
  src,
  onClose,
}: {
  src: string
  onClose: () => void
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', padding: 24 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Progress"
        style={{ maxWidth: '95vw', maxHeight: '95vh', borderRadius: 8 }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

function CheckinCardItem({
  checkin,
  photoMap,
}: {
  checkin: Checkin
  photoMap: Map<string, string>
}) {
  const [expanded, setExpanded] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const photoUrls = checkin.photoPaths
    .map((p) => photoMap.get(p))
    .filter((u): u is string => !!u)

  return (
    <>
      {lightbox && <PhotoModal src={lightbox} onClose={() => setLightbox(null)} />}
      <div style={cardBase}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                color: 'var(--color-text-primary)',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Week of {format(new Date(checkin.weekStartDate), 'MMM d, yyyy')}
            </div>
            <span
              className="inline-flex items-center px-2 py-0.5 text-xs"
              style={{
                backgroundColor: checkin.reviewed
                  ? 'rgba(34,197,94,0.12)'
                  : 'rgba(245,158,11,0.12)',
                color: checkin.reviewed ? '#22c55e' : '#f59e0b',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 500,
              }}
            >
              {checkin.reviewed ? 'Reviewed' : 'Pending'}
            </span>
          </div>
          <span
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.15s',
              color: 'var(--color-text-hint)',
              display: 'inline-block',
            }}
          >
            ▾
          </span>
        </button>

        {/* Pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          <MetricPill
            label="Perf"
            value={checkin.performanceRating}
            scale="ten"
          />
          <MetricPill label="Sleep" value={checkin.sleepQuality} scale="ten" />
          <MetricPill
            label="Nutrition"
            value={checkin.nutritionAdherence}
            scale="pct"
          />
          <MetricPill
            label="Training"
            value={checkin.trainingAdherence}
            scale="pct"
          />
        </div>

        {expanded && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {checkin.weight !== null && (
                <span
                  className="inline-flex items-center px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: 'var(--color-surface-3)',
                    color: 'var(--color-text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 500,
                  }}
                >
                  Weight: {checkin.weight} kg
                </span>
              )}
              {checkin.stressLevel && (
                <span
                  className="inline-flex items-center px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: 'var(--color-surface-3)',
                    color: 'var(--color-text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 500,
                  }}
                >
                  Stress: {checkin.stressLevel}
                </span>
              )}
              {checkin.energyLevel && (
                <span
                  className="inline-flex items-center px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: 'var(--color-surface-3)',
                    color: 'var(--color-text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 500,
                  }}
                >
                  Energy: {checkin.energyLevel}
                </span>
              )}
            </div>

            {checkin.biggestWin && (
              <div className="text-sm">
                <div
                  className="text-xs uppercase mb-1"
                  style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
                >
                  Biggest Win
                </div>
                <div style={{ color: 'var(--color-text-primary)' }}>
                  {checkin.biggestWin}
                </div>
              </div>
            )}
            {checkin.biggestChallenge && (
              <div className="text-sm">
                <div
                  className="text-xs uppercase mb-1"
                  style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
                >
                  Biggest Challenge
                </div>
                <div style={{ color: 'var(--color-text-primary)' }}>
                  {checkin.biggestChallenge}
                </div>
              </div>
            )}
            {checkin.scheduleChanges && (
              <div className="text-sm">
                <div
                  className="text-xs uppercase mb-1"
                  style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
                >
                  Schedule Changes
                </div>
                <div style={{ color: 'var(--color-text-secondary)' }}>
                  {checkin.scheduleChanges}
                </div>
              </div>
            )}
            {checkin.anythingElse && (
              <div className="text-sm">
                <div
                  className="text-xs uppercase mb-1"
                  style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
                >
                  Anything else
                </div>
                <div style={{ color: 'var(--color-text-secondary)' }}>
                  {checkin.anythingElse}
                </div>
              </div>
            )}

            {photoUrls.length > 0 && (
              <div>
                <div
                  className="text-xs uppercase mb-2"
                  style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
                >
                  Progress Photos
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {photoUrls.map((url, i) => (
                    <button key={i} onClick={() => setLightbox(url)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Progress"
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 8,
                          backgroundColor: 'var(--color-surface-2)',
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {checkin.notes && (
              <div
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div
                  className="text-xs uppercase mb-1"
                  style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
                >
                  Coach Notes
                </div>
                <div
                  className="text-sm whitespace-pre-wrap"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {checkin.notes}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default function CheckInsTab({
  checkins,
  photos,
}: {
  checkins: Checkin[]
  photos: ProgressPhoto[]
}) {
  // Build a path → signed URL map from progress photo entries.
  // The actions module returns an array of signed URLs without the original
  // path; here we approximate via order: rebuild via week_start_date matching.
  // Photos array is ordered by weekStartDate ascending, we don't have paths
  // back from getProgressPhotos. So we'll just look up by URL substring.
  const photoMap = useMemo(() => {
    const m = new Map<string, string>()
    // Match: in checkins (newest→oldest), iterate paths and pull URLs from
    // photos array (oldest→newest) in lockstep order.
    const flatPaths: string[] = []
    const ordered = [...checkins].slice().reverse() // oldest first
    for (const ci of ordered) {
      for (const p of ci.photoPaths) flatPaths.push(p)
    }
    for (let i = 0; i < flatPaths.length && i < photos.length; i++) {
      m.set(flatPaths[i], photos[i].url)
    }
    return m
  }, [checkins, photos])

  // Build trend series from last 6 check-ins (oldest→newest)
  const last6 = checkins.slice(0, 6).reverse()
  const perfSeries = last6
    .map((c) => c.performanceRating)
    .filter((v): v is number => v !== null)
  const sleepSeries = last6
    .map((c) => c.sleepQuality)
    .filter((v): v is number => v !== null)
  const nutSeries = last6
    .map((c) => c.nutritionAdherence)
    .filter((v): v is number => v !== null)
  const trainSeries = last6
    .map((c) => c.trainingAdherence)
    .filter((v): v is number => v !== null)

  if (checkins.length === 0) {
    return (
      <div
        style={cardBase}
        className="text-sm text-center py-8"
      >
        <div style={{ color: 'var(--color-text-hint)' }}>
          No check-ins submitted yet.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Trend cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TrendCard title="Performance" values={perfSeries} unit="/10" />
        <TrendCard title="Sleep" values={sleepSeries} unit="/10" />
        <TrendCard title="Nutrition Adherence" values={nutSeries} unit="%" />
        <TrendCard title="Training Adherence" values={trainSeries} unit="%" />
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {checkins.map((c) => (
          <CheckinCardItem key={c.id} checkin={c} photoMap={photoMap} />
        ))}
      </div>
    </div>
  )
}
