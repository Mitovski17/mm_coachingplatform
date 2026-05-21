'use client'

import { useState, useTransition, useMemo } from 'react'
import Image from 'next/image'
import { Pencil, Trash2, Plus, X } from 'lucide-react'
import {
  createCustomExercise,
  updateCustomExercise,
  deleteCustomExercise,
  type Exercise,
} from '../actions'

const MUSCLE_GROUPS = [
  'All',
  'Chest', 'Back', 'Shoulders', 'Core', 'Cardio',
  'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abductors', 'Adductors',
] as const

const MUSCLE_COLOR: Record<string, string> = {
  chest: '#3b82f6',
  back: '#22c55e',
  shoulders: '#a855f7',
  core: '#eab308',
  cardio: '#ec4899',
  biceps: '#ef4444',
  triceps: '#f97316',
  quads: '#14b8a6',
  hamstrings: '#10b981',
  glutes: '#06b6d4',
  calves: '#84cc16',
  abductors: '#8b5cf6',
  adductors: '#d946ef',
}

const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight',
  'Kettlebell', 'Resistance Band', 'Smith Machine', 'Other',
]

function muscleColor(group: string) {
  return MUSCLE_COLOR[group.toLowerCase()] ?? '#6b7280'
}

type ModalMode = 'create' | 'edit' | null

interface FormState {
  name: string
  muscleGroup: string
  equipment: string
  description: string
}

const defaultForm: FormState = {
  name: '',
  muscleGroup: 'Chest',
  equipment: 'Barbell',
  description: '',
}

