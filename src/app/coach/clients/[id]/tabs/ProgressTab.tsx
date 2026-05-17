'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import type { BodyMetric, Checkin, ProgressPhoto } from '../actions'
import { saveBodyMetric } from '../actions'

const cardBase: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-1)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  padding: 16,
}

type WeightPoint = { date: string; weight: number; source: 'checkin' | 'metric' }

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

  const monthShown = new Set<string>()
  const xLabels = pts
    .map((p, i) => {
      const d = new Date(p.date)
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`
      const isFirstLast = i === 0 || i === pts.length - 1
      const isMonthStart = d.getDate() <= 7 && !monthShown.has(monthKey) && i !== 0
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
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        <defs>
          <linearGradient id="weight-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <polygon points={polygon} fill="url(#weight-grad)" />
        <polyline points={polyline} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={p.source === 'metric' ? '#22c55e' : '#fff'} />
        ))}
        <text x={4} y={padY + 4} fontSize={10} fill="#6B6B6B">{max.toFixed(1)}</text>
        <text x={4} y={H - padY + 4} fontSize={10} fill="#6B6B6B">{min.toFixed(1)}</text>
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 6} fontSize={10} fill="#B0B0B0" textAnchor="middle">
            {l.label}
          </text>
        ))}
      </svg>
      <div className="flex items-center justify-between mt-2">
        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Current: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{last} kg</span>
        </div>
        <div className="text-sm" style={{ color: changeColor, fontWeight: 600 }}>
          {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)} kg total
        </div>
      </div>
    </div>
  )
}

type RangeKey = '7d' | '2w' | '3w' | '4w' | '2m' | '3m'

const RANGE_DAYS: Record<RangeKey, number> = {
  '7d': 7,
  '2w': 14,
  '3w': 21,
  '4w': 30,
  '2m': 60,
  '3m': 90,
}

const RANGE_LABELS: Record<RangeKey, string> = {
  '7d': 'Last 7 days',
  '2w': 'Last 2 weeks',
  '3w': 'Last 3 weeks',
  '4w': 'Last 1 month',
  '2m': 'Last 2 months',
  '3m': 'Last 3 months',
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-text-primary)',
  fontSize: 13,
  padding: '6px 10px',
  width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--color-text-muted)',
  marginBottom: 4,
  display: 'block',
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function parseOptionalNum(v: string): number | undefined {
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}

type FormState = {
  recordedDate: string
  weight: string
  bodyFatPct: string
  waistCm: string
  chestCm: string
  hipsCm: string
  leftArmCm: string
  rightArmCm: string
  leftThighCm: string
  rightThighCm: string
  notes: string
}

function emptyForm(): FormState {
  return {
    recordedDate: today(),
    weight: '',
    bodyFatPct: '',
    waistCm: '',
    chestCm: '',
    hipsCm: '',
    leftArmCm: '',
    rightArmCm: '',
    leftThighCm: '',
    rightThighCm: '',
    notes: '',
  }
}

export default function ProgressTab({
  checkins,
  photos,
  bodyMetrics,
  clientId,
  workspaceId,
}: {
  checkins: Checkin[]
  photos: ProgressPhoto[]
  bodyMetrics: BodyMetric[]
  clientId: string
  workspaceId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [range, setRange] = useState<RangeKey>('3m')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range])
  const cutoffISO = cutoff.toISOString().split('T')[0]

  const filteredCheckins = checkins.filter((c) => c.weekStartDate >= cutoffISO)
  const filteredPhotos = photos.filter((p) => p.weekStartDate >= cutoffISO)

  // Merge check-in weight points and body_metrics weight points; body_metrics wins on same date
  const checkinPoints: WeightPoint[] = filteredCheckins
    .slice()
    .reverse()
    .filter((c) => c.weight !== null)
    .map((c) => ({ date: c.weekStartDate, weight: c.weight as number, source: 'checkin' as const }))

  const metricPoints: WeightPoint[] = bodyMetrics
    .filter((m) => m.weight !== null && m.recordedDate >= cutoffISO)
    .map((m) => ({ date: m.recordedDate, weight: m.weight as number, source: 'metric' as const }))

  const mergedMap = new Map<string, WeightPoint>()
  for (const p of checkinPoints) mergedMap.set(p.date, p)
  for (const p of metricPoints) mergedMap.set(p.date, p) // metric overwrites checkin on same date
  const points: WeightPoint[] = Array.from(mergedMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  )

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

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveBodyMetric({
        clientId,
        workspaceId,
        recordedDate: form.recordedDate,
        weight: parseOptionalNum(form.weight),
        bodyFatPct: parseOptionalNum(form.bodyFatPct),
        waistCm: parseOptionalNum(form.waistCm),
        chestCm: parseOptionalNum(form.chestCm),
        hipsCm: parseOptionalNum(form.hipsCm),
        leftArmCm: parseOptionalNum(form.leftArmCm),
        rightArmCm: parseOptionalNum(form.rightArmCm),
        leftThighCm: parseOptionalNum(form.leftThighCm),
        rightThighCm: parseOptionalNum(form.rightThighCm),
        notes: form.notes || undefined,
      })
      setShowModal(false)
      setForm(emptyForm())
      startTransition(() => router.refresh())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => { setForm(emptyForm()); setShowModal(true) }}
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 14px',
            cursor: 'pointer',
          }}
        >
          + Log Measurements
        </button>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as RangeKey)}
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-text-secondary)',
            fontSize: '13px',
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <option key={k} value={k}>{RANGE_LABELS[k]}</option>
          ))}
        </select>
      </div>

      <div style={cardBase}>
        <div className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}>
          Weight Trend
        </div>
        <WeightChart points={points} />
      </div>

      {/* Measurements history table */}
      <div style={cardBase}>
        <div className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}>
          Measurements History
        </div>
        {bodyMetrics.length === 0 ? (
          <div className="text-sm text-center py-4" style={{ color: 'var(--color-text-hint)' }}>
            No measurements logged yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--color-text-hint)', textAlign: 'left' }}>
                  {['Date', 'Weight (kg)', 'Body Fat %', 'Waist (cm)', 'Chest (cm)', 'Hips (cm)'].map((h) => (
                    <th key={h} style={{ padding: '4px 10px 8px 0', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyMetrics.map((m) => (
                  <tr key={m.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '7px 10px 7px 0', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {format(new Date(m.recordedDate), 'MMM d, yyyy')}
                    </td>
                    <td style={{ padding: '7px 10px 7px 0', color: 'var(--color-text-primary)' }}>{m.weight ?? '—'}</td>
                    <td style={{ padding: '7px 10px 7px 0', color: 'var(--color-text-primary)' }}>{m.bodyFatPct ?? '—'}</td>
                    <td style={{ padding: '7px 10px 7px 0', color: 'var(--color-text-primary)' }}>{m.waistCm ?? '—'}</td>
                    <td style={{ padding: '7px 10px 7px 0', color: 'var(--color-text-primary)' }}>{m.chestCm ?? '—'}</td>
                    <td style={{ padding: '7px 10px 7px 0', color: 'var(--color-text-primary)' }}>{m.hipsCm ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={cardBase}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}>
            Progress Photos
          </div>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {filteredPhotos.length} {filteredPhotos.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>

        {filteredPhotos.length === 0 ? (
          <div className="text-sm text-center py-6" style={{ color: 'var(--color-text-hint)' }}>
            No progress photos submitted yet.
          </div>
        ) : (
          <>
            {selected.length === 1 && (
              <div className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
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
              {filteredPhotos.map((photo) => {
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
                        border: isSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt="Progress"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </button>
                    <div className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                      {format(new Date(photo.weekStartDate), 'MMM d, yyyy')}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {showCompare && selectedWithMeta.length === 2 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)', padding: 24 }}
          onClick={() => { setShowCompare(false); setSelected([]) }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowCompare(false); setSelected([]) }}
            className="absolute top-4 right-4 text-2xl"
            style={{ color: '#fff' }}
            aria-label="Close"
          >
            x
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
                  style={{ maxHeight: '80vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }}
                />
                <div className="text-sm" style={{ color: '#fff' }}>
                  {format(new Date(p.weekStartDate), 'MMM d, yyyy')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log Measurements modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', padding: 24 }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 20 }}>
              Log Measurements
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={form.recordedDate}
                  onChange={(e) => setField('recordedDate', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Weight (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 75.5"
                    value={form.weight}
                    onChange={(e) => setField('weight', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Body Fat %</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 18.5"
                    value={form.bodyFatPct}
                    onChange={(e) => setField('bodyFatPct', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label style={labelStyle}>Waist (cm)</label>
                  <input type="number" step="0.1" placeholder="—" value={form.waistCm} onChange={(e) => setField('waistCm', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Chest (cm)</label>
                  <input type="number" step="0.1" placeholder="—" value={form.chestCm} onChange={(e) => setField('chestCm', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Hips (cm)</label>
                  <input type="number" step="0.1" placeholder="—" value={form.hipsCm} onChange={(e) => setField('hipsCm', e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Left Arm (cm)</label>
                  <input type="number" step="0.1" placeholder="—" value={form.leftArmCm} onChange={(e) => setField('leftArmCm', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Right Arm (cm)</label>
                  <input type="number" step="0.1" placeholder="—" value={form.rightArmCm} onChange={(e) => setField('rightArmCm', e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Left Thigh (cm)</label>
                  <input type="number" step="0.1" placeholder="—" value={form.leftThighCm} onChange={(e) => setField('leftThighCm', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Right Thigh (cm)</label>
                  <input type="number" step="0.1" placeholder="—" value={form.rightThighCm} onChange={(e) => setField('rightThighCm', e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea
                  rows={3}
                  placeholder="Optional notes..."
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-text-secondary)',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '7px 16px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || isPending}
                style={{
                  backgroundColor: 'var(--color-accent)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '7px 16px',
                  cursor: saving || isPending ? 'not-allowed' : 'pointer',
                  opacity: saving || isPending ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
