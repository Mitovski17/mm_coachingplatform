'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronUp, ChevronDown, GripVertical, Plus, Trash2, Sparkles, Loader2, BarChart2 } from 'lucide-react'
import {
  upsertTemplate,
  createCustomExercise,
  type Exercise,
  type TemplateWithExercises,
} from '../actions'

type SetRow = {
  tempId: string
  setNumber: number
  targetReps: number
  targetWeight: string
  rpe: string
  notes: string
}

type ExerciseRow = {
  tempId: string
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  restSeconds: number
  notes: string
  sets: SetRow[]
}

function makeDefaultSets(count = 3): SetRow[] {
  return Array.from({ length: count }, (_, i) => ({
    tempId: crypto.randomUUID(),
    setNumber: i + 1,
    targetReps: 10,
    targetWeight: '',
    rpe: '',
    notes: '',
  }))
}

const MUSCLE_GROUP_ORDER = [
  'chest', 'back', 'shoulders', 'core', 'cardio',
  'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors',
]

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  chest: '#f97316',
  back: '#3b82f6',
  shoulders: '#eab308',
  core: '#06b6d4',
  cardio: '#ef4444',
  biceps: '#ef4444',
  triceps: '#f97316',
  quads: '#14b8a6',
  hamstrings: '#10b981',
  glutes: '#ec4899',
  calves: '#84cc16',
  abductors: '#8b5cf6',
  adductors: '#d946ef',
}

function muscleGroupLabel(g: string): string {
  return g.charAt(0).toUpperCase() + g.slice(1)
}

