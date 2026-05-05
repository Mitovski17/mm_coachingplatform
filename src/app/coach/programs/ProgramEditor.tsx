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
  const [days, setDays] = useState<Record<number, string | null>>(() => {
    const map: Record<number, string | null> = {}
    for (let i = 0; i < 7; i++) {
      const found = initialData?.days.find((d) => d.dayOfWeek === i)
      map[i] = found?.templateId ?? null
    }
    return map
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const templateById = useMemo(() => {
    const m = new Map<string, Template>()
    for (const t of templates) m.set(t.id, t)
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
          templateId: days[i] ?? null,
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
          const selectedId = days[i] ?? ''
          const tpl = selectedId ? templateById.get(selectedId) : null
          return (
            <div
              key={i}
              className="flex items-center gap-4 px-5 py-3"
              style={{
                borderBottom: i < DAY_NAMES.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div style={{ width: 110, flexShrink: 0 }}>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {label}
                </p>
              </div>
              <div className="flex-1">
                <select
                  value={selectedId}
                  onChange={(e) =>
                    setDays((prev) => ({ ...prev, [i]: e.target.value || null }))
                  }
                  className="w-full text-sm"
                  style={inputStyle()}
                >
                  <option value="">— Rest Day —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {tpl && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-hint)' }}>
                    {tpl.exerciseCount} {tpl.exerciseCount === 1 ? 'exercise' : 'exercises'}
                  </p>
                )}
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
