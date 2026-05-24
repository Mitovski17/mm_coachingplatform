'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
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

  // days[i] = the final templateDayId assigned to day i (null = rest)
  const [days, setDays] = useState<Record<number, string | null>>(() => {
    const map: Record<number, string | null> = {}
    for (let i = 0; i < 7; i++) {
      const found = initialData?.days.find((d) => d.dayOfWeek === i)
      map[i] = found?.templateDayId ?? null
    }
    return map
  })

  // pendingTemplate[i] = templateId selected in step 1 when template has multiple days
  // (needed so the step-1 select stays populated while user hasn't picked a day yet)
  const [pendingTemplate, setPendingTemplate] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {}
    // Pre-populate from initialData if the day already has a templateDayId
    if (initialData) {
      for (const d of initialData.days) {
        if (d.templateDayId) {
          // We'll resolve this from the templates list below — handled in the render
        }
      }
    }
    return map
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!name.trim()) {
      setError('Program name is required')
      return
    }
    if (!clientId) {
      setError('Select a client')
      return
    }
    setSaving(true)
    try {
      await upsertProgram({
        id: initialData?.id,
        workspaceId,
        clientId,
        name: name.trim(),
        isActive,
        days: Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i,
          templateDayId: days[i] ?? null,
        })),
      })
      router.push('/coach/programs')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save program')
      setSaving(false)
    }
  }

  return (
    <div className="px-6 py-8 max-w-3xl pb-32">
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
          Assign a weekly schedule of workouts to a client
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

      {/* Weekly schedule */}
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
          // Resolve which template is "selected" for this row:
          // - if a day is assigned, derive from its template parent
          // - if a pending template is set (user picked template but no day yet), use that
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
                      // Clear everything for this day
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
                      // Auto-select the only day
                      setDays((prev) => ({ ...prev, [i]: tpl.days[0].id }))
                      setPendingTemplate((prev) => {
                        const next = { ...prev }
                        delete next[i]
                        return next
                      })
                    } else {
                      // Clear day assignment and set pending template
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
          {saving ? 'Saving…' : 'Save Program'}
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
