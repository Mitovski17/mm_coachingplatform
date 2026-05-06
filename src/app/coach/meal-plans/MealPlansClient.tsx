'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, UtensilsCrossed, Users } from 'lucide-react'
import {
  deleteMealPlanTemplate,
  type MealPlanTemplate,
  type Assignment,
  type PlanType,
} from './actions'

export default function MealPlansClient({
  templates,
  assignments,
}: {
  templates: MealPlanTemplate[]
  assignments: Assignment[]
}) {
  const [tab, setTab] = useState<'templates' | 'assignments'>('templates')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteMealPlanTemplate(id)
      router.refresh()
    })
  }

  const byClient = useMemo(() => {
    const m = new Map<string, { clientId: string; clientName: string; training: Assignment | null; rest: Assignment | null }>()
    for (const a of assignments) {
      const cur = m.get(a.clientId) ?? {
        clientId: a.clientId,
        clientName: a.clientName,
        training: null,
        rest: null,
      }
      if (a.isActive) {
        if (a.planType === 'training') cur.training = a
        else cur.rest = a
      }
      m.set(a.clientId, cur)
    }
    return Array.from(m.values())
  }, [assignments])

  return (
    <div className="px-6 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          Meal Plans
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Build training and rest day templates and assign them to your clients
        </p>
      </div>

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
          ['assignments', 'Assignments', byClient.length],
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
        <TemplatesPanel templates={templates} onDelete={handleDelete} deleting={pending} />
      ) : (
        <AssignmentsPanel rows={byClient} />
      )}
    </div>
  )
}

function TemplatesPanel({
  templates,
  onDelete,
  deleting,
}: {
  templates: MealPlanTemplate[]
  onDelete: (id: string, name: string) => void
  deleting: boolean
}) {
  const training = templates.filter((t) => t.planType === 'training')
  const rest = templates.filter((t) => t.planType === 'rest')

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          Meal Plan Templates
        </h2>
        <Link
          href="/coach/meal-plans/templates/new"
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

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Training Day" planType="training" items={training} onDelete={onDelete} deleting={deleting} />
        <Section title="Rest Day" planType="rest" items={rest} onDelete={onDelete} deleting={deleting} />
      </div>
    </>
  )
}

function Section({
  title,
  planType,
  items,
  onDelete,
  deleting,
}: {
  title: string
  planType: PlanType
  items: MealPlanTemplate[]
  onDelete: (id: string, name: string) => void
  deleting: boolean
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm" style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          {title}
        </h3>
        <span style={{ color: 'var(--color-text-hint)', fontSize: 12 }}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-10 gap-2 text-sm"
          style={{
            color: 'var(--color-text-hint)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <UtensilsCrossed size={22} />
          <p>No {title.toLowerCase()} templates yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((t) => (
            <TemplateCard key={t.id} t={t} planType={planType} onDelete={onDelete} deleting={deleting} />
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateCard({
  t,
  planType,
  onDelete,
  deleting,
}: {
  t: MealPlanTemplate
  planType: PlanType
  onDelete: (id: string, name: string) => void
  deleting: boolean
}) {
  const isTraining = planType === 'training'
  return (
    <div
      className="px-5 py-4"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <span
          className="inline-flex items-center px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: isTraining ? 'rgba(59,130,246,0.14)' : 'rgba(34,197,94,0.14)',
            color: isTraining ? '#60a5fa' : '#4ade80',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {isTraining ? 'Training' : 'Rest'}
        </span>
        <div className="flex items-center gap-1">
          <Link
            href={`/coach/meal-plans/templates/${t.id}`}
            title="Edit"
            className="inline-flex items-center justify-center"
            style={{
              width: 30,
              height: 30,
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Pencil size={13} />
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={() => onDelete(t.id, t.name)}
            title="Delete"
            className="inline-flex items-center justify-center"
            style={{
              width: 30,
              height: 30,
              color: '#ef4444',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.5 : 1,
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        {t.name}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-hint)' }}>
        {t.mealCount} {t.mealCount === 1 ? 'meal' : 'meals'}
      </p>
      {t.notes && (
        <p className="text-xs mt-1.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
          {t.notes}
        </p>
      )}
    </div>
  )
}

function AssignmentsPanel({
  rows,
}: {
  rows: Array<{ clientId: string; clientName: string; training: Assignment | null; rest: Assignment | null }>
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          Client Assignments
        </h2>
        <Link
          href="/coach/meal-plans/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
          }}
        >
          <Plus size={14} />
          Assign Plan
        </Link>
      </div>

      {rows.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 gap-3 text-sm"
          style={{
            color: 'var(--color-text-hint)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <Users size={26} />
          <p>No assignments yet. Assign your first meal plan.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div
              key={r.clientId}
              className="flex items-start justify-between px-5 py-4"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {r.clientName}
                </p>
                <div className="flex flex-col gap-0.5 mt-1.5 text-xs">
                  <span>
                    <span style={{ color: 'var(--color-text-hint)' }}>Training: </span>
                    <span style={{ color: r.training ? 'var(--color-text-secondary)' : 'var(--color-text-hint)' }}>
                      {r.training?.templateName ?? 'None assigned'}
                    </span>
                  </span>
                  <span>
                    <span style={{ color: 'var(--color-text-hint)' }}>Rest day: </span>
                    <span style={{ color: r.rest ? 'var(--color-text-secondary)' : 'var(--color-text-hint)' }}>
                      {r.rest?.templateName ?? 'None assigned'}
                    </span>
                  </span>
                </div>
              </div>
              <Link
                href={`/coach/meal-plans/assignments/${r.clientId}`}
                title="Edit"
                className="inline-flex items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <Pencil size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
