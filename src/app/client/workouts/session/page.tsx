'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getClientId,
  getTemplateDayWithExercises,
  getLastSessionForTemplateDay,
  getExerciseLibraryForClient,
  saveWorkoutSession,
  type TemplateExercise,
  type LastSession,
  type LibraryExercise,
} from '../actions'
import { useLanguage, type Translations } from '@/lib/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  notes: string | null
  previousSets: Array<{ weightKg: number; reps: number }>
  currentSets: SetRow[]
  overloadIndicator: 'up' | 'down' | 'same' | null
}

type RestTimer = {
  active: boolean
  secondsLeft: number
  totalSeconds: number
  exerciseId: string | null
}

type ModalState = { title: string; body: string; onConfirm: () => void }

// ─── Utils ────────────────────────────────────────────────────────────────────

function firstNum(s: string): string { return s.match(/\d+/)?.[0] ?? '' }
function fmt(s: number): string {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}
function parseF(v: string): number | null { const n = parseFloat(v); return v.trim() && !isNaN(n) ? n : null }
function parseI(v: string): number | null { const n = parseInt(v, 10); return v.trim() && !isNaN(n) ? n : null }

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#ef4444', back: '#3b82f6', shoulders: '#f59e0b', core: '#06b6d4', cardio: '#ec4899',
  biceps: '#ef4444', triceps: '#f97316',
  arms: '#f59e0b',      // fallback for un-migrated broad "arms" entries
  quads: '#14b8a6', hamstrings: '#10b981', glutes: '#ec4899', calves: '#84cc16',
  abductors: '#8b5cf6', adductors: '#d946ef',
  legs: '#7c3aed',      // fallback for any remaining broad "legs" entries
}

