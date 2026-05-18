'use client'

import { useState } from 'react'
import { Camera } from 'lucide-react'

// ─── Static data (replace with real fetches later) ─────────────────────────────

const STATS = { starting: 84.2, current: 79.8, unit: 'kg', weekNum: 8, totalWeeks: 12, goal: 78.0 }

const ALL_WEIGHT_DATA = [
  { week: 1,  w: 84.2 },
  { week: 2,  w: 84.0 },
  { week: 3,  w: 83.9 },
  { week: 4,  w: 83.7 },
  { week: 5,  w: 83.4 },
  { week: 6,  w: 82.9 },
  { week: 7,  w: 82.5 },
  { week: 8,  w: 82.1 },
  { week: 9,  w: 81.6 },
  { week: 10, w: 80.9 },
  { week: 11, w: 80.2 },
  { week: 12, w: 79.8 },
]

const WEEK_CARDS = [
  { week: 4, energy: 5, sleep: 6, adherence: 6 },
  { week: 5, energy: 6, sleep: 6, adherence: 7 },
  { week: 6, energy: 7, sleep: 7, adherence: 8 },
  { week: 7, energy: 7, sleep: 6, adherence: 8 },
  { week: 8, energy: 8, sleep: 7, adherence: 9 },
]

const PHOTOS = [
  { label: 'May 1' },
  { label: 'Apr 1' },
  { label: 'Mar 1' },
  { label: 'Feb 1' },
]

// ─── Chart ────────────────────────────────────────────────────────────────────

type FilterKey = '4W' | '8W' | '12W' | 'All'
const FILTER_COUNT: Record<FilterKey, number> = { '4W': 4, '8W': 8, '12W': 12, All: 12 }

function WeightChart({ filter }: { filter: FilterKey }) {
  const count  = FILTER_COUNT[filter]
  const data   = ALL_WEIGHT_DATA.slice(-count)
  const goal   = STATS.goal

  const CW = 320
  const CH = 110
  const PAD = { top: 10, right: 20, bottom: 20, left: 8 }
  const iW = CW - PAD.left - PAD.right
  const iH = CH - PAD.top - PAD.bottom

  const vals   = data.map((d) => d.w)
  const minV   = Math.min(...vals, goal) - 0.5
  const maxV   = Math.max(...vals) + 0.5

  const sx = (i: number) => PAD.left + (i / (data.length - 1)) * iW
  const sy = (v: number) => PAD.top + ((maxV - v) / (maxV - minV)) * iH

  const linePts  = data.map((d, i) => `${sx(i)},${sy(d.w)}`).join(' ')
  const areaPts  = [
    `${sx(0)},${PAD.top + iH}`,
    ...data.map((d, i) => `${sx(i)},${sy(d.w)}`),
    `${sx(data.length - 1)},${PAD.top + iH}`,
  ].join(' ')

  const lastX = sx(data.length - 1)
  const lastY = sy(data[data.length - 1].w)
  const goalY = sy(goal)

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      <defs>
        <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(249,115,22,0.3)" />
          <stop offset="100%" stopColor="rgba(249,115,22,0)" />
        </linearGradient>
      </defs>

      {/* Goal dashed line */}
      <line
        x1={PAD.left} y1={goalY}
        x2={PAD.left + iW} y2={goalY}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <text x={PAD.left + iW + 3} y={goalY + 4} fontSize={8} fill="rgba(255,255,255,0.35)" textAnchor="start">
        Goal {goal}
      </text>

      {/* Area fill */}
      <polygon points={areaPts} fill="url(#orangeGrad)" />

      {/* Line */}
      <polyline
        points={linePts}
        fill="none"
        stroke="#f97316"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot + label */}
      <circle cx={lastX} cy={lastY} r={4} fill="#f97316" />
      <text x={lastX - 4} y={lastY - 9} fontSize={9} fill="#f97316" textAnchor="middle" fontWeight="700">
        {data[data.length - 1].w}
      </text>
    </svg>
  )
}

// ─── Dot rating row ────────────────────────────────────────────────────────────

