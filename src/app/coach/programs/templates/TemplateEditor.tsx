'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronUp, ChevronDown, GripVertical, Plus, Trash2, Sparkles, Loader2, BarChart2, RotateCcw } from 'lucide-react'
import {
  upsertTemplate,
  createCustomExercise,
  type Exercise,
  type TemplateWithDays,
} from '../actions'
import { normalizeIntegerInput } from '@/lib/numeric-input'

type SetRow = {
  tempId: string
  setNumber: number
  targetReps: string
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

type DayState = {
  tempId: string
  id?: string
  label: string
  notes: string
  exercises: ExerciseRow[]
}

function makeDefaultSets(count = 3): SetRow[] {
  return Array.from({ length: count }, (_, i) => ({
    tempId: crypto.randomUUID(),
    setNumber: i + 1,
    targetReps: '10',
    targetWeight: '',
    rpe: '',
    notes: '',
  }))
}

function makeDefaultDay(index: number): DayState {
  return {
    tempId: crypto.randomUUID(),
    label: `Day ${index + 1}`,
    notes: '',
    exercises: [],
  }
}

const MUSCLE_GROUP_ORDER = [
  'chest', 'back', 'shoulders', 'core', 'cardio',
  'biceps', 'triceps', 'arms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors', 'legs',
]

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  chest: '#f97316',
  back: '#3b82f6',
  shoulders: '#eab308',
  core: '#06b6d4',
  cardio: '#ef4444',
  biceps: '#ef4444',
  triceps: '#f97316',
  arms: '#f59e0b',       // amber — fallback for un-migrated broad "arms" entries
  quads: '#14b8a6',
  hamstrings: '#10b981',
  glutes: '#ec4899',
  calves: '#84cc16',
  abductors: '#8b5cf6',
  adductors: '#d946ef',
  legs: '#7c3aed',       // purple — fallback for any remaining broad "legs" entries
}

function muscleGroupLabel(g: string): string {
  return g.charAt(0).toUpperCase() + g.slice(1)
}

function snapshotTemplate(name: string, notes: string, days: DayState[]): string {
  return JSON.stringify({
    name: name.trim(),
    notes: notes.trim(),
    days: days.map((d) => ({
      label: d.label.trim(),
      notes: d.notes.trim(),
      exercises: d.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        restSeconds: ex.restSeconds,
        notes: ex.notes.trim(),
        sets: ex.sets.map((s) => ({
          setNumber: s.setNumber,
          targetReps: s.targetReps,
          targetWeight: s.targetWeight.trim(),
          rpe: s.rpe.trim(),
          notes: s.notes.trim(),
        })),
      })),
    })),
  })
}

function snapshotInitialTemplate(initialData?: TemplateWithDays): string | null {
  if (!initialData) return null
  return JSON.stringify({
    name: initialData.name.trim(),
    notes: (initialData.notes ?? '').trim(),
    days: initialData.days.map((d) => ({
      label: d.label.trim(),
      notes: (d.notes ?? '').trim(),
      exercises: d.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        restSeconds: ex.restSeconds,
        notes: (ex.notes ?? '').trim(),
        sets: ex.sets.map((s) => ({
          setNumber: s.setNumber,
          targetReps: String(s.targetReps ?? 0),
          targetWeight: (s.targetWeight ?? '').trim(),
          rpe: (s.rpe ?? '').trim(),
          notes: (s.notes ?? '').trim(),
        })),
      })),
    })),
  })
}