const MUSCLE_GROUP_ORDER = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'arms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors', 'legs',
  'core', 'cardio',
]

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({ modal, onClose, t }: { modal: ModalState; onClose: () => void; t: Translations }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div style={{
        backgroundColor: 'var(--color-surface-1)', borderRadius: 16, padding: 28,
        maxWidth: 320, width: 'calc(100% - 40px)', margin: 'auto',
        position: 'relative', top: '50%', transform: 'translateY(-50%)',
      }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
          {modal.title}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 24px', lineHeight: 1.5 }}>
          {modal.body}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, backgroundColor: 'var(--color-surface-3)', color: 'var(--color-text-secondary)',
              borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer',
            }}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => { modal.onConfirm(); onClose() }}
            style={{
              flex: 1, backgroundColor: '#ef4444', color: '#fff',
              borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
            }}
          >
            {t.common.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Exercise picker sheet (custom mode) ─────────────────────────────────────

function ExercisePicker({
  library,
  onSelect,
  onClose,
  t,
}: {
  library: LibraryExercise[]
  onSelect: (ex: LibraryExercise) => void
  onClose: () => void
  t: Translations
}) {
  const [search, setSearch] = useState('')

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? library.filter((e) => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q))
      : library

    const byGroup: Record<string, LibraryExercise[]> = {}
    for (const ex of filtered) {
      const g = ex.muscleGroup
      if (!byGroup[g]) byGroup[g] = []
      byGroup[g].push(ex)
    }

    const ordered: Array<[string, LibraryExercise[]]> = []
    for (const g of MUSCLE_GROUP_ORDER) {
      if (byGroup[g]) ordered.push([g, byGroup[g]])
    }
    for (const g of Object.keys(byGroup)) {
      if (!MUSCLE_GROUP_ORDER.includes(g)) ordered.push([g, byGroup[g]])
    }
    return ordered
  }, [library, search])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--color-surface-1)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px 40px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            {t.workouts.addExercise}
          </p>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-hint)', cursor: 'pointer', fontSize: 20, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`${t.common.search} ${t.workouts.exercises.toLowerCase()}…`}
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', marginBottom: 14, flexShrink: 0,
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 12, color: 'var(--color-text-primary)',
            fontSize: 14, outline: 'none', fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />

        {/* Exercise list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {grouped.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', fontSize: 14, padding: '24px 0' }}>
              {t.nutrition.noFoodsFound}
            </p>
          ) : (
            grouped.map(([group, exList]) => (
              <div key={group} style={{ marginBottom: 16 }}>
                <p style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: MUSCLE_COLORS[group] ?? 'var(--color-text-hint)',
                  margin: '0 0 6px', padding: '0 2px',
                }}>
                  {group}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {exList.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => { onSelect(ex); onClose() }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 14px',
                        backgroundColor: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                          {ex.name}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: 0 }}>
                          {ex.equipment}
                        </p>
                      </div>
                      <Plus size={16} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function SessionPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SessionInner />
    </Suspense>
  )
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--color-text-hint)', fontSize: 14 }}>…</div>
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function SessionInner() {
  const router  = useRouter()
  const { t } = useLanguage()
  const params  = useSearchParams()
  const isCustom      = params.get('custom') === 'true'
  const templateDayId = params.get('templateDayId') ?? ''
  const templateNameParam = params.get('templateName') ?? ''

  const [loading,       setLoading]   = useState(true)
  const [loadError,     setError]     = useState<string | null>(null)
  const [clientInfo,    setClient]    = useState<{ id: string; workspace_id: string } | null>(null)
  const [templateName,  setTName]     = useState(isCustom ? t.workouts.createCustom : templateNameParam)
  const [exercises,     setExercises] = useState<ExerciseState[]>([])
  const [sessionNotes,  setNotes]     = useState('')
  const [saving,        setSaving]    = useState(false)
  const [modal,         setModal]     = useState<ModalState | null>(null)
  const [quitHover,     setQuitHover] = useState(false)

  // Custom mode: exercise library + picker state
  const [exerciseLibrary,   setExerciseLibrary]   = useState<LibraryExercise[]>([])
  const [pickerOpen,        setPickerOpen]         = useState(false)

  const startRef = useRef<Date>(new Date())
  const [elapsed, setElapsed] = useState(0)

  const [rest, setRest] = useState<RestTimer>({ active: false, secondsLeft: 0, totalSeconds: 0, exerciseId: null })

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    // Reset to a clean loading state on every run so a stale error never
    // blocks a valid re-run (e.g. when useSearchParams resolves late).
    setLoading(true)
    setError(null)
    async function init() {
      try {
        // Get email from cookie (dev) or supabase auth
        let email: string | null = null
        const mc = document.cookie.split('; ').find((r) => r.startsWith('dev_mock_email='))?.split('=')[1]
        if (mc) email = decodeURIComponent(mc)
        else {
          const sb = createClient()
          const { data: { user } } = await sb.auth.getUser()
          email = user?.email ?? null
        }
        if (!email) { router.replace('/login'); return }

        const client = await getClientId(email)
        if (!client) { router.replace('/client'); return }
        if (cancelled) return

        setClient(client)

        if (isCustom) {
          // Custom mode: load exercise library, start with empty exercises
          setTName(t.workouts.createCustom)
          const library = await getExerciseLibraryForClient(client.workspace_id)
          if (!cancelled) {
            setExerciseLibrary(library)
            setExercises([])
            setLoading(false)
          }
          return
        }

        // Template mode
        if (!templateDayId) throw new Error('Missing templateDayId')
        const templatePromise = getTemplateDayWithExercises(templateDayId)
        const [template, last] = await Promise.all([
          templatePromise,
          getLastSessionForTemplateDay(client.id, templateDayId),
        ])
        if (cancelled) return

        setTName(template.name)
        setExercises(buildStates(template.exercises, last))
        setLoading(false)
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load'); setLoading(false) }
      }
    }
    init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustom, templateDayId])

  // ── Elapsed timer ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current.getTime()) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Rest timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rest.active) return
    const id = setInterval(() => {
      setRest((r) => {
        if (!r.active) return r
        if (r.secondsLeft <= 1) {
          try { navigator.vibrate?.([300, 100, 300]) } catch { /* ok */ }
          return { ...r, active: false, secondsLeft: 0 }
        }
        return { ...r, secondsLeft: r.secondsLeft - 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [rest.active])

  // ── Mutators ─────────────────────────────────────────────────────────────
  const updateSet = useCallback((exerciseId: string, setNumber: number, patch: Partial<SetRow>) => {
    setExercises((prev) => prev.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex
      return { ...ex, currentSets: ex.currentSets.map((s) => s.setNumber === setNumber ? { ...s, ...patch } : s) }
    }))
  }, [])

  const toggleSetDone = useCallback((exerciseId: string, setNumber: number) => {
    setExercises((prev) => prev.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex
      const wasDone = ex.currentSets.find((s) => s.setNumber === setNumber)?.done ?? false
      const newSets = ex.currentSets.map((s) => s.setNumber === setNumber ? { ...s, done: !s.done } : s)
      if (!wasDone) setRest({ active: true, secondsLeft: ex.restSeconds, totalSeconds: ex.restSeconds, exerciseId })
      return { ...ex, currentSets: newSets, overloadIndicator: computeOverload(newSets, ex.previousSets) }
    }))
  }, [])

  const addSet = useCallback((exerciseId: string) => {
    setExercises((prev) => prev.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex
      const last = ex.currentSets[ex.currentSets.length - 1]
      return {
        ...ex,
        currentSets: [...ex.currentSets, {
          setNumber: (last?.setNumber ?? 0) + 1,
          weightKg: last?.weightKg ?? '',
          reps: last?.reps ?? firstNum(ex.targetReps),
          done: false,
        }],
      }
    }))
  }, [])

  const deleteSet = useCallback((exerciseId: string, setNumber: number) => {
    setExercises((prev) => prev.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex
      const filtered = ex.currentSets.filter((s) => s.setNumber !== setNumber)
      const renumbered = filtered.map((s, i) => ({ ...s, setNumber: i + 1 }))
      return { ...ex, currentSets: renumbered }
    }))
  }, [])

  // ── Add exercise from library (custom mode) ───────────────────────────────
  const addExerciseFromLibrary = useCallback((ex: LibraryExercise) => {
    const newState: ExerciseState = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      muscleGroup: ex.muscleGroup,
      targetSets: 3,
      targetReps: '10',
      restSeconds: 90,
      notes: null,
      previousSets: [],
      currentSets: [
        { setNumber: 1, weightKg: '', reps: '', done: false },
        { setNumber: 2, weightKg: '', reps: '', done: false },
        { setNumber: 3, weightKg: '', reps: '', done: false },
      ],
      overloadIndicator: null,
    }
    setExercises((prev) => [...prev, newState])
  }, [])

  // ── Progress ─────────────────────────────────────────────────────────────
  const completedExercises = useMemo(() =>
    exercises.filter((ex) => ex.currentSets.length > 0 && ex.currentSets.every((s) => s.done)).length,
    [exercises]
  )

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSaveSession = async () => {
    if (!clientInfo) return
    setSaving(true)
    try {
      await saveWorkoutSession({
        clientId: clientInfo.id,
        workspaceId: clientInfo.workspace_id,
        templateDayId: isCustom ? null : (templateDayId || null),
        templateName,
        notes: sessionNotes,
        durationMinutes: Math.max(1, Math.round((Date.now() - startRef.current.getTime()) / 60000)),
        performedAt: new Date().toISOString(),
        exercises: exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.currentSets.filter((s) => s.reps.trim()).map((s) => ({
            setNumber: s.setNumber, weightKg: parseF(s.weightKg), reps: parseI(s.reps),
          })),
        })),
      })
      router.push('/client/workouts')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
  }

  // ── Finish click ──────────────────────────────────────────────────────────
  const handleFinishClick = () => {
    if (!clientInfo) return
    const totalSets = exercises.reduce((a, ex) => a + ex.currentSets.length, 0)
    const completedSets = exercises.reduce((a, ex) => a + ex.currentSets.filter((s) => s.done).length, 0)

    if (totalSets === 0) {
      setModal({
        title: t.workouts.noWorkoutsYet,
        body: t.workouts.noWorkoutsYet,
        onConfirm: () => { /* noop */ },
      })
      return
    }

    if (completedSets === totalSets) {
      handleSaveSession()
    } else {
      setModal({
        title: t.workouts.finishWorkout + '?',
        body: `${completedSets} / ${totalSets} ${t.workouts.sets}`,
        onConfirm: handleSaveSession,
      })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading)   return <Spinner />
  if (loadError) return <div style={{ padding: 24, color: '#ef4444', fontSize: 14, textAlign: 'center' }}>{loadError}</div>

  const progPct = exercises.length > 0 ? (completedExercises / exercises.length) * 100 : 0

  return (
    <div style={{ paddingBottom: 32, maxWidth: 480, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ padding: '48px 20px 20px' }}>
        {/* Button row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button
            type="button"
            onMouseEnter={() => setQuitHover(true)}
            onMouseLeave={() => setQuitHover(false)}
            onClick={() => setModal({
              title: t.workouts.discardConfirm,
              body: t.workouts.discardConfirmSub,
              onConfirm: () => router.push('/client/workouts'),
            })}
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: quitHover ? '#ef4444' : 'var(--color-surface-3)',
              border: 'none',
              color: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 700, lineHeight: 1,
              transition: 'background-color 0.15s',
            }}
            aria-label={t.workouts.discard}
          >
            ×
          </button>
          <button
            type="button"
            onClick={handleFinishClick}
            disabled={saving}
            style={{
              backgroundColor: saving ? 'var(--color-surface-3)' : 'var(--color-accent)',
              color: saving ? 'var(--color-text-muted)' : '#fff',
              borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600,
              border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? t.common.saving : t.workouts.finishWorkout}
          </button>
        </div>

        {/* Workout name */}
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 6px', lineHeight: 1.1 }}>
          {templateName}
        </h1>

        {/* Elapsed + exercise count */}
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', margin: '0 0 10px', fontVariantNumeric: 'tabular-nums' }}>
          {fmt(elapsed)} · {completedExercises} / {exercises.length} {t.workouts.exercises}
        </p>

        {/* Progress bar */}
        <div style={{ height: 3, backgroundColor: 'var(--color-surface-3)', borderRadius: 999 }}>
          <div style={{ height: '100%', width: `${progPct}%`, backgroundColor: 'var(--color-accent)', borderRadius: 999, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* ── Exercise cards ── */}
      <div style={{ padding: '0 16px' }}>
        {exercises.length === 0 && isCustom && (
          <div style={{
            padding: '32px 20px',
            textAlign: 'center',
            color: 'var(--color-text-hint)',
            fontSize: 14,
            border: '1px dashed var(--color-border)',
            borderRadius: 16,
            marginBottom: 12,
          }}>
            {t.workouts.addExercise}
          </div>
        )}

        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.exerciseId}
            exercise={ex}
            restTimer={rest}
            onUpdateSet={updateSet}
            onToggleDone={toggleSetDone}
            onAddSet={addSet}
            onDeleteSet={deleteSet}
            onSkipRest={() => setRest((r) => ({ ...r, active: false, secondsLeft: 0 }))}
            t={t}
          />
        ))}

        {/* Add Exercise button (custom mode) */}
        {isCustom && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={{
              width: '100%', padding: '13px 0', marginBottom: 12,
              backgroundColor: 'transparent',
              border: '1px dashed var(--color-accent)',
              borderRadius: 14,
              color: 'var(--color-accent)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Plus size={16} />
            {t.workouts.addExercise}
          </button>
        )}

        {/* Session notes */}
        <div style={{ marginTop: 4, marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-hint)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t.workouts.notes}
          </p>
          <textarea
            value={sessionNotes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.workouts.addNote}
            rows={3}
            style={{
              width: '100%', backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)', borderRadius: 12,
              color: 'var(--color-text-primary)', padding: '12px',
              fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* ── Confirm modal ── */}
      {modal && <ConfirmModal modal={modal} onClose={() => setModal(null)} t={t} />}

      {/* ── Exercise picker (custom mode) ── */}
      {pickerOpen && (
        <ExercisePicker
          library={exerciseLibrary}
          onSelect={addExerciseFromLibrary}
          onClose={() => setPickerOpen(false)}
          t={t}
        />
      )}
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise, restTimer, onUpdateSet, onToggleDone, onAddSet, onDeleteSet, onSkipRest, t,
}: {
  exercise: ExerciseState
  restTimer: RestTimer
  onUpdateSet: (id: string, num: number, patch: Partial<SetRow>) => void
  onToggleDone: (id: string, num: number) => void
  onAddSet: (id: string) => void
  onDeleteSet: (id: string, num: number) => void
  onSkipRest: () => void
  t: Translations
}) {
  const muscleColor = MUSCLE_COLORS[exercise.muscleGroup.toLowerCase()] ?? '#6b7280'
  const isResting   = restTimer.active && restTimer.exerciseId === exercise.exerciseId

  return (
    <div style={{
      backgroundColor: 'var(--color-surface-1)',
      border: '1px solid var(--color-border)',
      borderRadius: 20, marginBottom: 12, overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 16px 4px' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, flex: 1 }}>
            {exercise.exerciseName}
          </p>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px',
            borderRadius: 999, color: muscleColor,
            backgroundColor: `${muscleColor}18`,
            textTransform: 'capitalize', flexShrink: 0,
          }}>
            {exercise.muscleGroup}
          </span>
          <OverloadBadge indicator={exercise.overloadIndicator} />
        </div>

        {/* Notes under title */}
        {exercise.notes && (
          <div style={{ borderLeft: '2px solid var(--color-accent)', paddingLeft: 10, marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--color-text-hint)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
              {exercise.notes}
            </p>
          </div>
        )}

        {/* Target + last session */}
        <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '0 0 12px' }}>
          {exercise.targetSets} × {exercise.targetReps}
          {exercise.previousSets.length > 0 && (
            <span style={{ color: 'var(--color-text-hint)' }}>
              {' · '}{exercise.previousSets.map((s) => `${s.weightKg}${t.checkin.weightUnit}×${s.reps}`).join(' · ')}
            </span>
          )}
        </p>

        {/* Set rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {exercise.currentSets.map((s) => {
            const idx  = s.setNumber - 1
            const prev = exercise.previousSets[idx] ?? exercise.previousSets[exercise.previousSets.length - 1]
            const isPR = s.done && prev && parseFloat(s.weightKg) > prev.weightKg
            return (
              <SetRowItem
                key={s.setNumber}
                row={s}
                isPR={!!isPR}
                onChange={(patch) => onUpdateSet(exercise.exerciseId, s.setNumber, patch)}
                onToggleDone={() => onToggleDone(exercise.exerciseId, s.setNumber)}
                onDelete={() => onDeleteSet(exercise.exerciseId, s.setNumber)}
                t={t}
              />
            )
          })}
        </div>

        {/* Add set */}
        <button
          type="button"
          onClick={() => onAddSet(exercise.exerciseId)}
          style={{
            width: '100%', padding: '7px 0', marginBottom: 14,
            backgroundColor: 'transparent', border: '1px dashed var(--color-border)',
            borderRadius: 10, color: 'var(--color-text-muted)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          + {t.workouts.addSet}
        </button>
      </div>

      {/* Inline rest timer */}
      {isResting && (
        <div style={{
          borderTop: '1px solid var(--color-border)', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <RestRing pct={restTimer.secondsLeft / (restTimer.totalSeconds || 1)} />
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-hint)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.workouts.rest}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(restTimer.secondsLeft)}
            </p>
          </div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onSkipRest}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              backgroundColor: 'var(--color-surface-3)', color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)', cursor: 'pointer',
            }}
          >
            {t.common.skip}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Set row (inline inputs) ──────────────────────────────────────────────────

