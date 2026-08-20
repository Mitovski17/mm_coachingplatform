'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Scale } from 'lucide-react'
import type { ProgressData, WeightDataPoint } from './progress-actions'
import { uploadStandalonePhoto, saveClientWeight } from './progress-actions'
import { useLanguage, type Translations } from '@/lib/i18n'
import { normalizeDecimalInput } from '@/lib/numeric-input'

type FilterKey = '4W' | '8W' | '12W' | 'All'
const FILTER_COUNT: Record<FilterKey, number> = { '4W': 4, '8W': 8, '12W': 12, All: 9999 }

function WeightChart({
  data,
  goal,
  filter,
  t,
}: {
  data: WeightDataPoint[]
  goal: number | null
  filter: FilterKey
  t: Translations
}) {
  const count = FILTER_COUNT[filter]
  const visible = data.slice(-count)

  if (visible.length === 0) {
    return (
      <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>{t.progress.noWeightData}</span>
      </div>
    )
  }

  const CW = 320
  const CH = 110
  const PAD = { top: 10, right: 20, bottom: 20, left: 8 }
  const iW = CW - PAD.left - PAD.right
  const iH = CH - PAD.top - PAD.bottom

  const vals = visible.map((d) => d.w)
  const minV = Math.min(...vals, ...(goal != null ? [goal] : [])) - 0.5
  const maxV = Math.max(...vals) + 0.5

  const sx = (i: number) =>
    visible.length === 1 ? PAD.left + iW / 2 : PAD.left + (i / (visible.length - 1)) * iW
  const sy = (v: number) => PAD.top + ((maxV - v) / (maxV - minV)) * iH

  const linePts = visible.map((d, i) => `${sx(i)},${sy(d.w)}`).join(' ')
  const areaPts = [
    `${sx(0)},${PAD.top + iH}`,
    ...visible.map((d, i) => `${sx(i)},${sy(d.w)}`),
    `${sx(visible.length - 1)},${PAD.top + iH}`,
  ].join(' ')

  const lastX = sx(visible.length - 1)
  const lastY = sy(visible[visible.length - 1].w)
  const goalY = goal != null ? sy(goal) : null

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      <defs>
        <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(249,115,22,0.3)" />
          <stop offset="100%" stopColor="rgba(249,115,22,0)" />
        </linearGradient>
      </defs>

      {goalY != null && (
        <>
          <line
            x1={PAD.left}
            y1={goalY}
            x2={PAD.left + iW}
            y2={goalY}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={PAD.left + iW + 3}
            y={goalY + 4}
            fontSize={8}
            fill="rgba(255,255,255,0.35)"
            textAnchor="start"
          >
            {t.progress.goal} {goal}
          </text>
        </>
      )}

      <polygon points={areaPts} fill="url(#orangeGrad)" />

      <polyline
        points={linePts}
        fill="none"
        stroke="#f97316"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx={lastX} cy={lastY} r={4} fill="#f97316" />
      <text
        x={lastX - 4}
        y={lastY - 9}
        fontSize={9}
        fill="#f97316"
        textAnchor="middle"
        fontWeight="700"
      >
        {visible[visible.length - 1].w}
      </text>
    </svg>
  )
}

function DotRow({
  label,
  score,
  color,
}: {
  label: string
  score: number
  color: string
}) {
  const dots = 5
  const filled = Math.round((score / 10) * dots)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-hint)', width: 46, flexShrink: 0 }}>
        {label}
      </span>
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

