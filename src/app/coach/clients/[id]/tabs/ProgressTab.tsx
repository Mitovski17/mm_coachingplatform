'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import type { Checkin, ProgressPhoto } from '../actions'

const cardBase: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-1)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  padding: 16,
}

type WeightPoint = { date: string; weight: number }

function WeightChart({ points }: { points: WeightPoint[] }) {
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: 200, color: 'var(--color-text-hint)' }}
      >
        Not enough data yet.
      </div>
    )
  }
  const W = 600
  const H = 200
  const padX = 30
  const padY = 28
  const min = Math.min(...points.map((p) => p.weight)) - 2
  const max = Math.max(...points.map((p) => p.weight)) + 2
  const range = max - min || 1
  const step = (W - padX * 2) / (points.length - 1)
  const pts = points.map((p, i) => {
    const x = padX + i * step
    const y = padY + ((max - p.weight) / range) * (H - padY * 2)
    return { x, y, ...p }
  })
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ')
  const polygon = `${padX},${H - padY} ${polyline} ${W - padX},${H - padY}`

  // X-axis labels: first, last, and any first-of-month
  const monthShown = new Set<string>()
  const xLabels = pts
    .map((p, i) => {
      const d = new Date(p.date)
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`
      const isFirstLast = i === 0 || i === pts.length - 1
      const isMonthStart =
        d.getDate() <= 7 && !monthShown.has(monthKey) && i !== 0
      if (isFirstLast || isMonthStart) {
        monthShown.add(monthKey)
        return { x: p.x, label: format(d, 'MMM d') }
      }
      return null
    })
    .filter((v): v is { x: number; label: string } => !!v)

  const first = points[0].weight
  const last = points[points.length - 1].weight
  const totalChange = last - first
  const changeColor = totalChange < 0 ? '#22c55e' : totalChange > 0 ? '#f97316' : 'var(--color-text-muted)'

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="weight-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <polygon points={polygon} fill="url(#weight-grad)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#fff" />
        ))}

        {/* Y-axis labels */}
        <text x={4} y={padY + 4} fontSize={10} fill="#6B6B6B">
          {max.toFixed(1)}
        </text>
        <text x={4} y={H - padY + 4} fontSize={10} fill="#6B6B6B">
          {min.toFixed(1)}
        </text>

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={H - 6}
            fontSize={10}
            fill="#B0B0B0"
            textAnchor="middle"
          >
            {l.label}
          </text>
        ))}
      </svg>
      <div className="flex items-center justify-between mt-2">
        <div
          className="text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Current: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{last} kg</span>
        </div>
        <div
          className="text-sm"
          style={{ color: changeColor, fontWeight: 600 }}
        >
          {totalChange > 0 ? '+' : ''}
          {totalChange.toFixed(1)} kg total
        </div>
      </div>
    </div>
  )
}

export default function ProgressTab({
  checkins,
  photos,
}: {
  checkins: Checkin[]
  photos: ProgressPhoto[]
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)

  const points: WeightPoint[] = checkins
    .slice()
    .reverse()
    .filter((c) => c.weight !== null)
    .map((c) => ({ date: c.weekStartDate, weight: c.weight as number }))

  function togglePhoto(url: string) {
    setSelected((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url)
      if (prev.length >= 2) return [prev[1], url]
      const next = [...prev, url]
      if (next.length === 2) setShowCompare(true)
      return next
    })
  }

  const selectedWithMeta = selected
    .map((url) => photos.find((p) => p.url === url))
    .filter((p): p is ProgressPhoto => !!p)

  return (
    <div className="flex flex-col gap-4">
      <div style={cardBase}>
        <div
          className="text-xs uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
        >
          Weight Trend
        </div>
        <WeightChart points={points} />
      </div>

      <div style={cardBase}>
        <div className="flex items-center justify-between mb-3">
          <div
            className="text-xs uppercase tracking-wide"
            style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
          >
            Progress Photos
          </div>
          <span
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>

        {photos.length === 0 ? (
          <div
            className="text-sm text-center py-6"
            style={{ color: 'var(--color-text-hint)' }}
          >
            No progress photos submitted yet.
          </div>
        ) : (
          <>
            {selected.length === 1 && (
              <div
                className="text-xs mb-3"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Select another photo to compare
                <button
                  onClick={() => setSelected([])}
                  className="ml-2 hover:underline"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Clear
                </button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => {
                const isSelected = selected.includes(photo.url)
                return (
                  <div key={photo.url} className="flex flex-col gap-1">
                    <button
                      onClick={() => togglePhoto(photo.url)}
                      className="block"
                      style={{
                        aspectRatio: '1',
                        borderRadius: 12,
                        overflow: 'hidden',
                        backgroundColor: 'var(--color-surface-2)',
                        border: isSelected
                          ? '2px solid var(--color-accent)'
                          : '2px solid transparent',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt="Progress"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </button>
                    <div
                      className="text-xs text-center"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {format(new Date(photo.weekStartDate), 'MMM d, yyyy')}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Comparison modal */}
      {showCompare && selectedWithMeta.length === 2 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)', padding: 24 }}
          onClick={() => {
            setShowCompare(false)
            setSelected([])
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowCompare(false)
              setSelected([])
            }}
            className="absolute top-4 right-4 text-2xl"
            style={{ color: '#fff' }}
            aria-label="Close"
          >
            ×
          </button>
          <div
            className="grid grid-cols-2 gap-4 max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedWithMeta.map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt="Progress"
                  style={{
                    maxHeight: '80vh',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    borderRadius: 8,
                  }}
                />
                <div
                  className="text-sm"
                  style={{ color: '#fff' }}
                >
                  {format(new Date(p.weekStartDate), 'MMM d, yyyy')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