function SetRowItem({
  row, isPR, onChange, onToggleDone, onDelete, t,
}: {
  row: SetRow
  isPR: boolean
  onChange: (patch: Partial<SetRow>) => void
  onToggleDone: () => void
  onDelete: () => void
  t: Translations
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 4px',
      backgroundColor: row.done ? 'rgba(255,92,0,0.06)' : 'transparent',
      borderRadius: 10, transition: 'background-color 0.15s',
    }}>
      {/* Set number bubble */}
      <span style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--color-surface-2)',
        color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 600,
      }}>
        {row.setNumber}
      </span>

      {/* Weight */}
      <input
        type="number" inputMode="decimal"
        value={row.weightKg}
        onChange={(e) => onChange({ weightKg: e.target.value })}
        placeholder="0"
        style={{
          width: 76, textAlign: 'center',
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 10, color: 'var(--color-text-primary)',
          padding: '8px 0', fontSize: 14, fontWeight: 600, outline: 'none',
        }}
      />
      <span style={{ fontSize: 11, color: 'var(--color-text-hint)', flexShrink: 0 }}>{t.checkin.weightUnit}</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-hint)', flexShrink: 0 }}>×</span>

      {/* Reps */}
      <input
        type="number" inputMode="numeric"
        value={row.reps}
        onChange={(e) => onChange({ reps: e.target.value })}
        placeholder="0"
        style={{
          width: 66, textAlign: 'center',
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 10, color: 'var(--color-text-primary)',
          padding: '8px 0', fontSize: 14, fontWeight: 600, outline: 'none',
        }}
      />

      <div style={{ flex: 1 }} />

      {/* PR badge */}
      {isPR && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.15)',
          borderRadius: 999, padding: '2px 6px', flexShrink: 0,
        }}>
          PR
        </span>
      )}

      {/* Done checkmark */}
      <button
        type="button"
        onClick={onToggleDone}
        aria-label={row.done ? t.workouts.completed : t.common.done}
        style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: row.done ? 'var(--color-accent)' : 'transparent',
          color: row.done ? '#fff' : 'var(--color-text-hint)',
          border: row.done ? 'none' : '1.5px solid var(--color-border)',
          cursor: 'pointer',
        }}
      >
        <Check size={16} strokeWidth={3} />
      </button>

      {/* Delete set */}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete set"
        style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'transparent',
          color: 'var(--color-text-hint)',
          border: 'none', cursor: 'pointer',
          opacity: 0.5,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-hint)'; (e.currentTarget as HTMLButtonElement).style.opacity = '0.5' }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ─── Overload badge ───────────────────────────────────────────────────────────