function DotRow({ label, score, color }: { label: string; score: number; color: string }) {
  const dots = 5
  const filled = Math.round((score / 10) * dots)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-hint)', width: 46, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: i < filled ? color : 'var(--color-surface-3)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', width: 14, textAlign: 'right', flexShrink: 0 }}>
        {score}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [filter, setFilter] = useState<FilterKey>('12W')

  const change = STATS.current - STATS.starting
  const changeStr = change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1)
  const changeColor = change < 0 ? '#22c55e' : '#ef4444'

  const FILTERS: FilterKey[] = ['4W', '8W', '12W', 'All']

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 24 }}>

      {/* ── Header ── */}
      <div style={{ padding: '52px 20px 16px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 4px' }}>
          Week {STATS.weekNum} of {STATS.totalWeeks}
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1 }}>
          Progress
        </h1>
      </div>

      {/* ── Stat chips ── */}
      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Starting',  value: `${STATS.starting}`, unit: STATS.unit, color: 'var(--color-text-primary)' },
          { label: 'Now',       value: `${STATS.current}`,  unit: STATS.unit, color: 'var(--color-text-primary)' },
          { label: 'Change',    value: changeStr,            unit: STATS.unit, color: changeColor },
        ].map(({ label, value, unit, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: '12px 12px 14px',
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px' }}>
              {label}
            </p>
            <p style={{ fontSize: 24, fontWeight: 800, color, margin: 0, lineHeight: 1 }}>
              {value}
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-hint)', marginLeft: 3 }}>
                {unit}
              </span>
            </p>
          </div>
        ))}
      </div>

      {/* ── Bodyweight chart card ── */}
      <div style={{ padding: '0 16px 16px' }}>
        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: '14px 14px 10px',
          }}
        >
          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 2px' }}>
                Bodyweight
              </p>
              <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: 0 }}>
                {FILTER_COUNT[filter]}-week trend
              </p>
            </div>
            {/* Filter pills */}
            <div
              style={{
                display: 'flex',
                gap: 2,
                backgroundColor: 'var(--color-surface-3)',
                borderRadius: 999,
                padding: 3,
              }}
            >
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: filter === f ? 'var(--color-text-primary)' : 'transparent',
                    color: filter === f ? 'var(--color-base)' : 'var(--color-text-hint)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <WeightChart filter={filter} />
        </div>
      </div>

      {/* ── Check-in Trends ── */}
      <section style={{ padding: '0 0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 10px' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: 0 }}>
            Check-in Trends
          </h2>
          <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>Last {WEEK_CARDS.length} weeks</span>
        </div>

        {/* Horizontal scroll */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingLeft: 16,
            paddingRight: 16,
            paddingBottom: 4,
            scrollbarWidth: 'none',
          }}
        >
          {WEEK_CARDS.map((wk) => (
            <div
              key={wk.week}
              style={{
                backgroundColor: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: '12px 14px',
                flexShrink: 0,
                minWidth: 130,
              }}
            >
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 10px' }}>
                Week {wk.week}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <DotRow label="Energy"  score={wk.energy}    color="#f97316" />
                <DotRow label="Sleep"   score={wk.sleep}     color="#3b82f6" />
                <DotRow label="Adher."  score={wk.adherence} color="#22c55e" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Progress Photos ── */}
      <section style={{ padding: '0 0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 10px' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: 0 }}>
            Progress Photos
          </h2>
          <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{PHOTOS.length} submitted</span>
        </div>

        {/* 2×2 portrait grid */}
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {PHOTOS.map((p) => (
            <div
              key={p.label}
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 14,
                aspectRatio: '3 / 4',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <Camera size={22} style={{ color: 'var(--color-text-hint)' }} />
              <span style={{ fontSize: 12, color: 'var(--color-text-hint)', fontWeight: 500 }}>
                {p.label}
              </span>
            </div>
          ))}

          {/* Add photo tile */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1.5px dashed var(--color-border)',
              borderRadius: 14,
              aspectRatio: '3 / 4',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: 'var(--color-surface-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-hint)' }}>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text-hint)', fontWeight: 500 }}>Add photo</span>
          </div>
        </div>
      </section>

    </div>
  )
}
