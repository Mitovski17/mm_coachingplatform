'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, LayoutList, Dumbbell, Copy } from 'lucide-react'
import { deleteTemplate, deleteProgram, duplicateTemplate, type Template, type Program } from './actions'
import { getProgramExport, getWorkoutTemplateExport } from '@/app/coach/export-actions'
import DownloadPdfButton from '@/components/coach/DownloadPdfButton'
import { downloadProgramPdf, downloadWorkoutTemplatePdf } from '@/lib/pdf/program'

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
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const handleDuplicateTemplate = (id: string) => {
    setDuplicatingId(id)
    startTransition(async () => {
      try {
        await duplicateTemplate(id)
        router.refresh()
      } finally {
        setDuplicatingId(null)
      }
    })
  }

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
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-5xl">
      {/* Page header */}
      <div className="cx-in mb-6 flex items-start justify-between">
        <div>
          <h1
            className="cx-display cx-display-lg text-2xl"
            style={{ color: 'var(--color-text-primary)', fontWeight: 800 }}
          >
            Programs
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Build reusable workout templates and assign weekly programs to clients
          </p>
        </div>
        <Link
          href="/coach/programs/exercises"
          className="cx-press text-sm"
          style={{ color: 'var(--color-text-muted)', textDecoration: 'none', marginTop: 4 }}
        >
          Exercise Library →
        </Link>
      </div>

      {/* Tabs */}
      <div className="cx-in mb-6" style={{ '--cx-i': 1 } as React.CSSProperties}>
        <div
          className="cx-seg cx-seg--fit"
          role="tablist"
          aria-label="Programs"
          style={{ '--cx-seg-n': 2, '--cx-seg-i': tab === 'templates' ? 0 : 1 } as React.CSSProperties}
        >
          <div className="cx-seg-thumb" aria-hidden="true" />
          {([
            ['templates', 'Templates', templates.length],
            ['programs', 'Client Programs', programs.length],
          ] as const).map(([t, label, count]) => {
            const active = tab === t
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t)}
                className="cx-seg-btn flex items-center justify-center gap-1.5 text-sm"
                style={{
                  padding: '8px 14px',
                  fontWeight: active ? 700 : 600,
                  color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                }}
              >
                {label}
                <span
                  className="cx-num inline-flex items-center justify-center text-xs px-1.5 py-0.5"
                  style={{
                    minWidth: 20,
                    backgroundColor: active ? 'var(--color-accent-dim)' : 'var(--color-surface-3)',
                    color: active ? 'var(--color-accent)' : 'var(--color-text-hint)',
                    borderRadius: '9999px',
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* `key` restarts the panel's entrance so switching tabs reads as the
          new panel arriving, not as rows silently swapping in place. */}
      <div key={tab} className="cx-in" style={{ '--cx-i': 2 } as React.CSSProperties}>
        {tab === 'templates' ? (
          <TemplatesPanel
            templates={templates}
            onDelete={handleDeleteTemplate}
            onDuplicate={handleDuplicateTemplate}
            deleting={pending}
            duplicatingId={duplicatingId}
          />
        ) : (
          <ProgramsPanel
            programs={programs}
            onDelete={handleDeleteProgram}
            deleting={pending}
          />
        )}
      </div>
    </div>
  )
}

function TemplatesPanel({
  templates,
  onDelete,
  onDuplicate,
  deleting,
  duplicatingId,
}: {
  templates: Template[]
  onDelete: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  deleting: boolean
  duplicatingId: string | null
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          Workout Templates
        </h2>
        <Link
          href="/coach/programs/templates/new"
          className="cx-cta inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--cx-r-sm)',
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
        <div className="cx-stagger flex flex-col gap-3">
          {templates.map((t) => (
            <div
              key={t.id}
              /* Elevation only, no hover tint: the card itself isn't clickable
                 — only the trailing icon buttons are — so a row-wide highlight
                 would promise a target that isn't there. */
              className="cx-card flex items-start justify-between px-5 py-4"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--cx-r-md)',
              }}
            >
              <div className="flex-1 min-w-0 mr-4">
                <p className="coach-card-name text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {t.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-hint)' }}>
                  {t.dayCount} {t.dayCount === 1 ? 'day' : 'days'}
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
                  className="cx-icon-btn inline-flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    color: 'var(--color-text-muted)',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--cx-r-xs)',
                    textDecoration: 'none',
                  }}
                >
                  <Pencil size={14} />
                </Link>
                <DownloadPdfButton
                  iconOnly
                  size="sm"
                  title="Download as PDF"
                  disabled={t.dayCount === 0}
                  onDownload={async () => {
                    const data = await getWorkoutTemplateExport(t.id)
                    await downloadWorkoutTemplatePdf(data)
                  }}
                />
                <button
                  type="button"
                  disabled={duplicatingId === t.id || deleting}
                  onClick={() => onDuplicate(t.id)}
                  title="Duplicate template"
                  className="cx-icon-btn inline-flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    color: 'var(--color-text-muted)',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--cx-r-xs)',
                    cursor: duplicatingId === t.id || deleting ? 'not-allowed' : 'pointer',
                    opacity: duplicatingId === t.id ? 0.5 : 1,
                  }}
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  disabled={deleting || duplicatingId === t.id}
                  onClick={() => onDelete(t.id, t.name)}
                  title="Delete template"
                  className="cx-icon-btn cx-icon-btn-danger inline-flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    color: '#ef4444',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--cx-r-xs)',
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
          className="cx-cta inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--cx-r-sm)',
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
        <div className="cx-stagger flex flex-col gap-3">
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
      className="cx-card px-5 py-4"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--cx-r-md)',
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
          <DownloadPdfButton
            iconOnly
            size="sm"
            title={`Download ${program.clientName}'s training plan as a PDF`}
            onDownload={async () => {
              const data = await getProgramExport(program.id)
              await downloadProgramPdf(data)
            }}
          />
          <Link
            href={`/coach/programs/${program.id}`}
            title="Edit program"
            className="cx-icon-btn inline-flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              color: 'var(--color-text-muted)',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--cx-r-xs)',
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
            className="cx-icon-btn cx-icon-btn-danger inline-flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              color: '#ef4444',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--cx-r-xs)',
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.5 : 1,
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {program.scheduleType === 'cyclic' ? (
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center px-2.5 py-1 text-xs font-medium"
            style={{
              backgroundColor: 'var(--color-surface-3)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Cyclic
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-hint)' }}>
            {program.dayCount} {program.dayCount === 1 ? 'day' : 'days'} per cycle
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((label, i) => {
            const day = program.days.find((d) => d.dayOfWeek === i)
            const templateName = day?.templateDayLabel ?? null
            return <DayPill key={i} day={label} templateName={templateName} />
          })}
        </div>
      )}
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
      className="cx-empty flex flex-col items-center justify-center py-16 gap-3 text-sm"
      style={{ color: 'var(--color-text-hint)' }}
    >
      <div style={{ color: 'var(--color-text-hint)' }}>{icon}</div>
      <p>{message}</p>
    </div>
  )
}
