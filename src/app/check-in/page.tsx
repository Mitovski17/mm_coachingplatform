'use client'

import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ensureDefaultTemplate, getClientByEmail, uploadProgressPhoto, submitCheckin } from './actions'
import type { Question, ChoiceOption } from './actions'
import { getSundayStart, getNextSundayMidnight, formatCountdown } from '@/lib/checkin-window'

// ─── Color helpers for the gradient scale ─────────────────────────────────────

// Maps a 0-1 progress value to a red→orange→green HSL color
function scaleColor(normalized: number): string {
  const hue = Math.round(normalized * 140)
  return `hsl(${hue}, 75%, 55%)`
}

// For a value 1-10 (normal or inverted for stress)
function scaleValueColor(value: number, inverted: boolean): string {
  const raw = (value - 1) / 9
  return scaleColor(inverted ? 1 - raw : raw)
}

// For adherence options 0/25/50/75/100 → red→green
function adherenceColor(pct: number): string {
  return scaleColor(pct / 100)
}

// ─── Emoji map ────────────────────────────────────────────────────────────────

const Q_EMOJI: Record<string, string> = {
  current_weight:      '⚖️',
  performance_rating:  '🏆',
  nutrition_adherence: '🥗',
  training_adherence:  '🏋️',
  sleep_quality:       '😴',
  stress_level:        '😤',
  energy_level:        '⚡',
  biggest_win:         '🏅',
  biggest_challenge:   '🧱',
  schedule_changes:    '📅',
  anything_else:       '💬',
  progress_photo:      '📸',
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-6 w-6"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ color: 'var(--color-text-hint)' }}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.961 3 8.12l3-2.829z"
      />
    </svg>
  )
}

function Wordmark() {
  return (
    <div className="flex flex-col mb-8">
      <span className="text-xl leading-tight" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
        Mitovski
      </span>
      <span className="text-xl leading-tight" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
        Coaching
      </span>
    </div>
  )
}

// ─── Answer inputs ────────────────────────────────────────────────────────────

function NumberInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mt-6">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full px-4 py-4 text-sm outline-none transition-colors placeholder:text-[#6B6B6B]"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-secondary)',
          paddingRight: '3rem',
        }}
        onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--color-border-strong)' }}
        onBlur={(e)  => { e.currentTarget.style.border = '1px solid var(--color-border)' }}
      />
      <span
        className="absolute right-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none select-none"
        style={{ color: 'var(--color-text-hint)' }}
      >
        kg
      </span>
    </div>
  )
}

function ScaleSlider({
  value,
  inverted,
  onChange,
  onRelease,
}: {
  value: number | undefined
  inverted: boolean
  onChange: (v: number) => void
  onRelease: () => void
}) {
  const displayVal = value ?? 5
  const valueColor = scaleValueColor(displayVal, inverted)
  const gradient   = inverted
    ? 'linear-gradient(to right, #22c55e, #f97316 50%, #ef4444)'
    : 'linear-gradient(to right, #ef4444, #f97316 50%, #22c55e)'

  const pointerDownRef = useRef(false)

  const handleRelease = () => {
    if (pointerDownRef.current) {
      pointerDownRef.current = false
      onChange(displayVal)
      setTimeout(onRelease, 300)
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-5">
      {/* Large value centered above track */}
      <div className="text-center">
        <span
          style={{
            fontSize: '88px',
            fontWeight: 700,
            lineHeight: 1,
            color: valueColor,
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 0.1s ease',
            display: 'inline-block',
          }}
        >
          {displayVal}
        </span>
      </div>

      {/* Horizontal slider — CSS vars cascade into pseudo-elements */}
      <div
        style={{
          '--slider-thumb-color': valueColor,
          '--slider-gradient': gradient,
        } as React.CSSProperties}
      >
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={displayVal}
          className="checkin-scale-slider w-full"
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => { pointerDownRef.current = true }}
          onPointerUp={handleRelease}
          onTouchEnd={handleRelease}
        />
      </div>

      {/* End labels */}
      <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-hint)' }}>
        <span>low</span>
        <span>high</span>
      </div>
    </div>
  )
}

