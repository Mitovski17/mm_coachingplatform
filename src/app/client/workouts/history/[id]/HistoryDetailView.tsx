'use client'

import { type CSSProperties, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import type { SessionDetail, LibraryExercise } from '../../actions'
import { updateWorkoutSession, getExerciseLibraryForClient } from '../../actions'

// ─── Constants ────────────────────────────────────────────────────────────────

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#ef4444', back: '#3b82f6', shoulders: '#f59e0b', core: '#06b6d4', cardio: '#ec4899',
  biceps: '#0ea5e9', triceps: '#f97316', arms: '#f59e0b',
  quads: '#14b8a6', hamstrings: '#10b981', glutes: '#f43f5e', calves: '#84cc16',
  abductors: '#8b5cf6', adductors: '#d946ef', legs: '#7c3aed',
}

const MUSCLE_GROUP_ORDER = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'arms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors', 'legs',
  'core', 'cardio',
]

// ─── Types ────────────────────────────────────────────────────────────────────

type EditSet = { setNumber: number; weightKg: string; reps: string }
type EditExercise = {
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  sets: EditSet[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

void format // silence unused import

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function parseF(v: string): number | null { const n = parseFloat(v); return v.trim() && !isNaN(n) ? n : null }
function parseI(v: string): number | null { const n = parseInt(v, 10); return v.trim() && !isNaN(n) ? n : null }

// ─── Shared input style (no spinners) ────────────────────────────────────────

const cellInput: CSSProperties = {
  width: '100%', textAlign: 'center',
  backgroundColor: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 8, color: 'var(--color-text-primary)',
  padding: '7px 4px', fontSize: 14, fontWeight: 600,
  outline: 'none', fontFamily: 'inherit',
}

const durInput: CSSProperties = {
  width: 68, textAlign: 'center',
  backgroundColor: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 10, color: 'var(--color-text-primary)',
  padding: '8px 0', fontSize: 18, fontWeight: 700,
  outline: 'none', fontFamily: 'inherit',
}

// ─── Exercise picker ──────────────────────────────────────────────────────────

function ExercisePicker({
  library, onSelect, onClose,
}: {
  library: LibraryExercise[]
  onSelect: (ex: LibraryExercise) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const { t } = useLanguage()

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
    for (const g of MUSCLE_GROUP_ORDER) if (byGroup[g]) ordered.push([g, byGroup[g]])
    for (const g of Object.keys(byGroup)) if (!MUSCLE_GROUP_ORDER.includes(g)) ordered.push([g, byGroup[g]])
    return ordered
  }, [library, search])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface-1)', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{t.workouts.addExercise}</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-hint)', cursor: 'pointer', fontSize: 22, padding: 4 }}>×</button>
        </div>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={`${t.common.search}…`} autoFocus
          style={{ width: '100%', padding: '10px 14px', marginBottom: 14, flexShrink: 0, backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 12, color: 'var(--color-text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {grouped.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', fontSize: 14, padding: '24px 0' }}>No exercises found</p>
          ) : grouped.map(([group, exList]) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUSCLE_COLORS[group] ?? 'var(--color-text-hint)', margin: '0 0 6px' }}>{group}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {exList.map((ex) => (
                  <button key={ex.id} type="button" onClick={() => { onSelect(ex); onClose() }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{ex.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: 0 }}>{ex.equipment}</p>
                    </div>
                    <Plus size={16} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Editable exercise card ───────────────────────────────────────────────────

function EditExerciseCard({
  exercise, onChange, onRemove, canMoveUp, canMoveDown, onMoveUp, onMoveDown,
}: {
  exercise: EditExercise
  onChange: (ex: EditExercise) => void
  onRemove: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { t } = useLanguage()
  const muscleColor = MUSCLE_COLORS[exercise.muscleGroup] ?? '#6b7280'

  function updateSet(setNumber: number, patch: Partial<EditSet>) {
    onChange({ ...exercise, sets: exercise.sets.map((s) => s.setNumber === setNumber ? { ...s, ...patch } : s) })
  }

  function addSet() {
    const last = exercise.sets[exercise.sets.length - 1]
    onChange({
      ...exercise,
      sets: [...exercise.sets, { setNumber: (last?.setNumber ?? 0) + 1, weightKg: last?.weightKg ?? '', reps: last?.reps ?? '' }],
    })
  }

  function removeSet(setNumber: number) {
    const renumbered = exercise.sets.filter((s) => s.setNumber !== setNumber).map((s, i) => ({ ...s, setNumber: i + 1 }))
    onChange({ ...exercise, sets: renumbered })
  }

  return (
    <div style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 16, marginBottom: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <p style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{exercise.exerciseName}</p>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, backgroundColor: `${muscleColor}18`, color: muscleColor, textTransform: 'capitalize', flexShrink: 0 }}>
          {exercise.muscleGroup}
        </span>
        {/* Move up / down */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp} aria-label="Move up"
            style={{ background: 'none', border: 'none', padding: '1px 3px', cursor: canMoveUp ? 'pointer' : 'default', color: canMoveUp ? 'var(--color-text-muted)' : 'var(--color-surface-3)', lineHeight: 1 }}>
            <ChevronUp size={14} />
          </button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown} aria-label="Move down"
            style={{ background: 'none', border: 'none', padding: '1px 3px', cursor: canMoveDown ? 'pointer' : 'default', color: canMoveDown ? 'var(--color-text-muted)' : 'var(--color-surface-3)', lineHeight: 1 }}>
            <ChevronDown size={14} />
          </button>
        </div>
        <button type="button" onClick={onRemove} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', backgroundColor: 'transparent', color: 'var(--color-text-hint)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <X size={15} />
        </button>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 32px', fontSize: 10, fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <span>{t.workouts.set}</span>
        <span>{t.workouts.weight}</span>
        <span>{t.workouts.reps}</span>
        <span />
      </div>

      {/* Set rows */}
      {exercise.sets.map((s) => (
        <div key={s.setNumber} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 32px', alignItems: 'center', padding: '6px 14px', gap: 6, borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>{s.setNumber}</span>
          <input
            type="text" inputMode="decimal" value={s.weightKg}
            onChange={(e) => updateSet(s.setNumber, { weightKg: e.target.value })}
            placeholder="0"
            style={cellInput}
          />
          <input
            type="text" inputMode="numeric" value={s.reps}
            onChange={(e) => updateSet(s.setNumber, { reps: e.target.value })}
            placeholder="0"
            style={cellInput}
          />
          <button type="button" onClick={() => removeSet(s.setNumber)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', backgroundColor: 'transparent', color: 'var(--color-text-hint)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {/* Add set */}
      <button type="button" onClick={addSet} style={{ width: '100%', padding: '10px 0', backgroundColor: 'transparent', border: 'none', borderTop: exercise.sets.length > 0 ? 'none' : undefined, color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
        + {t.workouts.addSet}
      </button>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function HistoryDetailView({ session: initial }: { session: SessionDetail }) {
  const { t, lang } = useLanguage()
  const dateLocale = lang === 'bg' ? 'bg-BG' : 'en-US'

  const [session, setSession] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit field state
  const [editName,   setEditName]   = useState(initial.name)
  const [editHours,  setEditHours]  = useState('')
  const [editMins,   setEditMins]   = useState('')
  const [editNotes,  setEditNotes]  = useState(initial.notes ?? '')
  const [editExercises, setEditExercises] = useState<EditExercise[]>([])

  // Exercise library for the picker
  const [library,    setLibrary]    = useState<LibraryExercise[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const d = new Date(session.performedAt)
  const date = `${d.toLocaleDateString(dateLocale, { weekday: 'long' })}, ${d.toLocaleDateString(dateLocale, { month: 'long', day: 'numeric', year: 'numeric' })}`

  let totalSets = 0
  let totalVolume = 0
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      totalSets += 1
      totalVolume += (s.weightKg ?? 0) * (s.reps ?? 0)
    }
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────

  function startEdit() {
    const totalMins = session.durationMinutes ?? 0
    setEditName(session.name)
    setEditHours(totalMins >= 60 ? String(Math.floor(totalMins / 60)) : '')
    setEditMins(totalMins > 0 ? String(totalMins % 60) : '')
    setEditNotes(session.notes ?? '')
    setEditExercises(session.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      muscleGroup: ex.muscleGroup,
      sets: ex.sets.map((s) => ({
        setNumber: s.setNumber,
        weightKg: s.weightKg !== null ? String(s.weightKg) : '',
        reps: s.reps !== null ? String(s.reps) : '',
      })),
    })))
    if (library.length === 0 && session.workspaceId) {
      getExerciseLibraryForClient(session.workspaceId).then(setLibrary).catch(() => {})
    }
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const h = parseInt(editHours, 10) || 0
      const m = parseInt(editMins,  10) || 0
      const totalMins = h * 60 + m
      const durationMinutes = totalMins > 0 ? totalMins : null

      await updateWorkoutSession(session.id, {
        name: editName.trim() || session.name,
        notes: editNotes.trim() || null,
        durationMinutes,
        exercises: editExercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets
            .filter((s) => s.reps.trim())
            .map((s) => ({ setNumber: s.setNumber, weightKg: parseF(s.weightKg), reps: parseI(s.reps) })),
        })),
      })

      // Update local display
      setSession((prev) => ({
        ...prev,
        name: editName.trim() || prev.name,
        notes: editNotes.trim() || null,
        durationMinutes,
        exercises: editExercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          sets: ex.sets
            .filter((s) => s.reps.trim())
            .map((s) => ({ setNumber: s.setNumber, weightKg: parseF(s.weightKg), reps: parseI(s.reps) })),
        })),
      }))
      setEditing(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function moveExercise(index: number, dir: 'up' | 'down') {
    setEditExercises((prev) => {
      const arr = [...prev]
      const target = dir === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= arr.length) return prev
      ;[arr[index], arr[target]] = [arr[target], arr[index]]
      return arr
    })
  }

  function addExercise(ex: LibraryExercise) {
    setEditExercises((prev) => [...prev, {
      exerciseId: ex.id,
      exerciseName: ex.name,
      muscleGroup: ex.muscleGroup,
      sets: [{ setNumber: 1, weightKg: '', reps: '' }],
    }])
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 24px' }}>

      {/* ── Header ── */}
      <div style={{ padding: '52px 16px 8px' }}>
        <Link href="/client/workouts" className="inline-flex items-center gap-1" style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 14 }}>
          <ArrowLeft size={14} />
          {t.common.back}
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            {editing ? (
              <input
                type="text" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '4px 10px', margin: '0 0 4px', width: '100%', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            ) : (
              <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>{session.name}</h1>
            )}
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>{date}</p>
          </div>

          {/* Edit / Save / Cancel */}
          {!editing ? (
            <button type="button" onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>
              {t.common.edit}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 2 }}>
              <button type="button" onClick={() => setEditing(false)} disabled={saving} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={15} />
              </button>
              <button type="button" onClick={saveEdit} disabled={saving} style={{ width: 34, height: 34, borderRadius: 8, border: 'none', backgroundColor: 'var(--color-accent)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={15} strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats card ── */}
      <div style={{ padding: '0 16px', marginTop: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 14 }}>
          {editing ? (
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-hint)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.workouts.duration}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="text" inputMode="numeric" value={editHours} onChange={(e) => setEditHours(e.target.value.replace(/\D/g, ''))} placeholder="0" style={{ ...durInput, width: 48 }} />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>h</span>
                <input type="text" inputMode="numeric" value={editMins} onChange={(e) => setEditMins(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="00" style={{ ...durInput, width: 48 }} />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>m</span>
              </div>
            </div>
          ) : (
            <Stat label={t.workouts.duration} value={formatDuration(session.durationMinutes)} />
          )}
          <Stat label={t.workouts.set} value={String(totalSets)} />
          <Stat label={t.workouts.totalVolume} value={totalVolume > 0 ? `${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t.checkin.weightUnit}` : t.common.noData} />
        </div>
      </div>

      {/* ── Notes ── */}
      {(editing || session.notes) && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.workouts.notes}</p>
            {editing ? (
              <textarea
                value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                placeholder={t.workouts.addNote} rows={3}
                style={{ width: '100%', backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text-primary)', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5, boxSizing: 'border-box' }}
              />
            ) : (
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>{session.notes}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Exercises ── */}
      <div style={{ padding: '12px 16px 0' }}>
        {editing ? (
          <>
            {editExercises.map((ex, i) => (
              <EditExerciseCard
                key={`${ex.exerciseId}-${i}`}
                exercise={ex}
                onChange={(updated) => setEditExercises((prev) => prev.map((e, idx) => idx === i ? updated : e))}
                onRemove={() => setEditExercises((prev) => prev.filter((_, idx) => idx !== i))}
                canMoveUp={i > 0}
                canMoveDown={i < editExercises.length - 1}
                onMoveUp={() => moveExercise(i, 'up')}
                onMoveDown={() => moveExercise(i, 'down')}
              />
            ))}

            {/* Add exercise */}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              style={{ width: '100%', padding: '13px 0', marginBottom: 12, backgroundColor: 'transparent', border: '1px dashed var(--color-accent)', borderRadius: 14, color: 'var(--color-accent)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Plus size={16} />
              {t.workouts.addExercise}
            </button>
          </>
        ) : (
          session.exercises.map((ex) => {
            const muscleColor = MUSCLE_COLORS[ex.muscleGroup] ?? '#6b7280'
            return (
              <div key={ex.exerciseId} style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 16, marginBottom: 12, overflow: 'hidden' }}>
                <div className="flex items-center gap-2" style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, flex: 1 }}>{ex.exerciseName}</p>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, backgroundColor: 'var(--color-surface-2)', color: muscleColor, textTransform: 'capitalize' }}>{ex.muscleGroup}</span>
                </div>
                <div>
                  <div className="grid" style={{ gridTemplateColumns: '60px 1fr 1fr', fontSize: 11, fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 16px', borderBottom: '1px solid var(--color-border)' }}>
                    <span>{t.workouts.set}</span>
                    <span>{t.workouts.weight}</span>
                    <span>{t.workouts.reps}</span>
                  </div>
                  {ex.sets.map((s, i) => (
                    <div key={s.setNumber} className="grid" style={{ gridTemplateColumns: '60px 1fr 1fr', fontSize: 14, color: 'var(--color-text-secondary)', padding: '10px 16px', backgroundColor: i % 2 === 0 ? 'var(--color-surface-1)' : 'var(--color-surface-2)' }}>
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.setNumber}</span>
                      <span>{s.weightKg !== null ? `${s.weightKg} ${t.checkin.weightUnit}` : t.common.noData}</span>
                      <span>{s.reps !== null ? s.reps : t.common.noData}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Exercise picker ── */}
      {pickerOpen && (
        <ExercisePicker
          library={library}
          onSelect={addExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Stat ─────────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-hint)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{value}</p>
    </div>
  )
}
