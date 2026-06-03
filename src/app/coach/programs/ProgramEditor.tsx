'use client'

import { useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import {
  upsertProgram,
  type Client,
  type Template,
  type ProgramWithDays,
} from './actions'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function ProgramEditor({
  workspaceId,
  clients,
  templates,
  initialData,
}: {
  workspaceId: string
  clients: Client[]
  templates: Template[]
  initialData?: ProgramWithDays
}) {
  const router = useRouter()

  const [name, setName] = useState(initialData?.name ?? '')
  const [clientId, setClientId] = useState(initialData?.clientId ?? '')
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true)
  const [scheduleType, setScheduleType] = useState<'weekly' | 'cyclic'>(
    initialData?.scheduleType ?? 'weekly'
  )
  const [cycleStartDate, setCycleStartDate] = useState<string>(
    initialData?.cycleStartDate ?? ''
  )

  // ── Weekly state ───────────────────────────────────────────────────────────
  // days[i] = the final templateDayId assigned to weekday i (null = rest)
  const [days, setDays] = useState<Record<number, string | null>>(() => {
    const map: Record<number, string | null> = {}
    for (let i = 0; i < 7; i++) {
      const found = initialData?.scheduleType !== 'cyclic'
        ? initialData?.days.find((d) => d.dayOfWeek === i)
        : undefined
      map[i] = found?.templateDayId ?? null
    }
    return map
  })
  // pendingTemplate[i] = templateId selected when template has multiple days but no day picked yet
  const [pendingTemplate, setPendingTemplate] = useState<Record<number, string>>({})

  // ── Cyclic state ───────────────────────────────────────────────────────────
  // cycleDays[position] = { templateDayId } — null templateDayId = rest day
  const [cycleDays, setCycleDays] = useState<Array<{ templateDayId: string | null }>>(() => {
    if (initialData?.scheduleType === 'cyclic' && initialData.days.length > 0) {
      return initialData.days
        .filter((d) => d.cyclePosition !== null)
        .sort((a, b) => (a.cyclePosition ?? 0) - (b.cyclePosition ?? 0))
        .map((d) => ({ templateDayId: d.templateDayId }))
    }
    return []
  })
  // cyclePendingTemplate[position] = templateId during 2-step selection
  const [cyclePendingTemplate, setCyclePendingTemplate] = useState<Record<number, string>>({})

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedStateRef = useRef<string | null>(null)
  if (savedStateRef.current === null) {
    savedStateRef.current = JSON.stringify({
      name: (initialData?.name ?? '').trim(),
      clientId: initialData?.clientId ?? '',
      isActive: initialData?.isActive ?? true,
      scheduleType: initialData?.scheduleType ?? 'weekly',
      cycleStartDate: initialData?.cycleStartDate ?? '',
      days: Array.from({ length: 7 }, (_, i) => {
        const found = initialData?.scheduleType !== 'cyclic'
          ? initialData?.days.find((d) => d.dayOfWeek === i)
          : undefined
        return found?.templateDayId ?? null
      }),
      cycleDays: initialData?.scheduleType === 'cyclic' && initialData.days.length > 0
        ? initialData.days
            .filter((d) => d.cyclePosition !== null)
            .sort((a, b) => (a.cyclePosition ?? 0) - (b.cyclePosition ?? 0))
            .map((d) => ({ templateDayId: d.templateDayId }))
        : []
    })
  }

  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      name: name.trim(),
      clientId,
      isActive,
      scheduleType,
      cycleStartDate: scheduleType === 'cyclic' ? cycleStartDate : '',
      days: Array.from({ length: 7 }, (_, i) => days[i] ?? null),
      cycleDays: scheduleType === 'cyclic' ? cycleDays.map(d => ({ templateDayId: d.templateDayId })) : []
    })
  }, [name, clientId, isActive, scheduleType, cycleStartDate, days, cycleDays])

  const isDirty = useMemo(() => {
    return savedStateRef.current !== currentSnapshot
  }, [currentSnapshot])

  // Build lookup maps
  const templateById = useMemo(() => {
    const m = new Map<string, Template>()
    for (const t of templates) m.set(t.id, t)
    return m
  }, [templates])

  const templateIdByDayId = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of templates) {
      for (const d of t.days) {
        m.set(d.id, t.id)
      }
    }
    return m
  }, [templates])

  const handleSave = async () => {
    setError(null)
    if (!name.trim()) { setError('Program name is required'); return }
    if (!clientId) { setError('Select a client'); return }

    if (scheduleType === 'cyclic') {
      if (!cycleStartDate) { setError('Set a cycle start date'); return }
      if (cycleDays.length === 0) { setError('Add at least one day to the cycle'); return }
      if (!cycleDays.some((d) => d.templateDayId !== null)) {
        setError('The cycle must have at least one training day')
        return
      }
    }

    setSaving(true)
    try {
      await upsertProgram({
        id: initialData?.id,
        workspaceId,
        clientId,
        name: name.trim(),
        isActive,
        scheduleType,
        cycleStartDate: scheduleType === 'cyclic' ? cycleStartDate : null,
        days: scheduleType === 'cyclic'
          ? cycleDays.map((d, i) => ({ cyclePosition: i, templateDayId: d.templateDayId }))
          : Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, templateDayId: days[i] ?? null })),
      })
      savedStateRef.current = currentSnapshot
      setSaving(false)
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        router.push('/coach/programs')
        router.refresh()
      }, 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save program')
      setSaving(false)
    }
  }

  // ── Cyclic day helpers ────────────────────────────────────────────────────
  const addCycleDay = (templateDayId: string | null) => {
    setCycleDays((prev) => [...prev, { templateDayId }])
  }

  const removeCycleDay = (index: number) => {
    setCycleDays((prev) => prev.filter((_, i) => i !== index))
    setCyclePendingTemplate((prev) => {
      const next: Record<number, string> = {}
      for (const [k, v] of Object.entries(prev)) {
        const ki = Number(k)
        if (ki < index) next[ki] = v
        else if (ki > index) next[ki - 1] = v
      }
      return next
    })
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-3xl pb-32">
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
          {initialData ? initialData.name : 'New Program'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {scheduleType === 'cyclic'
            ? 'Build a repeating cycle of workouts assigned to a client'
            : 'Assign a weekly schedule of workouts to a client'}
        </p>
      </div>

      {/* Program name */}
      <div className="mb-4">
        <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-hint)' }}>
          Program name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hypertrophy Block 1"
          className="w-full text-base"
          style={inputStyle()}
        />
      </div>

      {/* Client */}
      <div className="mb-4">
        <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-hint)' }}>
          Client
        </label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full text-sm"
          style={inputStyle()}
        >
          <option value="">— Select client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.email}
            </option>
          ))}
        </select>
      </div>

      {/* Active toggle */}
      <div className="mb-8 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          aria-pressed={isActive}
          className="relative"
          style={{
            width: 38,
            height: 22,
            borderRadius: 9999,
            backgroundColor: isActive ? 'var(--color-accent)' : 'var(--color-surface-3)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: isActive ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: '#fff',
              transition: 'left 0.15s ease',
              display: 'block',
            }}
          />
        </button>
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Program is active
        </span>
      </div>

      {/* Schedule type toggle */}
      <div className="mb-4">
        <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-hint)' }}>
          Schedule type
        </label>
        <div
          className="inline-flex gap-1 p-1"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {(['weekly', 'cyclic'] as const).map((type) => {
            const active = scheduleType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setScheduleType(type)}
                className="px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                  color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {type === 'weekly' ? 'Weekly' : 'Cyclic'}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Weekly schedule ─────────────────────────────────────────────────── */}
      {scheduleType === 'weekly' && (
        <>
          <h2 className="text-base mb-3" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
            Weekly Schedule
          </h2>
          <div
            className="flex flex-col"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            {DAY_NAMES.map((label, i) => {
              const assignedDayId = days[i] ?? null
              const resolvedTemplateId =
                (assignedDayId ? templateIdByDayId.get(assignedDayId) : null) ??
                pendingTemplate[i] ??
                ''
              const resolvedTemplate = resolvedTemplateId ? templateById.get(resolvedTemplateId) : null

              return (
                <div
                  key={i}
                  style={{
                    borderBottom: i < DAY_NAMES.length - 1 ? '1px solid var(--color-border)' : 'none',
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                  }}
                >
                  <div style={{ width: 110, flexShrink: 0, paddingTop: 9 }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {label}
                    </p>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Step 1: pick template */}
                    <select
                      value={resolvedTemplateId}
                      onChange={(e) => {
                        const tplId = e.target.value
                        if (!tplId) {
                          setDays((prev) => ({ ...prev, [i]: null }))
                          setPendingTemplate((prev) => {
                            const next = { ...prev }
                            delete next[i]
                            return next
                          })
                          return
                        }
                        const tpl = templateById.get(tplId)
                        if (!tpl) return
                        if (tpl.days.length === 1) {
                          setDays((prev) => ({ ...prev, [i]: tpl.days[0].id }))
                          setPendingTemplate((prev) => {
                            const next = { ...prev }
                            delete next[i]
                            return next
                          })
                        } else {
                          setDays((prev) => ({ ...prev, [i]: null }))
                          setPendingTemplate((prev) => ({ ...prev, [i]: tplId }))
                        }
                      }}
                      className="w-full text-sm"
                      style={inputStyle()}
                    >
                      <option value="">— Rest Day —</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.days.length > 1 ? ` (${t.days.length} days)` : ''}
                        </option>
                      ))}
                    </select>

                    {/* Step 2: pick specific day (only for multi-day templates) */}
                    {resolvedTemplate && resolvedTemplate.days.length > 1 && (
                      <select
                        value={assignedDayId ?? ''}
                        onChange={(e) => {
                          const dayId = e.target.value || null
                          setDays((prev) => ({ ...prev, [i]: dayId }))
                        }}
                        className="w-full text-sm"
                        style={{ ...inputStyle(), borderColor: 'var(--color-accent)' }}
                      >
                        <option value="">— Pick a workout day —</option>
                        {resolvedTemplate.days.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label} · {d.exerciseCount} {d.exerciseCount === 1 ? 'exercise' : 'exercises'}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Summary line */}
                    {assignedDayId && resolvedTemplate && (() => {
                      const day = resolvedTemplate.days.find((d) => d.id === assignedDayId)
                      if (!day) return null
                      return (
                        <p className="text-xs" style={{ color: 'var(--color-text-hint)' }}>
                          {day.exerciseCount} {day.exerciseCount === 1 ? 'exercise' : 'exercises'}
                        </p>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Cyclic schedule ─────────────────────────────────────────────────── */}
      {scheduleType === 'cyclic' && (
        <>
          <h2 className="text-base mb-3" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
            Cyclic Schedule
          </h2>

          {/* Cycle start date */}
          <div className="mb-4">
            <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-hint)' }}>
              Cycle start date
            </label>
            <input
              type="date"
              value={cycleStartDate}
              onChange={(e) => setCycleStartDate(e.target.value)}
              className="w-full text-sm"
              style={inputStyle()}
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-hint)' }}>
              Day 1 of the cycle falls on this date. The cycle repeats from there, ignoring the day of the week.
            </p>
          </div>

          {/* Cycle day list */}
          {cycleDays.length > 0 && (
            <div
              className="flex flex-col mb-3"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            >
              {cycleDays.map((cycleDay, position) => {
                const assignedDayId = cycleDay.templateDayId
                const resolvedTemplateId =
                  (assignedDayId ? templateIdByDayId.get(assignedDayId) : null) ??
                  cyclePendingTemplate[position] ??
                  ''
                const resolvedTemplate = resolvedTemplateId ? templateById.get(resolvedTemplateId) : null

                return (
                  <div
                    key={position}
                    style={{
                      borderBottom: position < cycleDays.length - 1 ? '1px solid var(--color-border)' : 'none',
                      padding: '12px 20px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 16,
                    }}
                  >
                    <div style={{ width: 60, flexShrink: 0, paddingTop: 9 }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        Day {position + 1}
                      </p>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Step 1: pick template */}
                      <select
                        value={resolvedTemplateId}
                        onChange={(e) => {
                          const tplId = e.target.value
                          if (!tplId) {
                            setCycleDays((prev) => prev.map((d, idx) => idx === position ? { templateDayId: null } : d))
                            setCyclePendingTemplate((prev) => {
                              const next = { ...prev }
                              delete next[position]
                              return next
                            })
                            return
                          }
                          const tpl = templateById.get(tplId)
                          if (!tpl) return
                          if (tpl.days.length === 1) {
                            setCycleDays((prev) => prev.map((d, idx) => idx === position ? { templateDayId: tpl.days[0].id } : d))
                            setCyclePendingTemplate((prev) => {
                              const next = { ...prev }
                              delete next[position]
                              return next
                            })
                          } else {
                            setCycleDays((prev) => prev.map((d, idx) => idx === position ? { templateDayId: null } : d))
                            setCyclePendingTemplate((prev) => ({ ...prev, [position]: tplId }))
                          }
                        }}
                        className="w-full text-sm"
                        style={inputStyle()}
                      >
                        <option value="">— Rest Day —</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}{t.days.length > 1 ? ` (${t.days.length} days)` : ''}
                          </option>
                        ))}
                      </select>

                      {/* Step 2: pick specific day (only for multi-day templates) */}
                      {resolvedTemplate && resolvedTemplate.days.length > 1 && (
                        <select
                          value={assignedDayId ?? ''}
                          onChange={(e) => {
                            const dayId = e.target.value || null
                            setCycleDays((prev) => prev.map((d, idx) => idx === position ? { templateDayId: dayId } : d))
                          }}
                          className="w-full text-sm"
                          style={{ ...inputStyle(), borderColor: 'var(--color-accent)' }}
                        >
                          <option value="">— Pick a workout day —</option>
                          {resolvedTemplate.days.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.label} · {d.exerciseCount} {d.exerciseCount === 1 ? 'exercise' : 'exercises'}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Summary line */}
                      {assignedDayId && resolvedTemplate && (() => {
                        const day = resolvedTemplate.days.find((d) => d.id === assignedDayId)
                        if (!day) return null
                        return (
                          <p className="text-xs" style={{ color: 'var(--color-text-hint)' }}>
                            {day.exerciseCount} {day.exerciseCount === 1 ? 'exercise' : 'exercises'}
                          </p>
                        )
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCycleDay(position)}
                      title="Remove this day"
                      className="inline-flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 30,
                        height: 30,
                        marginTop: 6,
                        color: '#ef4444',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add day buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addCycleDay(null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              Add Training Day
            </button>
            <button
              type="button"
              onClick={() => addCycleDay(null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              Add Rest Day
            </button>
          </div>
        </>
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
        className="coach-sticky-bar fixed bottom-0 left-0 right-0 px-4 py-3 sm:px-6 flex items-center justify-end gap-3"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          borderTop: '1px solid var(--color-border)',
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
          disabled={saving || saved || !isDirty}
          className="px-4 py-2 text-sm font-medium"
          style={{
            backgroundColor: saved ? '#16a34a' : 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: saving || saved || !isDirty ? 'not-allowed' : 'pointer',
            opacity: saved ? 1 : (saving || !isDirty ? 0.5 : 1),
            transition: 'opacity 0.15s, background-color 0.2s',
          }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Program'}
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
