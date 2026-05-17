'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronUp, ChevronDown, GripVertical, Plus, Trash2, Sparkles, Loader2 } from 'lucide-react'
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

const MUSCLE_GROUP_ORDER = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio']

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
    <div className="px-6 py-8 max-w-4xl pb-32">
      {/* Back link */}
      <Link
        href="/coach/programs"
        className="inline-flex items-center gap-1 text-sm mb-4"
        style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}
      >
        <ArrowLeft size={14} />
        Back to programs
      </Link>

      {/* AI panel */}
      <div
        className="mb-6 p-4"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={15} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {aiGenerated ? 'Edit with AI' : 'Generate with AI'}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-hint)' }}>
            {aiGenerated ? 'Describe what you want to change' : 'Describe the workout and AI will build the full template'}
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAiGenerate() }}
            placeholder={aiGenerated ? 'e.g. add a drop set to the last exercise, increase volume on chest' : 'e.g. Push Day - hypertrophy focus, 4 exercises, pyramid sets'}
            className="flex-1 px-3 py-2 text-sm"
            disabled={aiGenerating}
            style={{
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
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: aiGenerating || !aiPrompt.trim() ? 'var(--color-surface-3)' : 'var(--color-accent)',
              color: aiGenerating || !aiPrompt.trim() ? 'var(--color-text-hint)' : '#fff',
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
          <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>
            {aiError}
          </p>
        )}
        {!aiError && !aiGenerating && aiGenerated && (
          <p className="mt-2 text-xs" style={{ color: '#22c55e' }}>
            Template generated — review below and save when ready.
          </p>
        )}
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          {initialData ? initialData.name : 'New Template'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Build a reusable workout you can assign to any client&apos;s program
        </p>
      </div>

      {/* Name */}
      <div className="mb-4">
        <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-hint)' }}>
          Template name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Upper A, Pull Day, Leg Day 1"
          className="w-full text-base"
          style={inputStyle()}
        />
      </div>

      {/* Notes */}
      <div className="mb-8">
        <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-hint)' }}>
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes for this template..."
          rows={2}
          className="w-full text-sm resize-none"
          style={{ ...inputStyle(), lineHeight: 1.5 }}
        />
      </div>

      {/* Exercises section */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          Exercises
        </h2>
        <button
          type="button"
          onClick={addExercise}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          Add Exercise
        </button>
      </div>

      {exercises.length === 0 ? (
        <div
          className="flex items-center justify-center py-12 text-sm"
          style={{
            color: 'var(--color-text-hint)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          No exercises yet. Click &quot;Add Exercise&quot; to start.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exercises.map((ex, i) => (
            <div
              key={ex.tempId}
              className="px-4 py-4"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              <div className="flex items-start gap-3">
                {/* Drag handle + reorder */}
                <div className="flex flex-col items-center gap-1 pt-1.5" style={{ flexShrink: 0 }}>
                  <GripVertical size={14} style={{ color: 'var(--color-text-hint)' }} />
                  <button
                    type="button"
                    onClick={() => moveExercise(ex.tempId, -1)}
                    disabled={i === 0}
                    title="Move up"
                    className="inline-flex items-center justify-center"
                    style={iconBtnStyle(i === 0)}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveExercise(ex.tempId, 1)}
                    disabled={i === exercises.length - 1}
                    title="Move down"
                    className="inline-flex items-center justify-center"
                    style={iconBtnStyle(i === exercises.length - 1)}
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  {/* Top row: exercise selector + rest + notes */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
                    {/* Exercise selector */}
                    <div className="md:col-span-5">
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-text-hint)' }}>
                        Exercise
                      </label>
                      <select
                        value={ex.exerciseId}
                        onChange={(e) => setExerciseSelection(ex.tempId, e.target.value)}
                        className="w-full text-sm"
                        style={inputStyle()}
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
                          fontSize: '0.75rem',
                          color: 'var(--color-accent)',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        + Custom exercise
                      </button>
                    </div>

                    {/* Rest */}
                    <div className="md:col-span-2">
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-text-hint)' }}>
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
                        className="w-full text-sm"
                        style={inputStyle()}
                      />
                    </div>

                    {/* Notes */}
                    <div className="md:col-span-5">
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-text-hint)' }}>
                        Notes
                      </label>
                      <input
                        type="text"
                        value={ex.notes}
                        onChange={(e) => updateExercise(ex.tempId, { notes: e.target.value })}
                        placeholder="e.g. pause at bottom"
                        className="w-full text-sm"
                        style={inputStyle()}
                      />
                    </div>
                  </div>

                  {/* Sets table */}
                  <div>
                    <div
                      className="grid text-xs mb-1"
                      style={{
                        gridTemplateColumns: '32px 64px 96px 64px 1fr 28px',
                        gap: '6px',
                        color: 'var(--color-text-hint)',
                        padding: '0 4px',
                      }}
                    >
                      <span>Set</span>
                      <span>Reps</span>
                      <span>Weight</span>
                      <span>RPE</span>
                      <span>Notes</span>
                      <span />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {ex.sets.map((s) => (
                        <div
                          key={s.tempId}
                          className="grid items-center"
                          style={{
                            gridTemplateColumns: '32px 64px 96px 64px 1fr 28px',
                            gap: '6px',
                          }}
                        >
                          <span
                            className="text-sm text-center"
                            style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}
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
                            className="text-sm"
                            style={{ ...inputStyle(), padding: '6px 8px' }}
                          />
                          <input
                            type="text"
                            value={s.targetWeight}
                            onChange={(e) => updateSet(ex.tempId, s.tempId, { targetWeight: e.target.value })}
                            placeholder="e.g. 80kg"
                            className="text-sm"
                            style={{ ...inputStyle(), padding: '6px 8px' }}
                          />
                          <input
                            type="text"
                            value={s.rpe}
                            onChange={(e) => updateSet(ex.tempId, s.tempId, { rpe: e.target.value })}
                            placeholder="e.g. 8"
                            className="text-sm"
                            style={{ ...inputStyle(), padding: '6px 8px' }}
                          />
                          <input
                            type="text"
                            value={s.notes}
                            onChange={(e) => updateSet(ex.tempId, s.tempId, { notes: e.target.value })}
                            placeholder="optional"
                            className="text-sm"
                            style={{ ...inputStyle(), padding: '6px 8px' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeSet(ex.tempId, s.tempId)}
                            title="Remove set"
                            className="inline-flex items-center justify-center"
                            style={{
                              width: 28,
                              height: 28,
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
                        fontSize: '0.75rem',
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
                  className="inline-flex items-center justify-center mt-5"
                  style={{
                    width: 32,
                    height: 32,
                    color: '#ef4444',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="mt-4 px-4 py-2 text-sm"
          style={{
            backgroundColor: 'rgba(239,68,68,0.12)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {error}
        </div>
      )}

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

      {/* Sticky action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 px-6 py-3 flex items-center justify-end gap-3"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          borderTop: '1px solid var(--color-border)',
          marginLeft: 'var(--coach-sidebar-margin, 0)',
        }}
      >
        <Link
          href="/coach/programs"
          className="px-4 py-2 text-sm font-medium"
          style={{
            color: 'var(--color-text-muted)',
            backgroundColor: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
          }}
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>
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
        <h2 className="text-base mb-5" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          New Custom Exercise
        </h2>

        <div className="mb-4">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-hint)' }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Banded Hip Thrust"
            autoFocus
            className="w-full text-sm"
            style={inputStyle()}
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-hint)' }}>
            Muscle Group
          </label>
          <select
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value)}
            className="w-full text-sm"
            style={inputStyle()}
          >
            {['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'glutes'].map((g) => (
              <option key={g} value={g}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-hint)' }}>
            Equipment
          </label>
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            className="w-full text-sm"
            style={inputStyle()}
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
            className="mb-4 px-3 py-2 text-xs"
            style={{
              backgroundColor: 'rgba(239,68,68,0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium"
            style={{
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
            className="px-4 py-2 text-sm font-medium"
            style={{
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
    color: disabled ? 'var(--color-text-hint)' : 'var(--color-text-muted)',
    backgroundColor: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }
}
