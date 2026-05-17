'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, LayoutList, Dumbbell } from 'lucide-react'
import { deleteTemplate, deleteProgram, type Template, type Program } from './actions'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ProgramsClient({
  templates,
  programs,
}: {
  templates: Template[]
  programs: Program[]
}) {
  const [tab, setTab] = useState<'templates' | 'programs'>('templates')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleDeleteTemplate = (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteTemplate(id)
      router.refresh()
    })
  }

  const handleDeleteProgram = (id: string, name: string) => {
    if (!confirm(`Delete program "${name}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteProgram(id)
      router.refresh()
    })
  }

  return (
    <div className="px-6 py-8 max-w-5xl">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1
            className="text-2xl"
            style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
          >
            Programs
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Build reusable workout templates and assign weekly programs to clients
          </p>
        </div>
        <Link
          href="/coach/programs/exercises"
          className="text-sm"
          style={{ color: 'var(--color-text-muted)', textDecoration: 'none', marginTop: 4 }}
        >
          Exercise Library →
        </Link>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 p-1"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          display: 'inline-flex',
        }}
      >
        {([
          ['templates', 'Templates', templates.length],
          ['programs', 'Client Programs', programs.length],
        ] as const).map(([t, label, count]) => {
          const active = tab === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {label}
              <span
                className="inline-flex items-center justify-center text-xs px-1.5 py-0.5"
                style={{
                  minWidth: 20,
                  backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'var(--color-surface-3)',
                  color: 'var(--color-text-hint)',
                  borderRadius: '9999px',
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {tab === 'templates' ? (
        <TemplatesPanel
          templates={templates}
          onDelete={handleDeleteTemplate}
          deleting={pending}
        />
      ) : (
        <ProgramsPanel
          programs={programs}
          onDelete={handleDeleteProgram}
          deleting={pending}
        />
      )}
    </div>
  )
}

function TemplatesPanel({
  templates,
  onDelete,
  deleting,
}: {
  templates: Template[]
  onDelete: (id: string, name: string) => void
  deleting: boolean
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          Workout Templates
        </h2>
        <Link
          href="/coach/programs/templates/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
          }}
        >
          <Plus size={14} />
          New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={<Dumbbell size={28} />}
          message="No templates yet. Create your first workout template."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between px-5 py-4"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {t.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-hint)' }}>
                  {t.exerciseCount} {t.exerciseCount === 1 ? 'exercise' : 'exercises'}
                </p>
                {t.notes && (
                  <p
                    className="text-xs mt-1.5 truncate"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {t.notes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href={`/coach/programs/templates/${t.id}`}
                  title="Edit template"
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    color: 'var(--color-text-muted)',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none',
                  }}
                >
                  <Pencil size={14} />
                </Link>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => onDelete(t.id, t.name)}
                  title="Delete template"
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    color: '#ef4444',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    opacity: deleting ? 0.5 : 1,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function ProgramsPanel({
  programs,
  onDelete,
  deleting,
}: {
  programs: Program[]
  onDelete: (id: string, name: string) => void
  deleting: boolean
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          Client Programs
        </h2>
        <Link
          href="/coach/programs/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
          }}
        >
          <Plus size={14} />
          New Program
        </Link>
      </div>

      {programs.length === 0 ? (
        <EmptyState
          icon={<LayoutList size={28} />}
          message="No programs yet. Assign your first weekly program to a client."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {programs.map((p) => (
            <ProgramCard key={p.id} program={p} onDelete={onDelete} deleting={deleting} />
          ))}
        </div>
      )}
    </>
  )
}

function ProgramCard({
  program,
  onDelete,
  deleting,
}: {
  program: Program
  onDelete: (id: string, name: string) => void
  deleting: boolean
}) {
  return (
    <div
      className="px-5 py-4"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {program.name}
            </p>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: program.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                color: program.isActive ? '#22c55e' : 'var(--color-text-hint)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: program.isActive ? '#22c55e' : 'var(--color-text-hint)',
                  display: 'block',
                }}
              />
              {program.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {program.clientName}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/coach/programs/${program.id}`}
            title="Edit program"
            className="inline-flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              color: 'var(--color-text-muted)',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
            }}
          >
            <Pencil size={14} />
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={() => onDelete(program.id, program.name)}
            title="Delete program"
            className="inline-flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              color: '#ef4444',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.5 : 1,
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DAY_LABELS.map((label, i) => {
          const day = program.days.find((d) => d.dayOfWeek === i)
          const templateName = day?.templateName ?? null
          return <DayPill key={i} day={label} templateName={templateName} />
        })}
      </div>
    </div>
  )
}

function DayPill({ day, templateName }: { day: string; templateName: string | null }) {
  const isRest = templateName === null
  return (
    <span
      className="inline-flex flex-col items-start px-2.5 py-1 text-xs"
      style={{
        backgroundColor: isRest ? 'transparent' : 'var(--color-surface-3)',
        color: isRest ? 'var(--color-text-hint)' : 'var(--color-text-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        fontWeight: 500,
        minWidth: 56,
      }}
    >
      <span style={{ color: 'var(--color-text-hint)', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>
        {day.toUpperCase()}
      </span>
      <span className="truncate" style={{ maxWidth: 90 }}>
        {isRest ? 'Rest' : templateName}
      </span>
    </span>
  )
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 gap-3 text-sm"
      style={{
        color: 'var(--color-text-hint)',
        border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div style={{ color: 'var(--color-text-hint)' }}>{icon}</div>
      <p>{message}</p>
    </div>
  )
}
