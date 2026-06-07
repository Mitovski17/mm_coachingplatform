'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trash2, Plus } from 'lucide-react'
import {
  upsertWorkoutOverride,
  upsertMealOverride,
  deleteWorkoutOverride,
  deleteMealOverride,
  type WorkoutOverride,
  type MealOverride,
  type TemplateDayOption,
  type MealTemplateOption,
} from './actions'

function eachDateInRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (cur <= last) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function selectStyle(): React.CSSProperties {
  return {
    backgroundColor: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
  }
}

function inputStyle(): React.CSSProperties {
  return {
    backgroundColor: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    padding: '8px 10px',
    fontSize: 13,
    width: '100%',
  }
}

// ─── Workout override section ─────────────────────────────────────────────────

function WorkoutOverrideSection({
  clientId,
  workspaceId,
  templateDays,
  initial,
}: {
  clientId: string
  workspaceId: string
  templateDays: TemplateDayOption[]
  initial: WorkoutOverride[]
}) {
  const [overrides, setOverrides] = useState<WorkoutOverride[]>(initial)
  const [templateDayId, setTemplateDayId] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Group template days by template name for the dropdown
  const grouped = templateDays.reduce<Record<string, TemplateDayOption[]>>((acc, d) => {
    if (!acc[d.templateName]) acc[d.templateName] = []
    acc[d.templateName].push(d)
    return acc
  }, {})

  const handleAdd = () => {
    if (!startDate) { setError('Select a start date'); return }
    const end = endDate || startDate
    if (end < startDate) { setError('End date must be on or after start date'); return }
    setError(null)

    const dates = eachDateInRange(startDate, end)
    startTransition(async () => {
      try {
        await upsertWorkoutOverride({
          workspaceId,
          clientId,
          templateDayId: templateDayId || null,
          dates,
        })
        // Optimistic update
        const dayOption = templateDays.find((d) => d.id === templateDayId) ?? null
        setOverrides((prev) => {
          const next = prev.filter((o) => !dates.includes(o.assignedDate))
          for (const date of dates) {
            next.push({
              id: `pending-${date}`,
              assignedDate: date,
              templateDayId: templateDayId || null,
              templateDayLabel: dayOption?.label ?? null,
              templateName: dayOption?.templateName ?? null,
            })
          }
          return next.sort((a, b) => a.assignedDate.localeCompare(b.assignedDate))
        })
        setStartDate('')
        setEndDate('')
        setTemplateDayId('')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save')
      }
    })
  }

  const handleDelete = (override: WorkoutOverride) => {
    startTransition(async () => {
      try {
        await deleteWorkoutOverride(override.id, clientId)
        setOverrides((prev) => prev.filter((o) => o.id !== override.id))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete')
      }
    })
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '18px 20px',
        marginBottom: 20,
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 16 }}>
        Workout overrides
      </h2>

      {/* Add form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Workout template day
          </label>
          <select value={templateDayId} onChange={(e) => setTemplateDayId(e.target.value)} style={selectStyle()}>
            <option value="">— Rest day —</option>
            {Object.entries(grouped).map(([tplName, days]) => (
              <optgroup key={tplName} label={tplName}>
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Start date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle()}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            End date <span style={{ color: 'var(--color-text-hint)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle()}
          />
        </div>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{error}</p>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={handleAdd}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          fontSize: 13,
          fontWeight: 600,
          backgroundColor: 'var(--color-accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.5 : 1,
          marginBottom: 20,
        }}
      >
        <Plus size={14} />
        Assign
      </button>

      {/* Existing overrides */}
      {overrides.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)' }}>No workout overrides set.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {overrides.map((o) => (
            <div
              key={o.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 72 }}>
                  {formatDate(o.assignedDate)}
                </span>
                {o.templateDayId ? (
                  <span style={{ color: 'var(--color-text-primary)' }}>
                    {o.templateName && (
                      <span style={{ color: 'var(--color-text-hint)', marginRight: 4 }}>{o.templateName} —</span>
                    )}
                    {o.templateDayLabel}
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-text-hint)', fontStyle: 'italic' }}>Rest day</span>
                )}
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDelete(o)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-hint)',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Meal override section ────────────────────────────────────────────────────

