'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronUp, ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  upsertTemplate,
  type Exercise,
  type TemplateWithExercises,
} from '../actions'

type ExerciseRow = {
  tempId: string
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  targetSets: number
  targetReps: string
  restSeconds: number
  notes: string
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
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        restSeconds: ex.restSeconds,
        notes: ex.notes ?? '',
      })) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exercisesByGroup = useMemo(() => {
    const grouped: Record<string, Exercise[]> = {}
    for (const ex of allExercises) {
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
  }, [allExercises])

  const exerciseById = useMemo(() => {
    const m = new Map<string, Exercise>()
    for (const ex of allExercises) m.set(ex.id, ex)
    return m
  }, [allExercises])

  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        exerciseId: '',
        exerciseName: '',
        muscleGroup: '',
        targetSets: 3,
        targetReps: '8-10',
        restSeconds: 90,
        notes: '',
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
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          restSeconds: ex.restSeconds,
          notes: ex.notes.trim() ? ex.notes.trim() : undefined,
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
                {/* Drag handle (visual) + reorder */}
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

                {/* Inputs */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
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
                  </div>

                  {/* Sets */}
                  <div className="md:col-span-1">
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-text-hint)' }}>
                      Sets
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={ex.targetSets}
                      onChange={(e) =>
                        updateExercise(ex.tempId, { targetSets: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="w-full text-sm"
                      style={inputStyle()}
                    />
                  </div>

                  {/* Reps */}
                  <div className="md:col-span-2">
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-text-hint)' }}>
                      Reps
                    </label>
                    <input
                      type="text"
                      value={ex.targetReps}
                      onChange={(e) => updateExercise(ex.tempId, { targetReps: e.target.value })}
                      placeholder="8-10"
                      className="w-full text-sm"
                      style={inputStyle()}
                    />
                  </div>

                  {/* Rest */}
                  <div className="md:col-span-1">
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
                  <div className="md:col-span-3">
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

                {/* Delete */}
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