export default function ProgressClient({ data }: { data: ProgressData }) {
  const router = useRouter()
  const { t } = useLanguage()
  const [filter, setFilter] = useState<FilterKey>('All')

  // Upload modal state
  const [showUploadModal, setShowUploadModal]   = useState(false)
  const [uploadFile, setUploadFile]             = useState<File | null>(null)
  const [uploading, setUploading]               = useState(false)
  const [uploadError, setUploadError]           = useState<string | null>(null)
  const uploadInputRef                          = useRef<HTMLInputElement>(null)

  // Weight log modal state
  const [showWeightModal, setShowWeightModal]   = useState(false)
  const [weightDate, setWeightDate]             = useState(() => new Date().toISOString().split('T')[0])
  const [weightValue, setWeightValue]           = useState('')
  const [savingWeight, setSavingWeight]         = useState(false)
  const [weightError, setWeightError]           = useState<string | null>(null)

  const { clientId, workspaceId, starting, current, unit, weekNum, goal, weightData, weekCards, photos } = data

  const change =
    starting != null && current != null ? current - starting : null
  const changeStr =
    change != null
      ? change > 0
        ? `+${change.toFixed(1)}`
        : change.toFixed(1)
      : '—'
  const changeColor =
    change == null ? 'var(--color-text-primary)' : change < 0 ? '#22c55e' : '#ef4444'

  const FILTERS: FilterKey[] = ['4W', '8W', '12W', 'All']

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      setUploadError(null)
    }
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }

  function closeModal() {
    if (uploading) return
    setShowUploadModal(false)
    setUploadFile(null)
    setUploadError(null)
  }

  async function handleUpload() {
    if (!uploadFile) return
    if (uploadFile.size > 25 * 1024 * 1024) {
      setUploadError('Photo is too large. Please choose a photo under 25MB.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('clientId', clientId)
      fd.append('workspaceId', workspaceId)
      await uploadStandalonePhoto(fd)
      setShowUploadModal(false)
      setUploadFile(null)
      router.refresh()
    } catch (err) {
      console.error('[progress] photo upload failed:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setUploadError(msg || t.progress.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  function closeWeightModal() {
    if (savingWeight) return
    setShowWeightModal(false)
    setWeightValue('')
    setWeightError(null)
  }

  async function handleSaveWeight() {
    const w = parseFloat(weightValue)
    if (!weightDate || isNaN(w) || w <= 0) return
    setSavingWeight(true)
    setWeightError(null)
    try {
      await saveClientWeight({ clientId, workspaceId, recordedDate: weightDate, weight: w })
      setShowWeightModal(false)
      setWeightValue('')
      router.refresh()
    } catch {
      setWeightError(t.progress.saveFailed)
    } finally {
      setSavingWeight(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ padding: '52px 20px 16px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 4px' }}>
          {t.progress.week} {weekNum}
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1 }}>
          {t.progress.title}
        </h1>
      </div>

      {/* Stat chips */}
      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: t.progress.starting, value: starting != null ? `${starting}` : t.common.noData, unit: starting != null ? unit : '', color: 'var(--color-text-primary)' },
          { label: t.progress.current,  value: current  != null ? `${current}`  : t.common.noData, unit: current  != null ? unit : '', color: 'var(--color-text-primary)' },
          { label: t.progress.change,   value: changeStr, unit: change != null ? unit : '', color: changeColor },
        ].map(({ label, value, unit: u, color }) => (
          <div
            key={label}
            style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 12px 14px' }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px' }}>
              {label}
            </p>
            <p style={{ fontSize: 24, fontWeight: 800, color, margin: 0, lineHeight: 1 }}>
              {value}
              {u && (
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-hint)', marginLeft: 3 }}>
                  {u}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Bodyweight chart card */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 14px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 2px' }}>
                {t.progress.bodyWeight}
              </p>
              <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: 0 }}>
                {filter === 'All' ? t.progress.all : `${FILTER_COUNT[filter]} ${t.progress.week.toLowerCase()}`}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => { setWeightDate(new Date().toISOString().split('T')[0]); setShowWeightModal(true) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-2)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <Scale size={12} />
                {t.progress.logWeight}
              </button>
            <div style={{ display: 'flex', gap: 2, backgroundColor: 'var(--color-surface-3)', borderRadius: 999, padding: 3 }}>
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
          </div>
          <WeightChart data={weightData} goal={goal} filter={filter} t={t} />
        </div>
      </div>

      {/* Check-in Trends */}
      {weekCards.length > 0 ? (
        <section style={{ padding: '0 0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 10px' }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: 0 }}>
              {t.progress.weeklySummary}
            </h2>
            <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>
              {weekCards.length} {t.progress.week.toLowerCase()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingLeft: 16, paddingRight: 16, paddingBottom: 4, scrollbarWidth: 'none' }}>
            {weekCards.map((wk) => (
              <div
                key={wk.week}
                style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 14px', flexShrink: 0, minWidth: 130 }}
              >
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 10px' }}>
                  {wk.label}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <DotRow label={t.progress.energy}    score={wk.energy}    color="#f97316" />
                  <DotRow label={t.progress.sleep}     score={wk.sleep}     color="#3b82f6" />
                  <DotRow label={t.progress.nutrition} score={wk.adherence} color="#22c55e" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
            {t.progress.weeklySummary}
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-hint)', margin: 0 }}>
            {t.progress.noCheckins}
          </p>
        </section>
      )}

      {/* Progress Photos */}
      <section style={{ padding: '0 0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 10px' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: 0 }}>
            {t.progress.photos}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>
              {photos.length}
            </span>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Camera size={12} />
              {t.progress.addPhoto}
            </button>
          </div>
        </div>

        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {photos.map((p, i) => (
            <div
              key={i}
              style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 14, aspectRatio: '3 / 4', overflow: 'hidden', position: 'relative' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Progress photo ${p.date}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 10px', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
                <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{p.date}</span>
              </div>
            </div>
          ))}

          {photos.length === 0 && (
            <div
              style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 14, aspectRatio: '3 / 4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Camera size={22} style={{ color: 'var(--color-text-hint)' }} />
              <span style={{ fontSize: 12, color: 'var(--color-text-hint)', fontWeight: 500 }}>
                {t.progress.noPhotos}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Add Photo modal */}
      {showUploadModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.75)', padding: 24 }}
          onClick={closeModal}
        >
          <div
            style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
              {t.progress.addPhoto}
            </h3>

            {/* Hidden file input */}
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileSelect}
            />

            {!uploadFile ? (
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '40px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px dashed var(--color-border)',
                  borderRadius: 14,
                  color: 'var(--color-text-hint)',
                  cursor: 'pointer',
                }}
              >
                <Camera size={28} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>{t.progress.selectPhoto}</span>
              </button>
            ) : (
              <div style={{ position: 'relative', aspectRatio: '3 / 4', borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--color-surface-2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(uploadFile)}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => setUploadFile(null)}
                    style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            {uploadError && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: '#ef4444' }}>{uploadError}</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={closeModal}
                disabled={uploading}
                style={{
                  flex: 1,
                  padding: '13px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 12,
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-secondary)',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.5 : 1,
                }}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                style={{
                  flex: 1,
                  padding: '13px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: uploadFile && !uploading ? 'var(--color-accent)' : 'var(--color-surface-3)',
                  color: uploadFile && !uploading ? '#fff' : 'var(--color-text-hint)',
                  cursor: uploadFile && !uploading ? 'pointer' : 'not-allowed',
                }}
              >
                {uploading ? t.progress.uploading : t.progress.uploadPhoto}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Weight modal */}
      {showWeightModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.75)', padding: 24 }}
          onClick={closeWeightModal}
        >
          <div
            style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>
              {t.progress.logWeightTitle}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)', display: 'block', marginBottom: 6 }}>
                  {t.progress.date}
                </label>
                <input
                  type="date"
                  value={weightDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setWeightDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 14,
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface-2)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)', display: 'block', marginBottom: 6 }}>
                  {t.progress.weight} ({unit})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  min="1"
                  max="999"
                  placeholder={t.progress.weightPlaceholder}
                  value={weightValue}
                  onChange={(e) => setWeightValue(normalizeDecimalInput(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 14,
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface-2)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {weightError && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: '#ef4444' }}>{weightError}</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={closeWeightModal}
                disabled={savingWeight}
                style={{
                  flex: 1,
                  padding: '13px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 12,
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-secondary)',
                  cursor: savingWeight ? 'not-allowed' : 'pointer',
                  opacity: savingWeight ? 0.5 : 1,
                }}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveWeight}
                disabled={!weightValue || !weightDate || savingWeight}
                style={{
                  flex: 1,
                  padding: '13px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: weightValue && weightDate && !savingWeight ? 'var(--color-accent)' : 'var(--color-surface-3)',
                  color: weightValue && weightDate && !savingWeight ? '#fff' : 'var(--color-text-hint)',
                  cursor: weightValue && weightDate && !savingWeight ? 'pointer' : 'not-allowed',
                }}
              >
                {savingWeight ? t.progress.saving : t.progress.logWeight}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
