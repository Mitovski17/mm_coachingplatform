'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { upsertClientMealPlanAssignment, type MealPlanTemplate, type ClientAssignments } from './actions'

export default function MealPlanAssignmentEditor({
  workspaceId,
  clients,
  templates,
  initialClientId,
  initialData,
}: {
  workspaceId: string
  clients: Array<{ id: string; name: string; email: string }>
  templates: MealPlanTemplate[]
  initialClientId?: string
  initialData?: ClientAssignments
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [clientId, setClientId] = useState(initialClientId ?? clients[0]?.id ?? '')
  const [trainingTemplateId, setTrainingTemplateId] = useState<string>(
    initialData?.training?.templateId ?? ''
  )
  const [restTemplateId, setRestTemplateId] = useState<string>(
    initialData?.rest?.templateId ?? ''
  )

  const trainingTemplates = templates.filter((t) => t.planType === 'training')
  const restTemplates = templates.filter((t) => t.planType === 'rest')
  const lockedClient = !!initialClientId
  const clientName = clients.find((c) => c.id === clientId)?.name ?? ''

  const handleSave = () => {
    setError(null)
    if (!clientId) {
      setError('Select a client')
      return
    }
    startTransition(async () => {
      try {
        await upsertClientMealPlanAssignment({
          workspaceId,
          clientId,
          trainingTemplateId: trainingTemplateId || null,
          restTemplateId: restTemplateId || null,
        })
        router.push('/coach/meal-plans')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save')
      }
    })
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-2xl">
      <div className="mb-4">
        <Link
          href="/coach/meal-plans"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}
        >
          <ArrowLeft size={14} />
          Back to meal plans
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          {lockedClient ? `Assign meal plan: ${clientName}` : 'Assign meal plan'}
        </h1>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Client
          </label>
          {lockedClient ? (
            <div
              className="px-3 py-2 text-sm"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
              }}
            >
              {clientName}
            </div>
          ) : (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={selectStyle()}
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Training Day Plan
          </label>
          <select
            value={trainingTemplateId}
            onChange={(e) => setTrainingTemplateId(e.target.value)}
            className="w-full px-3 py-2 text-sm"
            style={selectStyle()}
          >
            <option value="">None</option>
            {trainingTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Rest Day Plan
          </label>
          <select
            value={restTemplateId}
            onChange={(e) => setRestTemplateId(e.target.value)}
            className="w-full px-3 py-2 text-sm"
            style={selectStyle()}
          >
            <option value="">None</option>
            {restTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm mb-3" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <Link
          href="/coach/meal-plans"
          className="px-4 py-2 text-sm"
          style={{
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
          }}
        >
          Cancel
        </Link>
      </div>
    </div>
  )
}

function selectStyle(): React.CSSProperties {
  return {
    backgroundColor: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
  }
}