function MealOverrideSection({
  clientId,
  workspaceId,
  mealTemplates,
  initial,
}: {
  clientId: string
  workspaceId: string
  mealTemplates: MealTemplateOption[]
  initial: MealOverride[]
}) {
  const [overrides, setOverrides] = useState<MealOverride[]>(initial)
  const [templateId, setTemplateId] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAdd = () => {
    if (!templateId) { setError('Select a meal plan'); return }
    if (!startDate) { setError('Select a start date'); return }
    const end = endDate || startDate
    if (end < startDate) { setError('End date must be on or after start date'); return }
    setError(null)

    const dates = eachDateInRange(startDate, end)
    const selected = mealTemplates.find((t) => t.id === templateId) ?? null
    startTransition(async () => {
      try {
        await upsertMealOverride({ workspaceId, clientId, templateId, dates })
        setOverrides((prev) => {
          const next = prev.filter((o) => !dates.includes(o.assignedDate))
          for (const date of dates) {
            next.push({
              id: `pending-${date}`,
              assignedDate: date,
              templateId,
              templateName: selected?.name ?? null,
            })
          }
          return next.sort((a, b) => a.assignedDate.localeCompare(b.assignedDate))
        })
        setStartDate('')
        setEndDate('')
        setTemplateId('')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save')
      }
    })
  }

  const handleDelete = (override: MealOverride) => {
    startTransition(async () => {
      try {
        await deleteMealOverride(override.id, clientId)
        setOverrides((prev) => prev.filter((o) => o.id !== override.id))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete')
      }
    })
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '18px 20px',
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 16 }}>
        Meal plan overrides
      </h2>

      {/* Add form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Meal plan template
          </label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={selectStyle()}>
            <option value="">Select template…</option>
            {mealTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Start date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle()}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            End date <span style={{ color: 'var(--color-text-hint)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle()}
          />
        </div>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{error}</p>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={handleAdd}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          fontSize: 13,
          fontWeight: 600,
          backgroundColor: 'var(--color-accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.5 : 1,
          marginBottom: 20,
        }}
      >
        <Plus size={14} />
        Assign
      </button>

      {/* Existing overrides */}
      {overrides.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)' }}>No meal plan overrides set.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {overrides.map((o) => (
            <div
              key={o.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 72 }}>
                  {formatDate(o.assignedDate)}
                </span>
                <span style={{ color: 'var(--color-text-primary)' }}>
                  {o.templateName ?? <em style={{ color: 'var(--color-text-hint)' }}>Deleted template</em>}
                </span>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDelete(o)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-hint)',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function ScheduleOverridesEditor({
  clientId,
  clientName,
  workspaceId,
  workoutOverrides,
  mealOverrides,
  templateDays,
  mealTemplates,
}: {
  clientId: string
  clientName: string
  workspaceId: string
  workoutOverrides: WorkoutOverride[]
  mealOverrides: MealOverride[]
  templateDays: TemplateDayOption[]
  mealTemplates: MealTemplateOption[]
}) {
  return (
    <div style={{ padding: '24px 20px', maxWidth: 760 }}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href={`/coach/clients/${clientId}`}
          style={{ fontSize: 12, color: 'var(--color-text-hint)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <ArrowLeft size={13} />
          {clientName}
        </Link>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, marginBottom: 4 }}>
          Date overrides
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
          Assign a specific workout or meal plan for exact dates, overriding the regular program schedule.
        </p>
      </div>

      <WorkoutOverrideSection
        clientId={clientId}
        workspaceId={workspaceId}
        templateDays={templateDays}
        initial={workoutOverrides}
      />

      <MealOverrideSection
        clientId={clientId}
        workspaceId={workspaceId}
        mealTemplates={mealTemplates}
        initial={mealOverrides}
      />
    </div>
  )
}
