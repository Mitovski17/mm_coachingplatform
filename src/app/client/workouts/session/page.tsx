'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getClientId,
  getTemplateWithExercises,
  getLastSessionForTemplate,
  saveWorkoutSession,
  type TemplateExercise,
  type LastSession,
} from '../actions'

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#ef4444',
  back: '#3b82f6',
  legs: '#22c55e',
  shoulders: '#f59e0b',
  arms: '#a855f7',
  core: '#06b6d4',
  cardio: '#ec4899',
}

type SetRow = {
  setNumber: number
  weightKg: string
  reps: string
  done: boolean
}

type ExerciseState = {
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  targetSets: number
  targetReps: string
  restSeconds: number
  previousSets: Array<{ weightKg: number; reps: number }>
  currentSets: SetRow[]
  overloadIndicator: 'up' | 'down' | 'same' | null
}

type RestTimerState = { active: boolean; secondsLeft: number; totalSeconds: number }

function firstNumberOf(reps: string): string {
  const m = reps.match(/\d+/)
  return m ? m[0] : ''
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function SessionPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SessionInner />
    </Suspense>
  )
}

function LoadingScreen() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: '60vh', color: 'var(--color-text-muted)', fontSize: 14 }}
    >
      Loading session…
    </div>
  )
}

function SessionInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get('templateId') ?? ''
  const templateNameParam = searchParams.get('templateName') ?? ''

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [clientInfo, setClientInfo] = useState<{ id: string; workspace_id: string } | null>(null)
  const [templateName, setTemplateName] = useState(templateNameParam)
  const [exercises, setExercises] = useState<ExerciseState[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [restTimer, setRestTimer] = useState<RestTimerState>({
    active: false,
    secondsLeft: 0,
    totalSeconds: 0,
  })
  const startedAtRef = useRef<Date>(new Date())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        if (!templateId) throw new Error('Missing templateId')

        // Resolve client by email
        let email: string | null = null
        const mockCookie = document.cookie
          .split('; ')
          .find((row) => row.startsWith('dev_mock_email='))
          ?.split('=')[1]
        if (mockCookie) {
          email = decodeURIComponent(mockCookie)
        } else {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          email = user?.email ?? null
        }
        if (!email) {
          router.replace('/login')
          return
        }

        const [client, template] = await Promise.all([
          getClientId(email),
          getTemplateWithExercises(templateId),
        ])

        if (!client) {
          router.replace('/login')
          return
        }

        const last = await getLastSessionForTemplate(client.id, templateId)

        if (cancelled) return

        setClientInfo(client)
        setTemplateName(template.name)
        setExercises(buildInitialExerciseStates(template.exercises, last))
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load workout')
          setLoading(false)
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  // ── Elapsed timer ─────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const diff = Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000)
      setElapsedSeconds(diff)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Rest timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restTimer.active) return
    const id = setInterval(() => {
      setRestTimer((t) => {
        if (!t.active) return t
        if (t.secondsLeft <= 1) {
          try {
            navigator.vibrate?.([300, 100, 300])
          } catch {
            // ignore
          }
          return { ...t, active: false, secondsLeft: 0 }
        }
        return { ...t, secondsLeft: t.secondsLeft - 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [restTimer.active])

  // ── Mutators ──────────────────────────────────────────────────────────
  const updateSet = useCallback(
    (exerciseId: string, setNumber: number, patch: Partial<SetRow>) => {
      setExercises((prev) =>
        prev.map((ex) => {
          if (ex.exerciseId !== exerciseId) return ex
          return {
            ...ex,
            currentSets: ex.currentSets.map((s) =>
              s.setNumber === setNumber ? { ...s, ...patch } : s
            ),
          }
        })
      )
    },
    []
  )

  const toggleSetDone = useCallback(
    (exerciseId: string, setNumber: number) => {
      setExercises((prev) => {
        return prev.map((ex) => {
          if (ex.exerciseId !== exerciseId) return ex
          const newSets = ex.currentSets.map((s) =>
            s.setNumber === setNumber ? { ...s, done: !s.done } : s
          )
          const wasDone = ex.currentSets.find((s) => s.setNumber === setNumber)?.done ?? false
          const nowDone = !wasDone
          const indicator = computeOverload(newSets, ex.previousSets)

          // Trigger rest timer only when transitioning to done
          if (nowDone) {
            setRestTimer({
              active: true,
              secondsLeft: ex.restSeconds,
              totalSeconds: ex.restSeconds,
            })
          }

          return { ...ex, currentSets: newSets, overloadIndicator: indicator }
        })
      })
    },
    []
  )

  const addSet = useCallback((exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex
        const last = ex.currentSets[ex.currentSets.length - 1]
        const nextNumber = (last?.setNumber ?? 0) + 1
        return {
          ...ex,
          currentSets: [
            ...ex.currentSets,
            {
              setNumber: nextNumber,
              weightKg: last?.weightKg ?? '',
              reps: last?.reps ?? firstNumberOf(ex.targetReps),
              done: false,
            },
          ],
        }
      })
    )
  }, [])

  // ── Quit ──────────────────────────────────────────────────────────────
  const handleQuit = () => {
    if (confirm('Quit workout? Your progress will be lost.')) {
      router.push('/client/workouts')
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────
  const totalLoggedSets = useMemo(
    () =>
      exercises.reduce(
        (acc, ex) => acc + ex.currentSets.filter((s) => s.reps.trim() !== '').length,
        0
      ),
    [exercises]
  )

  const exercisesWithSets = useMemo(
    () => exercises.filter((ex) => ex.currentSets.some((s) => s.reps.trim() !== '')).length,
    [exercises]
  )

  const handleFinish = async () => {
    if (!clientInfo) return
    if (
      !confirm(
        `Finish workout? ${totalLoggedSets} set${totalLoggedSets === 1 ? '' : 's'} logged across ${exercisesWithSets} exercise${exercisesWithSets === 1 ? '' : 's'}`
      )
    ) {
      return
    }

    setSaving(true)
    try {
      const durationMinutes = Math.max(1, Math.round((Date.now() - startedAtRef.current.getTime()) / 60000))
      const performedAt = new Date().toISOString()
      await saveWorkoutSession({
        clientId: clientInfo.id,
        workspaceId: clientInfo.workspace_id,
        templateId,
        templateName,
        notes,
        durationMinutes,
        performedAt,
        exercises: exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.currentSets
            .filter((s) => s.reps.trim() !== '')
            .map((s) => ({
              setNumber: s.setNumber,
              weightKg: parseFloatOrNull(s.weightKg),
              reps: parseIntOrNull(s.reps),
            })),
        })),
      })
      router.push('/client/workouts')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save workout')
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen />
  if (loadError) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: '60vh', padding: 24, color: '#ef4444', fontSize: 14, textAlign: 'center' }}
      >
        {loadError}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div
        className="flex items-center"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          backgroundColor: 'var(--color-surface-1)',
          borderBottom: '1px solid var(--color-border)',
          padding: '14px 16px',
          maxWidth: '480px',
          margin: '0 auto',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={handleQuit}
          aria-label="Quit workout"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
        >
          <X size={20} />
        </button>
        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: 0,
            flex: 1,
            textAlign: 'center',
          }}
        >
          {templateName}
        </p>
        <div className="flex items-center" style={{ gap: 8, flexShrink: 0 }}>
          <p
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              margin: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatElapsed(elapsedSeconds)}
          </p>
          <button
            type="button"
            onClick={handleFinish}
            disabled={saving}
            style={{
              backgroundColor: '#ffffff',
              color: '#000000',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Finish'}
          </button>
        </div>
      </div>

      <div className="mx-auto" style={{ maxWidth: '480px', paddingTop: 72 }}>
        <div style={{ padding: '0 16px' }}>
          {exercises.map((ex) => (
            <ExerciseCard
              key={ex.exerciseId}
              exercise={ex}
              onUpdateSet={updateSet}
              onToggleDone={toggleSetDone}
              onAddSet={addSet}
            />
          ))}

          {/* Notes */}
          <div style={{ margin: '8px 0 16px' }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                margin: '0 0 8px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Session Notes
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel? Any PRs, issues, or things to flag for your coach..."
              rows={3}
              style={{
                width: '100%',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                color: 'var(--color-text-primary)',
                padding: '12px',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
              }}
            />
          </div>
        </div>
      </div>

      {/* Rest timer overlay */}
      {restTimer.active && (
        <RestTimerOverlay
          state={restTimer}
          onSkip={() => setRestTimer((t) => ({ ...t, active: false, secondsLeft: 0 }))}
        />
      )}
    </div>
  )
}

function ExerciseCard({
  exercise,
  onUpdateSet,
  onToggleDone,
  onAddSet,
}: {
  exercise: ExerciseState
  onUpdateSet: (exerciseId: string, setNumber: number, patch: Partial<SetRow>) => void
  onToggleDone: (exerciseId: string, setNumber: number) => void
  onAddSet: (exerciseId: string) => void
}) {
  const muscleColor = MUSCLE_COLORS[exercise.muscleGroup] ?? '#6b7280'

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: '20px',
        padding: '16px',
        marginBottom: '12px',
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
        <p
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0,
            flex: 1,
            minWidth: 0,
          }}
        >
          {exercise.exerciseName}
        </p>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '999px',
            backgroundColor: 'var(--color-surface-2)',
            color: muscleColor,
            textTransform: 'capitalize',
            flexShrink: 0,
          }}
        >
          {exercise.muscleGroup}
        </span>
        <OverloadBadge indicator={exercise.overloadIndicator} />
      </div>

      {exercise.previousSets.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: '4px 0 2px' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Last session: </span>
          {exercise.previousSets
            .map((s) => `${s.weightKg}kg×${s.reps}`)
            .join(' · ')}
        </p>
      )}
      <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: '0 0 12px' }}>
        Target: {exercise.targetSets} × {exercise.targetReps}
      </p>

      <div className="flex flex-col gap-2">
        {exercise.currentSets.map((s) => (
          <SetRowItem
            key={s.setNumber}
            row={s}
            onChange={(patch) => onUpdateSet(exercise.exerciseId, s.setNumber, patch)}
            onToggleDone={() => onToggleDone(exercise.exerciseId, s.setNumber)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onAddSet(exercise.exerciseId)}
        style={{
          marginTop: 10,
          padding: '6px 0',
          width: '100%',
          backgroundColor: 'transparent',
          border: '1px dashed var(--color-border)',
          borderRadius: '10px',
          color: 'var(--color-text-muted)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        + Add Set
      </button>
    </div>
  )
}

function OverloadBadge({ indicator }: { indicator: ExerciseState['overloadIndicator'] }) {
  if (!indicator) return null
  if (indicator === 'up') {
    return (
      <span
        className="flex items-center gap-1"
        style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, flexShrink: 0 }}
      >
        ↑<span style={{ fontSize: 9, fontWeight: 600 }}>PR pace</span>
      </span>
    )
  }
  if (indicator === 'same') {
    return <span style={{ fontSize: 14, color: 'var(--color-text-hint)', fontWeight: 700, flexShrink: 0 }}>=</span>
  }
  return <span style={{ fontSize: 14, color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>↓</span>
}

function SetRowItem({
  row,
  onChange,
  onToggleDone,
}: {
  row: SetRow
  onChange: (patch: Partial<SetRow>) => void
  onToggleDone: () => void
}) {
  return (
    <div
      className="flex items-center gap-2"
      style={{
        padding: '6px 4px',
        backgroundColor: row.done ? 'var(--color-surface-2)' : 'transparent',
        borderRadius: 10,
        transition: 'background-color 0.15s',
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: 'var(--color-surface-2)',
          color: 'var(--color-text-muted)',
          fontSize: 11,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {row.setNumber}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={row.weightKg}
        onChange={(e) => onChange({ weightKg: e.target.value })}
        placeholder="0"
        style={{
          width: 80,
          textAlign: 'center',
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          color: 'var(--color-text-primary)',
          padding: '8px 0',
          fontSize: 14,
          fontWeight: 600,
          outline: 'none',
        }}
      />
      <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>kg</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '0 2px' }}>×</span>
      <input
        type="number"
        inputMode="numeric"
        value={row.reps}
        onChange={(e) => onChange({ reps: e.target.value })}
        placeholder="0"
        style={{
          width: 70,
          textAlign: 'center',
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          color: 'var(--color-text-primary)',
          padding: '8px 0',
          fontSize: 14,
          fontWeight: 600,
          outline: 'none',
        }}
      />
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onToggleDone}
        aria-label={row.done ? 'Mark set undone' : 'Mark set done'}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: row.done ? '#22c55e' : 'transparent',
          color: row.done ? '#fff' : 'var(--color-text-hint)',
          border: row.done ? 'none' : '1.5px solid var(--color-border)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Check size={16} strokeWidth={3} />
      </button>
    </div>
  )
}

function RestTimerOverlay({
  state,
  onSkip,
}: {
  state: RestTimerState
  onSkip: () => void
}) {
  const pct = state.totalSeconds > 0 ? (state.secondsLeft / state.totalSeconds) * 100 : 0
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 64,
        left: 0,
        right: 0,
        height: 56,
        zIndex: 50,
        backgroundColor: 'var(--color-surface-2)',
        borderTop: '1px solid var(--color-border)',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Progress line at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 2,
          width: `${pct}%`,
          backgroundColor: '#f97316',
          transition: 'width 1s linear',
        }}
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        REST
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#ffffff',
          fontVariantNumeric: 'tabular-nums',
          marginLeft: 8,
        }}
      >
        {formatElapsed(state.secondsLeft)}
      </span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onSkip}
        style={{
          backgroundColor: 'var(--color-surface-2)',
          color: '#ffffff',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '4px 12px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Skip
      </button>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildInitialExerciseStates(
  exercises: TemplateExercise[],
  last: LastSession | null
): ExerciseState[] {
  // Group last session sets by exercise
  const previousByExercise = new Map<string, Array<{ weightKg: number; reps: number }>>()
  if (last) {
    for (const s of last.sets) {
      if (s.weightKg === null || s.reps === null) continue
      const list = previousByExercise.get(s.exerciseId) ?? []
      list.push({ weightKg: s.weightKg, reps: s.reps })
      previousByExercise.set(s.exerciseId, list)
    }
  }

  return exercises.map((ex) => {
    const prev = previousByExercise.get(ex.exerciseId) ?? []
    const targetRepsFirst = firstNumberOf(ex.targetReps)
    const sets: SetRow[] = []
    for (let i = 0; i < ex.targetSets; i++) {
      const p = prev[i]
      sets.push({
        setNumber: i + 1,
        weightKg: p ? String(p.weightKg) : '',
        reps: p ? String(p.reps) : targetRepsFirst,
        done: false,
      })
    }
    return {
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      muscleGroup: ex.muscleGroup,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      restSeconds: ex.restSeconds,
      previousSets: prev,
      currentSets: sets,
      overloadIndicator: null,
    }
  })
}

function computeOverload(
  current: SetRow[],
  previous: Array<{ weightKg: number; reps: number }>
): ExerciseState['overloadIndicator'] {
  if (previous.length === 0) return null
  const doneWeights = current
    .filter((s) => s.done)
    .map((s) => parseFloat(s.weightKg))
    .filter((n) => !Number.isNaN(n) && n > 0)
  if (doneWeights.length === 0) return null
  const avgCurrent = doneWeights.reduce((a, b) => a + b, 0) / doneWeights.length
  const avgPrevious =
    previous.reduce((a, b) => a + b.weightKg, 0) / previous.length
  if (avgCurrent > avgPrevious + 0.1) return 'up'
  if (avgCurrent < avgPrevious - 0.1) return 'down'
  return 'same'
}

function parseFloatOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = parseFloat(v)
  return Number.isNaN(n) ? null : n
}

function parseIntOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? null : n
}