function OptionsInput({
  value,
  onChange,
  onRelease,
}: {
  value: number | undefined
  onChange: (v: number) => void
  onRelease: () => void
}) {
  // Always 0 / 25 / 50 / 75 / 100 — min=0 max=100 step=25
  const displayVal = value ?? 50
  const valueColor = adherenceColor(displayVal)
  const gradient   = 'linear-gradient(to right, #ef4444, #f97316 50%, #22c55e)'

  const pointerDownRef = useRef(false)

  const handleRelease = () => {
    if (pointerDownRef.current) {
      pointerDownRef.current = false
      onChange(displayVal)
      setTimeout(onRelease, 300)
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-5">
      {/* Value label centered above track */}
      <div className="text-center">
        <span
          style={{
            fontSize: '88px',
            fontWeight: 700,
            lineHeight: 1,
            color: valueColor,
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 0.1s ease',
            display: 'inline-block',
          }}
        >
          {displayVal}%
        </span>
      </div>

      {/* Horizontal slider */}
      <div
        style={{
          '--slider-thumb-color': valueColor,
          '--slider-gradient': gradient,
        } as React.CSSProperties}
      >
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={displayVal}
          className="checkin-scale-slider w-full"
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => { pointerDownRef.current = true }}
          onPointerUp={handleRelease}
          onTouchEnd={handleRelease}
        />
      </div>

      {/* End labels */}
      <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-hint)' }}>
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

function ChoiceInput({
  options,
  value,
  onPick,
}: {
  options: ChoiceOption[]
  value: string | undefined
  onPick: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-6">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            className="flex flex-col items-center justify-center gap-2 transition-all"
            style={{
              padding: '1.5rem 0.75rem',
              backgroundColor: active ? 'var(--color-accent-dim)' : 'var(--color-surface-2)',
              border: active ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{opt.emoji}</span>
            <span
              className="text-sm font-medium text-center leading-tight"
              style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
            >
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      rows={4}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full mt-6 px-4 py-3 text-sm outline-none resize-none transition-colors placeholder:text-[#6B6B6B]"
      placeholder="Type your answer…"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-secondary)',
      }}
      onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--color-border-strong)' }}
      onBlur={(e)  => { e.currentTarget.style.border = '1px solid var(--color-border)' }}
    />
  )
}