function ExerciseCombobox({
  value,
  onChange,
  exercises,
}: {
  value: string
  onChange: (id: string) => void
  exercises: Exercise[]
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = exercises.find((e) => e.id === value) ?? null

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return exercises
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)
    )
  }, [exercises, query])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={open ? query : (selected?.name ?? '')}
        placeholder="Search exercise…"
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setOpen(true); setQuery('') }}
        style={{ ...inputStyle(), width: '100%', fontSize: '0.875rem', boxSizing: 'border-box' }}
      />
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 200,
          background: 'var(--color-surface-3)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          maxHeight: 240,
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              No exercises found
            </div>
          ) : (
            filtered.map((e) => (
              <div
                key={e.id}
                onMouseDown={(ev) => {
                  ev.preventDefault()
                  onChange(e.id)
                  setOpen(false)
                  setQuery('')
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: e.id === value ? 'var(--color-accent)' : 'var(--color-text-primary)',
                  background: e.id === value ? 'rgba(255,255,255,0.04)' : 'transparent',
                }}
              >
                <span>{e.name}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: 8 }}>
                  {muscleGroupLabel(e.muscleGroup)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function TemplateEditor({
  workspaceId,
  allExercises,
  initialData,
}: {
  workspaceId: string
  allExercises: Exercise[]
  initialData?: TemplateWithDays
}) {
  const router = useRouter()

  const [name, setName] = useState(initialData?.name ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')

  const [days, setDays] = useState<DayState[]>(() => {
    if (initialData && initialData.days.length > 0) {
      return initialData.days.map((d) => ({
        tempId: crypto.randomUUID(),
        id: d.id,
        label: d.label,
        notes: d.notes ?? '',
        exercises: d.exercises.map((ex) => ({
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
                targetReps: String(s.targetReps ?? 0),
                targetWeight: s.targetWeight ?? '',
                rpe: s.rpe ?? '',
                notes: s.notes ?? '',
              }))
            : makeDefaultSets(ex.targetSets || 3),
        })),
      }))
    }
    return [makeDefaultDay(0)]
  })

  const [activeDayIndex, setActiveDayIndex] = useState(0)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedIdRef = useRef<string | undefined>(initialData?.id)
  const savedStateRef = useRef<string | null>(snapshotInitialTemplate(initialData))
  const isDirty = useMemo(
    () => savedStateRef.current === null || snapshotTemplate(name, notes, days) !== savedStateRef.current,
    [name, notes, days],
  )
  const [exerciseList, setExerciseList] = useState<Exercise[]>(allExercises)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGenerated, setAiGenerated] = useState(false)
  const [aiEditModalOpen, setAiEditModalOpen] = useState(false)
  const [customModalForTempId, setCustomModalForTempId] = useState<string | null>(null)

  // ── Undo stack ────────────────────────────────────────────────────────────────
  type TemplateSnapshot = { days: DayState[]; name: string; notes: string }
  const undoStack = useRef<TemplateSnapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)

  const pushUndo = () => {
    undoStack.current = [
      ...undoStack.current.slice(-19),
      { days: JSON.parse(JSON.stringify(days)), name, notes },
    ]
    setCanUndo(true)
  }

  const handleUndo = () => {
    if (undoStack.current.length === 0) return
    const snap = undoStack.current[undoStack.current.length - 1]
    undoStack.current = undoStack.current.slice(0, -1)
    setDays(snap.days)
    setName(snap.name)
    setNotes(snap.notes)
    setCanUndo(undoStack.current.length > 0)
  }

  const activeDay = days[activeDayIndex] ?? days[0]
  const exercises = activeDay?.exercises ?? []

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
    // Ordered groups first, then any unknown groups appended at end
    const orderedGroups = [
      ...MUSCLE_GROUP_ORDER.filter((g) => counts[g] > 0),
      ...Object.keys(counts).filter((g) => !MUSCLE_GROUP_ORDER.includes(g)),
    ]
    return orderedGroups.map((g) => ({
      group: g,
      count: counts[g],
      pct: total > 0 ? Math.round((counts[g] / total) * 100) : 0,
    }))
  }, [exercises])

  const totalSets = useMemo(() => exercises.reduce((acc, ex) => acc + ex.sets.length, 0), [exercises])

  // ── Day mutations ────────────────────────────────────────────────────────────

  const addDay = () => {
    pushUndo()
    const newDay = makeDefaultDay(days.length)
    setDays((prev) => [...prev, newDay])
    setActiveDayIndex(days.length)
  }

  const removeDay = (idx: number) => {
    if (days.length <= 1) return
    pushUndo()
    setDays((prev) => prev.filter((_, i) => i !== idx))
    setActiveDayIndex((prev) => (prev >= idx && prev > 0 ? prev - 1 : prev))
  }

  const updateDayLabel = (idx: number, label: string) => {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, label } : d)))
  }

  const updateDayNotes = (idx: number, notes: string) => {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, notes } : d)))
  }

  // ── Exercise mutations (operate on active day) ───────────────────────────────

  const setActiveDayExercises = (updater: (prev: ExerciseRow[]) => ExerciseRow[]) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i === activeDayIndex ? { ...d, exercises: updater(d.exercises) } : d
      )
    )
  }

  const addExercise = () => {
    pushUndo()
    setActiveDayExercises((prev) => [
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
    setActiveDayExercises((prev) =>
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
    pushUndo()
    setActiveDayExercises((prev) => prev.filter((ex) => ex.tempId !== tempId))
  }

  const moveExercise = (tempId: string, dir: -1 | 1) => {
    pushUndo()
    setActiveDayExercises((prev) => {
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
    setActiveDayExercises((prev) =>
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
    pushUndo()
    setActiveDayExercises((prev) =>
      prev.map((ex) => {
        if (ex.tempId !== exTempId) return ex
        const newSet: SetRow = {
          tempId: crypto.randomUUID(),
          setNumber: ex.sets.length + 1,
          targetReps: '10',
          targetWeight: '',
          rpe: '',
          notes: '',
        }
        return { ...ex, sets: [...ex.sets, newSet] }
      })
    )
  }

  const removeSet = (exTempId: string, setTempId: string) => {
    pushUndo()
    setActiveDayExercises((prev) =>
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

  // ── AI generation ────────────────────────────────────────────────────────────

  /** Serialise the full template (all days) for AI edit context */
  function serializeTemplate() {
    return {
      name,
      notes,
      days: days.map((d) => ({
        label: d.label,
        notes: d.notes,
        exercises: d.exercises.map((ex) => ({
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
          // Pass the full template when editing so AI can modify any day
          ...(aiGenerated ? { current_template: serializeTemplate() } : {}),
        }),
      })
      const rawText = await res.text()
      let data: Record<string, unknown>
      try {
        data = JSON.parse(rawText)
      } catch {
        throw new Error(`Server error (${res.status}): ${rawText.slice(0, 300)}`)
      }
      if (!res.ok) throw new Error((data.error as string) ?? `HTTP ${res.status}`)

      type ResolvedExercise = {
        exerciseId: string
        exerciseName: string
        muscleGroup: string
        restSeconds: number
        notes: string
        sets: Array<{ setNumber: number; targetReps: number; targetWeight: string; rpe: string; notes: string }>
      }
      type ResolvedDay = { label: string; notes: string; exercises: ResolvedExercise[] }

      const toExerciseRow = (ex: ResolvedExercise): ExerciseRow => ({
        tempId: crypto.randomUUID(),
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        muscleGroup: ex.muscleGroup,
        restSeconds: ex.restSeconds,
        notes: ex.notes ?? '',
        sets: ex.sets.map((s) => ({
          tempId: crypto.randomUUID(),
          setNumber: s.setNumber,
          targetReps: String(s.targetReps ?? 0),
          targetWeight: s.targetWeight ?? '',
          rpe: s.rpe ?? '',
          notes: s.notes ?? '',
        })),
      })

      // API always returns { name, notes, days: [...] }
      if (Array.isArray(data.days) && data.days.length > 0) {
        pushUndo()
        // Replace the entire template with the AI-generated days
        const newDays: DayState[] = (data.days as ResolvedDay[]).map((d) => ({
          tempId: crypto.randomUUID(),
          label: d.label,
          notes: d.notes ?? '',
          exercises: d.exercises.map(toExerciseRow),
        }))
        setDays(newDays)
        setActiveDayIndex(0)

        // Merge any new exercises into the local library
        setExerciseList((prev) => {
          const existingIds = new Set(prev.map((e) => e.id))
          const toAdd: Exercise[] = newDays
            .flatMap((d) => d.exercises)
            .filter((r) => !existingIds.has(r.exerciseId))
            .map((r) => ({ id: r.exerciseId, name: r.exerciseName, muscleGroup: r.muscleGroup, equipment: '' }))
          return toAdd.length ? [...prev, ...toAdd] : prev
        })
      }

      if (data.name && !name) setName(data.name as string)
      if (data.notes && !notes) setNotes(data.notes as string)

      setAiGenerated(true)
      setAiPrompt('')
      setAiEditModalOpen(false)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setAiGenerating(false)
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Template name is required')
      return
    }
    const hasExercises = days.some((d) => d.exercises.length > 0)
    if (!hasExercises) {
      setError('Add at least one exercise to any day')
      return
    }
    const hasUnselected = days.some((d) => d.exercises.some((ex) => !ex.exerciseId))
    if (hasUnselected) {
      setError('Every exercise row must have an exercise selected')
      return
    }
    setSaving(true)
    try {
      const result = await upsertTemplate({
        id: savedIdRef.current,
        workspaceId,
        name: name.trim(),
        notes: notes.trim() ? notes.trim() : undefined,
        days: days.map((d, i) => ({
          id: d.id,
          label: d.label.trim() || `Day ${i + 1}`,
          sortOrder: i,
          notes: d.notes.trim() ? d.notes.trim() : undefined,
          exercises: d.exercises.map((ex, j) => ({
            exerciseId: ex.exerciseId,
            sortOrder: j,
            restSeconds: ex.restSeconds,
            notes: ex.notes.trim() ? ex.notes.trim() : undefined,
            sets: ex.sets.map((s) => ({
              setNumber: s.setNumber,
              targetReps: Number(s.targetReps) || 0,
              targetWeight: s.targetWeight.trim() || undefined,
              rpe: s.rpe.trim() || undefined,
              notes: s.notes.trim() || undefined,
            })),
          })),
        })),
      })
      const isNew = !savedIdRef.current
      savedIdRef.current = result.id
      savedStateRef.current = snapshotTemplate(name, notes, days)
      setSaving(false)
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        if (isNew) {
          router.replace(`/coach/programs/templates/${result.id}`)
        } else {
          router.refresh()
        }
      }, 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template')
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden' }}>
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
          {canUndo && (
            <button
              type="button"
              onClick={handleUndo}
              title="Undo last change"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 500,
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <RotateCcw size={13} />
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved || !isDirty}
            style={{
              padding: '6px 16px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: saved ? '#16a34a' : 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: saving || saved || !isDirty ? 'not-allowed' : 'pointer',
              opacity: saved ? 1 : (saving || !isDirty ? 0.5 : 1),
              fontFamily: 'inherit',
              transition: 'opacity 0.15s, background-color 0.2s',
            }}
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="coach-editor-body" style={{ overflow: 'hidden' }}>
        {/* Left: main editor */}
        <div className="coach-editor-left no-scrollbar" style={{ flex: '0 0 55%', minWidth: 0, overflowY: 'auto', padding: '28px 32px 80px' }}>

          {/* AI panel */}
          {!aiGenerated ? (
            <div
              style={{
                marginBottom: 24,
                padding: 16,
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Sparkles size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '0.02em' }}>
                  AI Assist
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', marginLeft: 4 }}>
                  — generates exercises for the active day
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiGenerate() } }}
                  placeholder="e.g. Push Day - hypertrophy focus, 4 exercises, pyramid sets"
                  disabled={aiGenerating}
                  rows={3}
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
                    resize: 'none',
                    lineHeight: 1.5,
                  }}
                />
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  onMouseEnter={(e) => { if (!aiGenerating && aiPrompt.trim()) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f97316' }}
                  onMouseLeave={(e) => { if (!aiGenerating && aiPrompt.trim()) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-accent)' }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    backgroundColor: aiGenerating || !aiPrompt.trim() ? 'var(--color-surface-3)' : 'var(--color-accent)',
                    color: aiGenerating || !aiPrompt.trim() ? 'var(--color-text-hint)' : '#fff',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: aiGenerating || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                    transition: 'background-color 0.15s ease',
                    alignSelf: 'stretch',
                  }}
                >
                  {aiGenerating ? (
                    <><Loader2 size={13} className="animate-spin" /> Generating…</>
                  ) : (
                    <><Sparkles size={13} /> Generate</>
                  )}
                </button>
              </div>
              {aiError && (
                <p style={{ marginTop: 8, fontSize: '0.75rem', color: '#ef4444' }}>{aiError}</p>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: 24 }}>
              <button
                type="button"
                onClick={() => { setAiError(null); setAiEditModalOpen(true) }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f97316'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#f97316' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-surface-2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)' }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-surface-2)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                }}
              >
                <Sparkles size={13} style={{ color: 'var(--color-accent)' }} />
                Edit with AI
              </button>
            </div>
          )}

          {/* Edit with AI modal */}
          {aiEditModalOpen && (
            <div
              onClick={() => setAiEditModalOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 50,
                backgroundColor: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 480,
                  backgroundColor: 'var(--color-surface-1)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 24,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Sparkles size={15} style={{ color: 'var(--color-accent)' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      Edit with AI — {activeDay?.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiEditModalOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', padding: 4 }}
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiGenerate() } }}
                  placeholder="e.g. add a drop set to the last exercise, increase volume on chest"
                  disabled={aiGenerating}
                  rows={4}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '0.85rem',
                    backgroundColor: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    opacity: aiGenerating ? 0.6 : 1,
                    fontFamily: 'inherit',
                    resize: 'none',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                    marginBottom: 12,
                  }}
                />
                {aiError && (
                  <p style={{ marginBottom: 10, fontSize: '0.75rem', color: '#ef4444' }}>{aiError}</p>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setAiEditModalOpen(false)}
                    style={{
                      padding: '8px 16px', fontSize: '0.82rem', fontWeight: 500,
                      backgroundColor: 'var(--color-surface-3)', color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    onMouseEnter={(e) => { if (!aiGenerating && aiPrompt.trim()) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f97316' }}
                    onMouseLeave={(e) => { if (!aiGenerating && aiPrompt.trim()) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-accent)' }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 18px', fontSize: '0.82rem', fontWeight: 600,
                      backgroundColor: aiGenerating || !aiPrompt.trim() ? 'var(--color-surface-3)' : 'var(--color-accent)',
                      color: aiGenerating || !aiPrompt.trim() ? 'var(--color-text-hint)' : '#fff',
                      border: 'none', borderRadius: 'var(--radius-md)',
                      cursor: aiGenerating || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', transition: 'background-color 0.15s ease',
                    }}
                  >
                    {aiGenerating ? (
                      <><Loader2 size={13} className="animate-spin" /> Applying…</>
                    ) : (
                      <><Sparkles size={13} /> Apply Edit</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Template name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-hint)', marginBottom: 6 }}>
              Template name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Upper/Lower 4-Day Split"
              style={{ ...inputStyle(), width: '100%', fontSize: '1rem' }}
            />
          </div>

          {/* Template notes */}
          <div style={{ marginBottom: 28 }}>
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

          {/* Day tabs */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                overflowX: 'auto',
                paddingBottom: 4,
              }}
              className="no-scrollbar"
            >
              {days.map((day, idx) => (
                <div
                  key={day.tempId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: activeDayIndex === idx ? 'var(--color-accent)' : 'var(--color-border)',
                    backgroundColor: activeDayIndex === idx ? `var(--color-accent)22` : 'var(--color-surface-2)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.12s ease',
                  }}
                  onClick={() => setActiveDayIndex(idx)}
                >
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: activeDayIndex === idx ? 600 : 500,
                      color: activeDayIndex === idx ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {day.label || `Day ${idx + 1}`}
                  </span>
                  {days.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeDay(idx) }}
                      title={`Remove ${day.label}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: activeDayIndex === idx ? 'var(--color-accent)' : 'var(--color-text-hint)',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        lineHeight: 1,
                        padding: 0,
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addDay}
                title="Add workout day"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--color-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-hint)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Active day label + notes */}
          {activeDay && (
            <div
              style={{
                marginBottom: 20,
                padding: '12px 14px',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: 5 }}>
                  Day label
                </label>
                <input
                  type="text"
                  value={activeDay.label}
                  onChange={(e) => updateDayLabel(activeDayIndex, e.target.value)}
                  placeholder={`Day ${activeDayIndex + 1}`}
                  style={{ ...inputStyle(), width: '100%', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: 5 }}>
                  Day notes (optional)
                </label>
                <input
                  type="text"
                  value={activeDay.notes}
                  onChange={(e) => updateDayNotes(activeDayIndex, e.target.value)}
                  placeholder="e.g. Focus on mind-muscle connection"
                  style={{ ...inputStyle(), width: '100%', fontSize: '0.875rem' }}
                />
              </div>
            </div>
          )}

          {/* Exercises header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Exercises — {activeDay?.label || `Day ${activeDayIndex + 1}`}
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
                  className="te-exercise-card"
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

                  <div className="te-exercise-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Drag handle + reorder */}
                    <div className="te-exercise-reorder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 6, flexShrink: 0 }}>
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
                        className="te-exercise-top-row"
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
                          <ExerciseCombobox
                            value={ex.exerciseId}
                            onChange={(id) => setExerciseSelection(ex.tempId, id)}
                            exercises={exerciseList}
                          />
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
                          <RestSecondsInput
                            value={ex.restSeconds}
                            onChange={(v) => updateExercise(ex.tempId, { restSeconds: v })}
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
                      <div className="te-sets-scroll">
                        <div
                          className="te-set-row"
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
                              className="te-set-row"
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
                                type="text"
                                inputMode="numeric"
                                value={s.targetReps}
                                onChange={(e) =>
                                  updateSet(ex.tempId, s.tempId, {
                                    targetReps: normalizeIntegerInput(e.target.value),
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

        {/* Right: sidebar — stats for active day (hidden on mobile) */}
        <div
          className="coach-editor-right no-scrollbar"
          style={{
            flex: '1 1 0',
            minWidth: 0,
            borderLeft: '1px solid var(--color-border)',
            padding: '24px 28px',
            overflowY: 'auto',
            backgroundColor: 'var(--color-surface-1)',
          }}
        >
          {/* Day indicator */}
          <p style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-hint)', marginBottom: 16 }}>
            {activeDay?.label || `Day ${activeDayIndex + 1}`} · {days.length} {days.length === 1 ? 'day' : 'days'} total
          </p>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
            <div
              style={{
                flex: 1,
                padding: '14px 16px',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <p style={{ fontSize: '0.63rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Exercises
              </p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                {exercises.length}
              </p>
            </div>
            <div
              style={{
                flex: 1,
                padding: '14px 16px',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <p style={{ fontSize: '0.63rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Total Sets
              </p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                {totalSets}
              </p>
            </div>
          </div>

          {/* Volume distribution */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <BarChart2 size={13} style={{ color: 'var(--color-text-hint)' }} />
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {volumeDistribution.map(({ group, pct }) => {
                  const color = MUSCLE_GROUP_COLORS[group] ?? '#6b7280'
                  return (
                    <div key={group}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              backgroundColor: color,
                              flexShrink: 0,
                              display: 'inline-block',
                            }}
                          />
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                            {muscleGroupLabel(group)}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', fontWeight: 500 }}>
                          {pct}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: 10,
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
                            transition: 'width 0.35s ease',
                            opacity: 0.9,
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
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-text-hint)',
                  }}
                >
                  Exercise List
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {exercises.map((ex, i) => (
                  <div
                    key={ex.tempId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      backgroundColor: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: 'var(--color-text-hint)',
                        width: 16,
                        flexShrink: 0,
                        textAlign: 'center',
                      }}
                    >
                      {i + 1}
                    </span>
                    {ex.muscleGroup && (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          backgroundColor: MUSCLE_GROUP_COLORS[ex.muscleGroup.toLowerCase()] ?? '#6b7280',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: '0.8rem',
                          color: ex.exerciseName ? 'var(--color-text-primary)' : 'var(--color-text-hint)',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ex.exerciseName || 'Unselected'}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', marginTop: 1 }}>
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
      setSaving(false)
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

function RestSecondsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [display, setDisplay] = useState(String(value))
  useEffect(() => { setDisplay(String(value)) }, [value])
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => setDisplay(normalizeIntegerInput(e.target.value))}
      onBlur={() => {
        const parsed = parseInt(display, 10)
        const num = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
        setDisplay(String(num))
        onChange(num)
      }}
      style={{ ...inputStyle(), width: '100%', fontSize: '0.875rem' }}
    />
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
    background: 'none',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.3 : 0.6,
    color: 'var(--color-text-secondary)',
    padding: '2px 4px',
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
  }
}