export default function TemplateEditor({
  workspaceId,
  allExercises,
  initialData,
}: {
  workspaceId: string
  allExercises: Exercise[]
  initialData?: TemplateWithExercises
}) {
  const router = useRouter()

  const [name, setName] = useState(initialData?.name ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [exercises, setExercises] = useState<ExerciseRow[]>(
    () =>
      initialData?.exercises.map((ex) => ({
        tempId: crypto.randomUUID(),
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        muscleGroup: ex.muscleGroup,
        restSeconds: ex.restSeconds,
        notes: ex.notes ?? '',
        sets: ex.sets.length > 0
          ? ex.sets.map((s) => ({
              tempId: crypto.randomUUID(),
              setNumber: s.setNumber,
              targetReps: s.targetReps,
              targetWeight: s.targetWeight ?? '',
              rpe: s.rpe ?? '',
              notes: s.notes ?? '',
            }))
          : makeDefaultSets(ex.targetSets || 3),
      })) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exerciseList, setExerciseList] = useState<Exercise[]>(allExercises)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGenerated, setAiGenerated] = useState(false)
  const [customModalForTempId, setCustomModalForTempId] = useState<string | null>(null)

  const exercisesByGroup = useMemo(() => {
    const grouped: Record<string, Exercise[]> = {}
    for (const ex of exerciseList) {
      const g = ex.muscleGroup
      if (!grouped[g]) grouped[g] = []
      grouped[g].push(ex)
    }
    const ordered: Array<[string, Exercise[]]> = []
    for (const g of MUSCLE_GROUP_ORDER) {
      if (grouped[g]) ordered.push([g, grouped[g]])
    }
    for (const g of Object.keys(grouped)) {
      if (!MUSCLE_GROUP_ORDER.includes(g)) ordered.push([g, grouped[g]])
    }
    return ordered
  }, [exerciseList])

  const exerciseById = useMemo(() => {
    const m = new Map<string, Exercise>()
    for (const ex of exerciseList) m.set(ex.id, ex)
    return m
  }, [exerciseList])

  const volumeDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ex of exercises) {
      if (!ex.muscleGroup) continue
      const g = ex.muscleGroup.toLowerCase()
      counts[g] = (counts[g] || 0) + ex.sets.length
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const ordered = [...MUSCLE_GROUP_ORDER, 'glutes']
    return ordered
      .filter((g) => counts[g] > 0)
      .map((g) => ({
        group: g,
        count: counts[g],
        pct: total > 0 ? Math.round((counts[g] / total) * 100) : 0,
      }))
  }, [exercises])

  const totalSets = useMemo(() => exercises.reduce((acc, ex) => acc + ex.sets.length, 0), [exercises])

  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        exerciseId: '',
        exerciseName: '',
        muscleGroup: '',
        restSeconds: 90,
        notes: '',
        sets: makeDefaultSets(3),
      },
    ])
  }

  const updateExercise = (tempId: string, patch: Partial<ExerciseRow>) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.tempId === tempId ? { ...ex, ...patch } : ex))
    )
  }

  const setExerciseSelection = (tempId: string, exerciseId: string) => {
    const ex = exerciseById.get(exerciseId)
    updateExercise(tempId, {
      exerciseId,
      exerciseName: ex?.name ?? '',
      muscleGroup: ex?.muscleGroup ?? '',
    })
  }

  const removeExercise = (tempId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.tempId !== tempId))
  }

  const moveExercise = (tempId: string, dir: -1 | 1) => {
    setExercises((prev) => {
      const idx = prev.findIndex((ex) => ex.tempId === tempId)
      if (idx === -1) return prev
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(idx, 1)
      next.splice(newIdx, 0, item)
      return next
    })
  }

  const updateSet = (exTempId: string, setTempId: string, patch: Partial<SetRow>) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.tempId !== exTempId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) => (s.tempId === setTempId ? { ...s, ...patch } : s)),
            }
      )
    )
  }

  const addSet = (exTempId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.tempId !== exTempId) return ex
        const newSet: SetRow = {
          tempId: crypto.randomUUID(),
          setNumber: ex.sets.length + 1,
          targetReps: 10,
          targetWeight: '',
          rpe: '',
          notes: '',
        }
        return { ...ex, sets: [...ex.sets, newSet] }
      })
    )
  }

  const removeSet = (exTempId: string, setTempId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.tempId !== exTempId) return ex
        const filtered = ex.sets.filter((s) => s.tempId !== setTempId)
        return {
          ...ex,
          sets: filtered.map((s, i) => ({ ...s, setNumber: i + 1 })),
        }
      })
    )
  }

  function serializeCurrentTemplate() {
    return {
      name,
      notes,
      exercises: exercises.map((ex) => ({
        exercise_name: ex.exerciseName,
        muscle_group: ex.muscleGroup,
        rest_seconds: ex.restSeconds,
        notes: ex.notes,
        sets: ex.sets.map((s) => ({
          set_number: s.setNumber,
          target_reps: s.targetReps,
          target_weight: s.targetWeight,
          rpe: s.rpe,
          notes: s.notes,
        })),
      })),
    }
  }

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiGenerating) return
    setAiGenerating(true)
    setAiError(null)
    try {
      const res = await fetch('/api/program/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: aiPrompt.trim(),
          workspace_id: workspaceId,
          ...(aiGenerated ? { current_template: serializeCurrentTemplate() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (data.name) setName(data.name)
      if (data.notes) setNotes(data.notes)
      const exerciseRows: ExerciseRow[] = (data.exercises ?? []).map(
        (ex: {
          exerciseId: string
          exerciseName: string
          muscleGroup: string
          restSeconds: number
          notes: string
          sets: Array<{
            setNumber: number
            targetReps: number
            targetWeight: string
            rpe: string
            notes: string
          }>
        }) => ({
          tempId: crypto.randomUUID(),
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          restSeconds: ex.restSeconds,
          notes: ex.notes ?? '',
          sets: ex.sets.map((s) => ({
            tempId: crypto.randomUUID(),
            setNumber: s.setNumber,
            targetReps: s.targetReps,
            targetWeight: s.targetWeight ?? '',
            rpe: s.rpe ?? '',
            notes: s.notes ?? '',
          })),
        })
      )
      setExercises(exerciseRows)
      setExerciseList((prev) => {
        const existingIds = new Set(prev.map((e) => e.id))
        const toAdd: Exercise[] = exerciseRows
          .filter((r) => !existingIds.has(r.exerciseId))
          .map((r) => ({
            id: r.exerciseId,
            name: r.exerciseName,
            muscleGroup: r.muscleGroup,
            equipment: '',
          }))
        return toAdd.length ? [...prev, ...toAdd] : prev
      })
      setAiGenerated(true)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleSave = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Template name is required')
      return
    }
    if (exercises.length === 0) {
      setError('Add at least one exercise')
      return
    }
    if (exercises.some((ex) => !ex.exerciseId)) {
      setError('Every exercise row must have an exercise selected')
      return
    }
    setSaving(true)
    try {
      await upsertTemplate({
        id: initialData?.id,
        workspaceId,
        name: name.trim(),
        notes: notes.trim() ? notes.trim() : undefined,
        exercises: exercises.map((ex, i) => ({
          exerciseId: ex.exerciseId,
          sortOrder: i,
          restSeconds: ex.restSeconds,
          notes: ex.notes.trim() ? ex.notes.trim() : undefined,
          sets: ex.sets.map((s) => ({
            setNumber: s.setNumber,
            targetReps: s.targetReps,
            targetWeight: s.targetWeight.trim() || undefined,
            rpe: s.rpe.trim() || undefined,
            notes: s.notes.trim() || undefined,
          })),
        })),
      })
      router.push('/coach/programs')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template')
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Top header bar */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-1)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link
            href="/coach/programs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.75rem',
              color: 'var(--color-text-hint)',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={12} />
            Programs
          </Link>
          <span style={{ color: 'var(--color-border)', fontSize: '0.75rem' }}>›</span>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-hint)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 500,
            }}
          >
            Templates
          </span>
          <span style={{ color: 'var(--color-border)', fontSize: '0.75rem' }}>›</span>
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-text-primary)',
              fontWeight: 600,
            }}
          >
            {name || 'New Template'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)' }}>
            Editing template
          </span>
          <Link
            href="/coach/programs"
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '6px 16px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Two-column layout — fills viewport height below the header */}
      <div style={{ display: 'flex', height: 'calc(100vh - 53px)', overflow: 'hidden' }}>
        {/* Left: main editor */}
        <div className="no-scrollbar" style={{ flex: '0 0 55%', overflowY: 'auto', padding: '28px 32px 80px' }}>
          {/* AI panel */}
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sparkles size={15} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {aiGenerated ? 'Edit with AI' : 'Generate with AI'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-hint)' }}>
                {aiGenerated
                  ? 'Describe what you want to change'
                  : 'Describe the workout and AI will build the full template'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAiGenerate() }}
                placeholder={
                  aiGenerated
                    ? 'e.g. add a drop set to the last exercise, increase volume on chest'
                    : 'e.g. Push Day - hypertrophy focus, 4 exercises, pyramid sets'
                }
                disabled={aiGenerating}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--color-surface-3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  opacity: aiGenerating ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={aiGenerating || !aiPrompt.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  backgroundColor:
                    aiGenerating || !aiPrompt.trim()
                      ? 'var(--color-surface-3)'
                      : 'var(--color-accent)',
                  color:
                    aiGenerating || !aiPrompt.trim() ? 'var(--color-text-hint)' : '#fff',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: aiGenerating || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
              >
                {aiGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    {aiGenerated ? 'Apply Edit' : 'Generate'}
                  </>
                )}
              </button>
            </div>

            {aiError && (
              <p style={{ marginTop: 8, fontSize: '0.75rem', color: '#ef4444' }}>{aiError}</p>
            )}
            {!aiError && !aiGenerating && aiGenerated && (
              <p style={{ marginTop: 8, fontSize: '0.75rem', color: '#22c55e' }}>
                Template generated — review below and save when ready.
              </p>
            )}
          </div>

          {/* Template name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-hint)', marginBottom: 6 }}>
              Template name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Upper A, Pull Day, Leg Day 1"
              style={{ ...inputStyle(), width: '100%', fontSize: '1rem' }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-hint)', marginBottom: 6 }}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for this template..."
              rows={2}
              style={{ ...inputStyle(), width: '100%', fontSize: '0.875rem', lineHeight: 1.5, resize: 'none' }}
            />
          </div>

          {/* Exercises header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Exercises
            </h2>
            <button
              type="button"
              onClick={addExercise}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: '0.825rem',
                fontWeight: 500,
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Plus size={14} />
              Add Exercise
            </button>
          </div>

          {exercises.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 0',
                fontSize: '0.875rem',
                color: 'var(--color-text-hint)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              No exercises yet. Click &quot;Add Exercise&quot; to start.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {exercises.map((ex, i) => (
                <div
                  key={ex.tempId}
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-xl)',
                  }}
                >
                  {/* Muscle group pill */}
                  {ex.muscleGroup && (
                    <div style={{ marginBottom: 10 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderRadius: 999,
                          backgroundColor: `${MUSCLE_GROUP_COLORS[ex.muscleGroup.toLowerCase()] ?? '#6b7280'}22`,
                          color: MUSCLE_GROUP_COLORS[ex.muscleGroup.toLowerCase()] ?? '#6b7280',
                          border: `1px solid ${MUSCLE_GROUP_COLORS[ex.muscleGroup.toLowerCase()] ?? '#6b7280'}44`,
                        }}
                      >
                        {ex.muscleGroup}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Drag handle + reorder */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 6, flexShrink: 0 }}>
                      <GripVertical size={14} style={{ color: 'var(--color-text-hint)' }} />
                      <button
                        type="button"
                        onClick={() => moveExercise(ex.tempId, -1)}
                        disabled={i === 0}
                        title="Move up"
                        style={iconBtnStyle(i === 0)}
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveExercise(ex.tempId, 1)}
                        disabled={i === exercises.length - 1}
                        title="Move down"
                        style={iconBtnStyle(i === exercises.length - 1)}
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>

                    {/* Main content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Top row: exercise selector + rest + notes */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 80px 1fr',
                          gap: 12,
                          marginBottom: 16,
                        }}
                      >
                        {/* Exercise selector */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: 4 }}>
                            Exercise
                          </label>
                          <select
                            value={ex.exerciseId}
                            onChange={(e) => setExerciseSelection(ex.tempId, e.target.value)}
                            style={{ ...inputStyle(), width: '100%', fontSize: '0.875rem' }}
                          >
                            <option value="">— Select exercise —</option>
                            {exercisesByGroup.map(([group, list]) => (
                              <optgroup key={group} label={muscleGroupLabel(group)}>
                                {list.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setCustomModalForTempId(ex.tempId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '4px 0 0',
                              fontSize: '0.72rem',
                              color: 'var(--color-accent)',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            + Custom exercise
                          </button>
                        </div>

                        {/* Rest */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: 4 }}>
                            Rest (s)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={15}
                            value={ex.restSeconds}
                            onChange={(e) =>
                              updateExercise(ex.tempId, { restSeconds: Math.max(0, Number(e.target.value) || 0) })
                            }
                            style={{ ...inputStyle(), width: '100%', fontSize: '0.875rem' }}
                          />
                        </div>

                        {/* Notes */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: 4 }}>
                            Notes
                          </label>
                          <input
                            type="text"
                            value={ex.notes}
                            onChange={(e) => updateExercise(ex.tempId, { notes: e.target.value })}
                            placeholder="e.g. pause at bottom"
                            style={{ ...inputStyle(), width: '100%', fontSize: '0.875rem' }}
                          />
                        </div>
                      </div>

                      {/* Sets table */}
                      <div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '32px 64px 88px 60px 1fr 28px',
                            gap: 6,
                            color: 'var(--color-text-hint)',
                            fontSize: '0.7rem',
                            padding: '0 4px',
                            marginBottom: 4,
                          }}
                        >
                          <span>Set</span>
                          <span>Reps</span>
                          <span>Weight</span>
                          <span>RPE</span>
                          <span>Notes</span>
                          <span />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {ex.sets.map((s) => (
                            <div
                              key={s.tempId}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '32px 64px 88px 60px 1fr 28px',
                                gap: 6,
                                alignItems: 'center',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.875rem',
                                  textAlign: 'center',
                                  color: 'var(--color-text-muted)',
                                  fontWeight: 500,
                                }}
                              >
                                {s.setNumber}
                              </span>
                              <input
                                type="number"
                                min={1}
                                value={s.targetReps}
                                onChange={(e) =>
                                  updateSet(ex.tempId, s.tempId, {
                                    targetReps: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                style={{ ...inputStyle(), padding: '6px 8px', fontSize: '0.875rem' }}
                              />
                              <input
                                type="text"
                                value={s.targetWeight}
                                onChange={(e) => updateSet(ex.tempId, s.tempId, { targetWeight: e.target.value })}
                                placeholder="80"
                                style={{ ...inputStyle(), padding: '6px 8px', fontSize: '0.875rem' }}
                              />
                              <input
                                type="text"
                                value={s.rpe}
                                onChange={(e) => updateSet(ex.tempId, s.tempId, { rpe: e.target.value })}
                                placeholder="8"
                                style={{ ...inputStyle(), padding: '6px 8px', fontSize: '0.875rem' }}
                              />
                              <input
                                type="text"
                                value={s.notes}
                                onChange={(e) => updateSet(ex.tempId, s.tempId, { notes: e.target.value })}
                                placeholder="optional"
                                style={{ ...inputStyle(), padding: '6px 8px', fontSize: '0.875rem' }}
                              />
                              <button
                                type="button"
                                onClick={() => removeSet(ex.tempId, s.tempId)}
                                title="Remove set"
                                style={{
                                  width: 28,
                                  height: 28,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ef4444',
                                  backgroundColor: 'transparent',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: 'var(--radius-md)',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => addSet(ex.tempId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '6px 4px 0',
                            fontSize: '0.72rem',
                            color: 'var(--color-accent)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          + Add set
                        </button>
                      </div>
                    </div>

                    {/* Delete exercise */}
                    <button
                      type="button"
                      onClick={() => removeExercise(ex.tempId)}
                      title="Remove exercise"
                      style={{
                        width: 30,
                        height: 30,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 20,
                        color: '#ef4444',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                marginTop: 16,
                padding: '8px 16px',
                fontSize: '0.875rem',
                backgroundColor: 'rgba(239,68,68,0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Right: sidebar */}
        <div
          className="no-scrollbar"
          style={{
            flex: '1 1 45%',
            borderLeft: '1px solid var(--color-border)',
            padding: '28px 32px',
            overflowY: 'auto',
            backgroundColor: 'var(--color-surface-1)',
          }}
        >
          {/* Stats summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <p style={{ fontSize: '0.65rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Exercises
              </p>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                {exercises.length}
              </p>
            </div>
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <p style={{ fontSize: '0.65rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Total Sets
              </p>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                {totalSets}
              </p>
            </div>
          </div>

          {/* Weekly volume distribution */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <BarChart2 size={14} style={{ color: 'var(--color-text-hint)' }} />
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--color-text-hint)',
                }}
              >
                Volume Distribution
              </span>
            </div>

            {volumeDistribution.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-hint)', fontStyle: 'italic' }}>
                Add exercises to see volume breakdown.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {volumeDistribution.map(({ group, pct }) => {
                  const color = MUSCLE_GROUP_COLORS[group] ?? '#6b7280'
                  return (
                    <div key={group}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                          {muscleGroupLabel(group)}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)' }}>
                          {pct}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: 'var(--color-surface-3)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            borderRadius: 999,
                            backgroundColor: color,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Exercise list summary */}
          {exercises.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: 'var(--color-text-hint)',
                  }}
                >
                  Exercise List
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {exercises.map((ex, i) => (
                  <div
                    key={ex.tempId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      backgroundColor: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: 'var(--color-text-hint)',
                        width: 16,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    {ex.muscleGroup && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: MUSCLE_GROUP_COLORS[ex.muscleGroup.toLowerCase()] ?? '#6b7280',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: '0.78rem',
                          color: ex.exerciseName ? 'var(--color-text-primary)' : 'var(--color-text-hint)',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ex.exerciseName || 'Unselected'}
                      </p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--color-text-hint)' }}>
                        {ex.sets.length} {ex.sets.length === 1 ? 'set' : 'sets'}
                        {ex.restSeconds > 0 ? ` · ${ex.restSeconds}s rest` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom exercise modal */}
      {customModalForTempId && (
        <CustomExerciseModal
          workspaceId={workspaceId}
          onSave={(newExercise) => {
            setExerciseList((prev) => [...prev, newExercise])
            updateExercise(customModalForTempId, {
              exerciseId: newExercise.id,
              exerciseName: newExercise.name,
              muscleGroup: newExercise.muscleGroup,
            })
            setCustomModalForTempId(null)
          }}
          onClose={() => setCustomModalForTempId(null)}
        />
      )}
    </div>
  )
}

function CustomExerciseModal({
  workspaceId,
  onSave,
  onClose,
}: {
  workspaceId: string
  onSave: (exercise: Exercise) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('chest')
  const [equipment, setEquipment] = useState('barbell')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const exercise = await createCustomExercise({
        workspaceId,
        name: name.trim(),
        muscleGroup,
        equipment,
      })
      onSave(exercise)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create exercise')
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
        }}
      >
        <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 20 }}>
          New Custom Exercise
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-hint)', marginBottom: 6 }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Banded Hip Thrust"
            autoFocus
            style={{ ...inputStyle(), width: '100%', fontSize: '0.875rem' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-hint)', marginBottom: 6 }}>
            Muscle Group
          </label>
          <select
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value)}
            style={{ ...inputStyle(), width: '100%', fontSize: '0.875rem' }}
          >
            {['chest', 'back', 'shoulders', 'core', 'cardio', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors'].map((g) => (
              <option key={g} value={g}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-hint)', marginBottom: 6 }}>
            Equipment
          </label>
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            style={{ ...inputStyle(), width: '100%', fontSize: '0.875rem' }}
          >
            {['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'resistance band', 'other'].map((eq) => (
              <option key={eq} value={eq}>
                {eq.charAt(0).toUpperCase() + eq.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: '8px 12px',
              fontSize: '0.75rem',
              backgroundColor: 'rgba(239,68,68,0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function inputStyle(): React.CSSProperties {
  return {
    backgroundColor: 'var(--color-surface-3)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    padding: '8px 12px',
    outline: 'none',
    fontFamily: 'inherit',
  }
}

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: disabled ? 'var(--color-text-hint)' : 'var(--color-text-muted)',
    backgroundColor: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }
}