export default function ExerciseLibraryClient({
  exercises: initialExercises,
  workspaceId,
}: {
  exercises: Exercise[]
  workspaceId: string
}) {
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises)
  const [search, setSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState<string>('All')
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    return exercises.filter((e) => {
      const matchesMuscle =
        muscleFilter === 'All' || e.muscleGroup.toLowerCase() === muscleFilter.toLowerCase()
      const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase())
      return matchesMuscle && matchesSearch
    })
  }, [exercises, muscleFilter, search])

  const customCount = exercises.filter((e) => e.workspaceId === workspaceId).length

  function openCreate() {
    setForm(defaultForm)
    setEditingId(null)
    setModalMode('create')
  }

  function openEdit(ex: Exercise) {
    setForm({
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      equipment: ex.equipment,
      description: ex.description ?? '',
    })
    setEditingId(ex.id)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditingId(null)
  }

  function handleSave() {
    startTransition(async () => {
      if (modalMode === 'create') {
        const created = await createCustomExercise({
          workspaceId,
          name: form.name,
          muscleGroup: form.muscleGroup,
          equipment: form.equipment,
        })
        setExercises((prev) => [
          ...prev,
          {
            ...created,
            description: form.description || null,
            workspaceId,
          },
        ])
      } else if (modalMode === 'edit' && editingId) {
        await updateCustomExercise(editingId, workspaceId, {
          name: form.name,
          muscleGroup: form.muscleGroup,
          equipment: form.equipment,
          description: form.description || undefined,
        })
        setExercises((prev) =>
          prev.map((e) =>
            e.id === editingId
              ? { ...e, name: form.name, muscleGroup: form.muscleGroup, equipment: form.equipment, description: form.description || null }
              : e
          )
        )
      }
      closeModal()
    })
  }

  function handleDelete(ex: Exercise) {
    if (!window.confirm('Delete this exercise?')) return
    startTransition(async () => {
      await deleteCustomExercise(ex.id, workspaceId)
      setExercises((prev) => prev.filter((e) => e.id !== ex.id))
    })
  }

  return (
    <div className="px-6 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
            Exercise Library
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {filtered.length} exercise{filtered.length !== 1 ? 's' : ''} &middot;{' '}
            <span>{customCount} custom</span>
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          New Exercise
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 mb-6">
        <input
          type="text"
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 text-sm w-full"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((mg) => {
            const active = muscleFilter === mg
            return (
              <button
                key={mg}
                type="button"
                onClick={() => setMuscleFilter(mg)}
                className="px-3 py-1 text-xs font-medium"
                style={{
                  backgroundColor: active ? 'var(--color-accent)' : 'var(--color-surface-2)',
                  color: active ? '#fff' : 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                {mg}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          className="flex items-center justify-center py-16 text-sm"
          style={{
            color: 'var(--color-text-hint)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          No exercises found.
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
        >
          {filtered.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              workspaceId={workspaceId}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalMode && (
        <ExerciseModal
          mode={modalMode}
          form={form}
          onChange={(field, val) => setForm((f) => ({ ...f, [field]: val }))}
          onSave={handleSave}
          onClose={closeModal}
          saving={pending}
        />
      )}
    </div>
  )
}

function ExerciseCard({
  exercise,
  workspaceId,
  onEdit,
  onDelete,
}: {
  exercise: Exercise
  workspaceId: string
  onEdit: (ex: Exercise) => void
  onDelete: (ex: Exercise) => void
}) {
  const isCustom = exercise.workspaceId === workspaceId
  const color = muscleColor(exercise.muscleGroup)
  const firstLetter = exercise.muscleGroup.charAt(0).toUpperCase()

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top area */}
      <div
        style={{
          height: 100,
          position: 'relative',
          backgroundColor: color + '22',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {exercise.imageUrl ? (
          <Image
            src={exercise.imageUrl}
            alt={exercise.name}
            fill
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <span
            style={{
              fontSize: 36,
              fontWeight: 700,
              color,
              opacity: 0.8,
            }}
          >
            {firstLetter}
          </span>
        )}

        {/* Badge / action buttons */}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
          {isCustom ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(exercise)}
                title="Edit"
                style={{
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(exercise)}
                title="Delete"
                style={{
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#ef4444',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={12} />
              </button>
            </>
          ) : (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 6px',
                backgroundColor: 'rgba(0,0,0,0.45)',
                color: '#ccc',
                borderRadius: 4,
                letterSpacing: '0.03em',
              }}
            >
              Global
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        <p
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {exercise.name}
        </p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Chip label={exercise.muscleGroup} color={color} />
          <Chip label={exercise.equipment} />
        </div>
      </div>
    </div>
  )
}

function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: color ? color + '22' : 'var(--color-surface-3)',
        color: color ?? 'var(--color-text-muted)',
        borderRadius: 4,
        border: '1px solid ' + (color ? color + '44' : 'var(--color-border)'),
      }}
    >
      {label}
    </span>
  )
}

function ExerciseModal({
  mode,
  form,
  onChange,
  onSave,
  onClose,
  saving,
}: {
  mode: ModalMode
  form: FormState
  onChange: (field: keyof FormState, val: string) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
}) {
  const isValid = form.name.trim().length > 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 440,
          padding: 24,
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {mode === 'create' ? 'New Exercise' : 'Edit Exercise'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Name *">
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="e.g. Romanian Deadlift"
              style={inputStyle}
            />
          </Field>

          <Field label="Muscle Group">
            <select
              value={form.muscleGroup}
              onChange={(e) => onChange('muscleGroup', e.target.value)}
              style={inputStyle}
            >
              {MUSCLE_GROUPS.filter((mg) => mg !== 'All').map((mg) => (
                <option key={mg} value={mg}>{mg}</option>
              ))}
            </select>
          </Field>

          <Field label="Equipment">
            <select
              value={form.equipment}
              onChange={(e) => onChange('equipment', e.target.value)}
              style={inputStyle}
            >
              {EQUIPMENT_OPTIONS.map((eq) => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>
          </Field>

          <Field label="Description (optional)">
            <textarea
              value={form.description}
              onChange={(e) => onChange('description', e.target.value)}
              rows={3}
              placeholder="Cues, technique notes..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!isValid || saving}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: isValid && !saving ? 'var(--color-accent)' : 'var(--color-surface-3)',
              color: isValid && !saving ? '#fff' : 'var(--color-text-hint)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: isValid && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  backgroundColor: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text-primary)',
  outline: 'none',
}