function PhotoInput({
  files,
  onFilesChange,
}: {
  files: File[]
  onFilesChange: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAdd = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked || files.length >= 3) return
    onFilesChange([...files, picked])
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleRemove = (idx: number) => {
    onFilesChange(files.filter((_, i) => i !== idx))
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleAdd}
      />

      {files.length === 0 ? (
        /* Empty state — full-width tap target */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-10 flex flex-col items-center gap-2 transition-colors"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-hint)',
            cursor: 'pointer',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <span className="text-sm">Tap to add a photo</span>
          <span className="text-xs" style={{ color: 'var(--color-text-hint)' }}>Up to 3 photos</span>
        </button>
      ) : (
        /* Thumbnail row + add tile */
        <div className="grid grid-cols-3 gap-2">
          {files.map((file, i) => (
            <div key={i} className="relative" style={{ aspectRatio: '1' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover"
                style={{ borderRadius: 'var(--radius-md)' }}
              />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}

          {files.length < 3 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1"
              style={{
                aspectRatio: '1',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-hint)',
                cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-xs">Add</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function NavButton({
  onClick, label, variant = 'primary', disabled, flex,
}: {
  onClick: () => void; label: string; variant?: 'primary' | 'ghost'; disabled?: boolean; flex?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${flex ? 'flex-1' : 'w-full'}`}
      style={{
        backgroundColor: variant === 'primary' ? 'var(--color-text-primary)' : 'transparent',
        color: variant === 'primary' ? 'var(--color-base)' : 'var(--color-text-muted)',
        border: variant === 'primary' ? 'none' : '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function SkipLink({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-3 text-center">
      <button
        type="button"
        onClick={onClick}
        className="text-sm"
        style={{ color: 'var(--color-text-hint)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        Skip this question
      </button>
    </div>
  )
}

// ─── Full-screen state screens ────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center" style={{ backgroundColor: 'var(--color-base)' }}>
      <Spinner />
    </div>
  )
}

function CheckinDoneScreen({ justSubmitted }: { justSubmitted: boolean }) {
  const [msLeft, setMsLeft] = useState<number>(() => getNextSundayMidnight().getTime() - Date.now())

  useEffect(() => {
    const tick = () => setMsLeft(getNextSundayMidnight().getTime() - Date.now())
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6" style={{ backgroundColor: 'var(--color-base)' }}>
      <div className="w-full max-w-sm text-center">
        <Wordmark />

        <div
          className="mb-6 flex h-14 w-14 mx-auto items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--color-accent-dim)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-accent)' }}>
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          {justSubmitted ? "You're checked in." : 'Already checked in.'}
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
          {justSubmitted
            ? "Your coach will review this shortly. Now let's get back to work."
            : "Your coach already has your update for this week."}
        </p>

        <div
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
          }}
        >
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-hint)' }}>
            Next check-in window opens in
          </p>
          <p
            style={{
              fontSize: '32px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
            }}
          >
            {formatCountdown(msLeft)}
          </p>
        </div>

        <Link
          href="/client"
          style={{
            display: 'block',
            marginTop: '16px',
            textAlign: 'center',
            backgroundColor: 'var(--color-text-primary)',
            color: 'var(--color-base)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type PageStatus = 'loading' | 'ready' | 'already_submitted' | 'success'

export default function CheckInPage() {
  const router = useRouter()

  const [pageStatus, setPageStatus]     = useState<PageStatus>('loading')
  const [questions, setQuestions]       = useState<Question[]>([])
  const [step, setStep]                 = useState(0)
  const [answers, setAnswers]           = useState<Record<string, string | number>>({})
  const [photoFiles, setPhotoFiles]     = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [clientId, setClientId]         = useState('')
  const [workspaceId, setWorkspaceId]   = useState('')
  const [templateId, setTemplateId]     = useState('')

  useEffect(() => {
    const init = async () => {
      let email: string

      const mockCookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('dev_mock_email='))
        ?.split('=')[1]

      if (mockCookie) {
        email = decodeURIComponent(mockCookie)
      } else {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) { router.replace('/login'); return }
        email = user.email
      }

      const client = await getClientByEmail(email)
      if (!client) { router.replace('/login'); return }

      setClientId(client.id)
      setWorkspaceId(client.workspace_id)

      const supabase = createClient()
      const weekStart = getSundayStart()
      const { data: existing } = await supabase
        .from('checkins')
        .select('id')
        .eq('client_id', client.id)
        .eq('week_start_date', weekStart)
        .maybeSingle()

      if (existing) { setPageStatus('already_submitted'); return }

      const template = await ensureDefaultTemplate(client.workspace_id)
      setTemplateId(template.id)
      setQuestions(template.questions)
      setPageStatus('ready')
    }

    init().catch((err) => {
      console.error('[check-in] init failed:', err)
      setError('Failed to load check-in. Please refresh.')
      setPageStatus('ready')
    })
  }, [router])

  // ── Derived
  const total         = questions.length
  const currentQ      = questions[step]
  const progress      = total > 0 ? Math.round(((step + 1) / total) * 100) : 0
  const isLast        = step === total - 1
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined

  // ── Navigation
  const advance = () => {
    if (!isLast) {
      setStep((s) => s + 1)
    } else {
      void handleSubmit()
    }
  }

  const back = () => setStep((s) => s - 1)

  const skip = () => {
    setAnswers((prev) => {
      const next = { ...prev }
      delete next[currentQ.id]
      return next
    })
    if (currentQ.id === 'progress_photo') setPhotoFiles([])
    advance()
  }

  const setAnswer = (value: string | number) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: value }))
  }

  // ── Submission
  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    const photoPaths: string[] = []

    if (photoFiles.length > 0) {
      try {
        for (const file of photoFiles) {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('workspaceId', workspaceId)
          fd.append('clientId', clientId)
          photoPaths.push(await uploadProgressPhoto(fd))
        }
      } catch {
        setError('Photo upload failed. Try again or skip the photo.')
        setIsSubmitting(false)
        return
      }
    }

    const finalAnswers: Record<string, string | number | string[] | null> = { ...answers }
    if (photoPaths.length > 0) finalAnswers.progress_photo = photoPaths

    try {
      await submitCheckin({
        workspace_id:    workspaceId,
        client_id:       clientId,
        template_id:     templateId,
        answers:         finalAnswers,
        week_start_date: getSundayStart(),
      })
    } catch {
      setError('Submission failed. Please try again.')
      setIsSubmitting(false)
      return
    }

    setPageStatus('success')
  }

  // ── Screen routing
  if (pageStatus === 'loading')           return <LoadingScreen />
  if (pageStatus === 'already_submitted') return <CheckinDoneScreen justSubmitted={false} />
  if (pageStatus === 'success')           return <CheckinDoneScreen justSubmitted={true} />
  if (!currentQ)                          return <LoadingScreen />

  const isAutoAdvance = currentQ.type === 'scale_1_10' || currentQ.type === 'options' || currentQ.type === 'choice'
  const hasAnswer = currentAnswer !== undefined && currentAnswer !== ''

  return (
    <div className="flex min-h-dvh flex-col" style={{ backgroundColor: 'var(--color-base)' }}>

      {/* ── Progress bar with gradient fill ── */}
      <div style={{ position: 'relative', height: '3px', flexShrink: 0, backgroundColor: 'var(--color-surface-3)' }}>
        {/* Full-width gradient, revealed by hiding the right portion */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #ef4444, #f97316 50%, #22c55e)' }} />
        <div
          style={{
            position: 'absolute',
            top: 0, right: 0,
            width: `${100 - progress}%`,
            height: '100%',
            backgroundColor: 'var(--color-surface-3)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex flex-col justify-center px-6 py-10">
          <div className="w-full max-w-sm mx-auto">
            <Wordmark />

            {/* Step counter with emoji */}
            <p
              className="mb-4 font-medium"
              style={{ color: 'var(--color-text-hint)', fontSize: '1rem' }}
            >
              {Q_EMOJI[currentQ.id] ?? '•'}&ensp;{step + 1} / {total}
            </p>

            {/* Question label */}
            <h2
              className="text-2xl font-semibold leading-snug mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {currentQ.label}
            </h2>

            {currentQ.optional && (
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-hint)' }}>
                Optional
              </p>
            )}

            {/* Answer UI */}
            {currentQ.type === 'number' && (
              <NumberInput
                value={(currentAnswer as string) ?? ''}
                onChange={setAnswer}
              />
            )}

            {currentQ.type === 'scale_1_10' && (
              <ScaleSlider
                value={currentAnswer as number | undefined}
                inverted={currentQ.id === 'stress_level'}
                onChange={setAnswer}
                onRelease={advance}
              />
            )}

            {currentQ.type === 'options' && (
              <OptionsInput
                value={currentAnswer as number | undefined}
                onChange={setAnswer}
                onRelease={advance}
              />
            )}

            {currentQ.type === 'choice' && currentQ.choiceOptions && (
              <ChoiceInput
                options={currentQ.choiceOptions}
                value={currentAnswer as string | undefined}
                onPick={(v) => { setAnswer(v); setTimeout(advance, 300) }}
              />
            )}

            {currentQ.type === 'text' && (
              <TextInput
                value={(currentAnswer as string) ?? ''}
                onChange={setAnswer}
              />
            )}

            {currentQ.type === 'photo' && (
              <PhotoInput files={photoFiles} onFilesChange={setPhotoFiles} />
            )}

            {/* Error */}
            {error && (
              <div
                className="mt-4 px-4 py-3 text-sm"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex flex-col gap-3">
              {/* Scale / options: skip link only (auto-advance handles proceed) */}
              {isAutoAdvance && currentQ.optional && (
                <SkipLink onClick={skip} />
              )}
              {isAutoAdvance && step > 0 && (
                <NavButton onClick={back} label="Back" variant="ghost" />
              )}

              {/* Number / text / photo: explicit Next/Submit button */}
              {!isAutoAdvance && (
                <div className="flex gap-3">
                  {step > 0 && <NavButton onClick={back} label="Back" variant="ghost" flex />}
                  <NavButton
                    onClick={advance}
                    label={isSubmitting ? 'Submitting…' : isLast ? 'Submit' : 'Next'}
                    disabled={
                      isSubmitting ||
                      (!currentQ.optional && (currentQ.type === 'text' || currentQ.type === 'number') && !hasAnswer) ||
                      (!currentQ.optional && currentQ.type === 'photo' && photoFiles.length === 0)
                    }
                    flex={step > 0}
                  />
                </div>
              )}

              {/* Skip link for optional number / text / photo */}
              {!isAutoAdvance && currentQ.optional && (
                <SkipLink onClick={skip} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
