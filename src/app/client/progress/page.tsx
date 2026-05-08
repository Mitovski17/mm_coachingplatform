'use client'

import { Camera } from 'lucide-react'

const weightData = [
  { day: 1, w: 85.4 },
  { day: 4, w: 85.1 },
  { day: 7, w: 85.0 },
  { day: 10, w: 84.9 },
  { day: 13, w: 84.8 },
  { day: 16, w: 84.6 },
  { day: 19, w: 84.7 },
  { day: 22, w: 84.4 },
  { day: 25, w: 84.3 },
  { day: 28, w: 84.2 },
]

const CHART_W = 320
const CHART_H = 100
const PAD = { top: 8, right: 8, bottom: 24, left: 36 }
const innerW = CHART_W - PAD.left - PAD.right
const innerH = CHART_H - PAD.top - PAD.bottom
const MIN_W = 83.5
const MAX_W = 86.0

function scaleX(day: number) {
  return PAD.left + ((day - 1) / 27) * innerW
}
function scaleY(w: number) {
  return PAD.top + ((MAX_W - w) / (MAX_W - MIN_W)) * innerH
}

const points = weightData.map((d) => `${scaleX(d.day)},${scaleY(d.w)}`).join(' ')
const areaPoints = [
  `${scaleX(weightData[0].day)},${PAD.top + innerH}`,
  ...weightData.map((d) => `${scaleX(d.day)},${scaleY(d.w)}`),
  `${scaleX(weightData[weightData.length - 1].day)},${PAD.top + innerH}`,
].join(' ')

const yLabels = [86, 85.5, 85, 84.5, 84]

interface SparklineProps {
  values: number[]
  color: string
}
function Sparkline({ values, color }: SparklineProps) {
  const w = 48
  const h = 24
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const checkInTrends = [
  { label: 'Performance', values: [7, 8, 7, 9], latest: '9 / 10', color: '#3b82f6' },
  { label: 'Nutrition adherence', values: [70, 80, 70, 90], latest: '90%', color: '#10b981' },
  { label: 'Sleep quality', values: [6, 7, 8, 8], latest: '8 / 10', color: '#a855f7' },
  { label: 'Stress', values: [3, 2, 2, 1], latest: 'Low', color: '#f59e0b' },
]

const photoSlots = [
  { label: 'May 1' },
  { label: 'Apr 1' },
  { label: 'Mar 1' },
  { label: 'Add photo', empty: true },
]

export default function ProgressPage() {
  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      <div
        className="flex items-center justify-between"
        style={{ padding: '52px 20px 20px' }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          Progress
        </h1>
        <select
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-text-secondary)',
            fontSize: '13px',
            padding: '6px 10px',
            cursor: 'pointer',
          }}
          defaultValue="4w"
          aria-label="Time range"
        >
          <option value="7d">Last 7 days</option>
          <option value="2w">Last 2 weeks</option>
          <option value="3w">Last 3 weeks</option>
          <option value="4w">Last 1 month</option>
          <option value="2m">Last 2 months</option>
          <option value="3m">Last 3 months</option>
        </select>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            padding: '16px',
          }}
        >
          <div className="flex items-start justify-between" style={{ marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-hint)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                Body Weight
              </p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1 }}>
                84.2 kg
              </p>
            </div>
            <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600, marginTop: '4px' }}>
              down 0.8 kg this month
            </span>
          </div>

          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            style={{ width: '100%', height: 'auto', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            {yLabels.map((v) => (
              <text key={v} x={PAD.left - 6} y={scaleY(v) + 4} textAnchor="end" fill="var(--color-text-hint)" fontSize={9}>
                {v}
              </text>
            ))}
            {yLabels.map((v) => (
              <line key={v} x1={PAD.left} y1={scaleY(v)} x2={PAD.left + innerW} y2={scaleY(v)} stroke="var(--color-border)" strokeWidth={0.5} />
            ))}
            <polygon points={areaPoints} fill="url(#wGrad)" />
            <polyline points={points} fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={scaleX(weightData[weightData.length - 1].day)} cy={scaleY(weightData[weightData.length - 1].w)} r={3.5} fill="#ffffff" />
          </svg>
        </div>
      </div>

      <section style={{ padding: '0 16px 16px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Check-in Trends
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {checkInTrends.map((t) => (
            <div
              key={t.label}
              style={{
                backgroundColor: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '14px',
              }}
            >
              <div className="flex items-start justify-between" style={{ marginBottom: '8px' }}>
                <p style={{ fontSize: '11px', color: 'var(--color-text-hint)', margin: 0, fontWeight: 500, lineHeight: 1.3 }}>
                  {t.label}
                </p>
                <Sparkline values={t.values} color={t.color} />
              </div>
              <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1 }}>
                {t.latest}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '0 16px 16px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Progress Photos
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {photoSlots.map((slot) => (
            <div
              key={slot.label}
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                aspectRatio: '1 / 1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Camera size={22} style={{ color: 'var(--color-text-hint)' }} />
              <span style={{ fontSize: '11px', color: 'var(--color-text-hint)', fontWeight: 500 }}>
                {slot.label}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