function OverloadBadge({ indicator }: { indicator: ExerciseState['overloadIndicator'] }) {
  if (!indicator) return null
  if (indicator === 'up')   return <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>↑ PR pace</span>
  if (indicator === 'same') return <span style={{ fontSize: 14, color: 'var(--color-text-hint)', fontWeight: 700, flexShrink: 0 }}>=</span>
  return <span style={{ fontSize: 14, color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>↓</span>
}

// ─── Rest ring ────────────────────────────────────────────────────────────────

function RestRing({ pct }: { pct: number }) {
  const R = 16, SW = 3, C = 20, circ = 2 * Math.PI * R
  return (
    <svg width={C * 2} height={C * 2} viewBox={`0 0 ${C * 2} ${C * 2}`} style={{ flexShrink: 0 }}>
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--color-surface-3)" strokeWidth={SW} />
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--color-accent)" strokeWidth={SW}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${C} ${C})`}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  )
}

// ─── State builders ───────────────────────────────────────────────────────────

function buildStates(exercises: TemplateExercise[], last: LastSession | null): ExerciseState[] {
  const prevMap = new Map<string, Array<{ weightKg: number; reps: number }>>()
  if (last) {
    for (const s of last.sets) {
      if (s.weightKg === null || s.reps === null) continue
      const list = prevMap.get(s.exerciseId) ?? []
      list.push({ weightKg: s.weightKg, reps: s.reps })
      prevMap.set(s.exerciseId, list)
    }
  }

  return exercises.map((ex) => {
    const prev = prevMap.get(ex.exerciseId) ?? []
    const sets: SetRow[] = Array.from({ length: ex.targetSets }, (_, i) => {
      const p = prev[i]
      return { setNumber: i + 1, weightKg: p ? String(p.weightKg) : '', reps: p ? String(p.reps) : firstNum(ex.targetReps), done: false }
    })
    return {
      exerciseId: ex.exerciseId, exerciseName: ex.exerciseName,
      muscleGroup: ex.muscleGroup, targetSets: ex.targetSets,
      targetReps: ex.targetReps, restSeconds: ex.restSeconds,
      notes: ex.notes, previousSets: prev, currentSets: sets,
      overloadIndicator: null,
    }
  })
}

function computeOverload(
  current: SetRow[],
  previous: Array<{ weightKg: number; reps: number }>
): ExerciseState['overloadIndicator'] {
  if (!previous.length) return null
  const weights = current.filter((s) => s.done).map((s) => parseFloat(s.weightKg)).filter((n) => !isNaN(n) && n > 0)
  if (!weights.length) return null
  const avg = weights.reduce((a, b) => a + b, 0) / weights.length
  const prevAvg = previous.reduce((a, b) => a + b.weightKg, 0) / previous.length
  if (avg > prevAvg + 0.1) return 'up'
  if (avg < prevAvg - 0.1) return 'down'
  return 'same'
}
