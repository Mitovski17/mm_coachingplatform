'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { upsertClientMealPlanAssignment, upsertCarbCycleAssignment, type MealPlanTemplate, type ClientAssignments, type CarbCycleAssignment } from './actions'

export default function MealPlanAssignmentEditor({
  workspaceId,
  clients,
  templates,
  initialClientId,
  initialData,
  initialCarbCycle,
}: {
  workspaceId: string
  clients: Array<{ id: string; name: string; email: string }>
  templates: MealPlanTemplate[]
  initialClientId?: string
  initialData?: ClientAssignments
  initialCarbCycle?: CarbCycleAssignment | null
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clientId, setClientId] = useState(initialClientId ?? clients[0]?.id ?? '')
  const [trainingTemplateId, setTrainingTemplateId] = useState<string>(
    initialData?.training?.templateId ?? ''
  )
  const [restTemplateId, setRestTemplateId] = useState<string>(
    initialData?.rest?.templateId ?? ''
  )
  const [overallTemplateId, setOverallTemplateId] = useState<string>(
    initialData?.overall?.templateId ?? ''
  )

  // Carb cycle state
  const [carbCycleEnabled, setCarbCycleEnabled] = useState<boolean>(!!initialCarbCycle)
  const [carbCycleLowId, setCarbCycleLowId] = useState<string>(initialCarbCycle?.lowPlanId ?? '')
  const [carbCycleHighId, setCarbCycleHighId] = useState<string>(initialCarbCycle?.highPlanId ?? '')
  const [carbCycleStartDate, setCarbCycleStartDate] = useState<string>(
    initialCarbCycle?.cycleStartDate ?? new Date().toISOString().split('T')[0]
  )

  const savedStateRef = useRef<string | null>(null)
  if (savedStateRef.current === null) {
    savedStateRef.current = JSON.stringify({
      clientId: initialClientId ?? clients[0]?.id ?? '',
      trainingTemplateId: initialData?.training?.templateId ?? '',
      restTemplateId: initialData?.rest?.templateId ?? '',
      overallTemplateId: initialData?.overall?.templateId ?? '',
      carbCycleEnabled: !!initialCarbCycle,
      carbCycleLowId: initialCarbCycle?.lowPlanId ?? '',
      carbCycleHighId: initialCarbCycle?.highPlanId ?? '',
      carbCycleStartDate: initialCarbCycle?.cycleStartDate ?? new Date().toISOString().split('T')[0],
    })
  }

  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      clientId,
      trainingTemplateId,
      restTemplateId,
      overallTemplateId,
      carbCycleEnabled,
      carbCycleLowId,
      carbCycleHighId,
      carbCycleStartDate,
    })
  }, [clientId, trainingTemplateId, restTemplateId, overallTemplateId, carbCycleEnabled, carbCycleLowId, carbCycleHighId, carbCycleStartDate])

  const isDirty = useMemo(() => {
    return savedStateRef.current !== currentSnapshot
  }, [currentSnapshot])

  const trainingTemplates = templates.filter((t) => t.planType === 'training')
  const restTemplates = templates.filter((t) => t.planType === 'rest')
  const overallTemplates = templates.filter((t) => t.planType === 'overall')
  // Carb cycle can use any template regardless of plan_type
  const allTemplates = templates
  const lockedClient = !!initialClientId
  const clientName = clients.find((c) => c.id === clientId)?.name ?? ''

  const handleSave = async () => {
    setError(null)
    if (!clientId) {
      setError('Select a client')
      return
    }
    if (carbCycleEnabled && (!carbCycleLowId || !carbCycleHighId)) {
      setError('Select both a low carb and a high carb plan for the cycle')
      return
    }
    setSaving(true)
    try {
      await Promise.all([
        upsertClientMealPlanAssignment({
          workspaceId,
          clientId,
          trainingTemplateId: trainingTemplateId || null,
          restTemplateId: restTemplateId || null,
          overallTemplateId: overallTemplateId || null,
        }),
        upsertCarbCycleAssignment({
          workspaceId,
          clientId,
          lowPlanId: carbCycleEnabled ? carbCycleLowId || null : null,
          highPlanId: carbCycleEnabled ? carbCycleHighId || null : null,
          cycleStartDate: carbCycleStartDate,
          cycleLength: 4,
        }),
      ])
      savedStateRef.current = currentSnapshot
      setSaving(false)
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        router.push('/coach/meal-plans')
        router.refresh()
      }, 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-4xl">
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

      {/* Client selector */}
      <div className="mb-6">
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
              maxWidth: 360,
            }}
          >
            {clientName}
          </div>
        ) : (
          <select
            suppressHydrationWarning
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="px-3 py-2 text-sm"
            style={{ ...selectStyle(), maxWidth: 360, width: '100%' }}
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

      {/* Training + Rest side by side */}
      <div
        className="mb-4"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
          }}
        >
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Training Day Plan
          </label>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-hint)' }}>
            Shown on days when a workout is scheduled.
          </p>
          <select
            suppressHydrationWarning
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

        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
          }}
        >
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Rest Day Plan
          </label>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-hint)' }}>
            Shown on days with no scheduled workout.
          </p>
          <select
            suppressHydrationWarning
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

      {/* Overall plan — full width */}
      <div
        className="mb-6"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 18px',
        }}
      >
        <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
          Overall Plan
        </label>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-hint)' }}>
          Default fallback shown when no training or rest day plan is assigned for a given day.
        </p>
        <select
          suppressHydrationWarning
          value={overallTemplateId}
          onChange={(e) => setOverallTemplateId(e.target.value)}
          className="w-full px-3 py-2 text-sm"
          style={selectStyle()}
        >
          <option value="">None</option>
          {overallTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Carb Cycle Rotation */}
      <div
        className="mb-6"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: carbCycleEnabled ? '1px solid #f97316' : '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 18px',
          transition: 'border-color 0.2s',
        }}
      >
        {/* Header row with toggle */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <RefreshCw size={14} style={{ color: carbCycleEnabled ? '#f97316' : 'var(--color-text-hint)' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Carb Cycle Rotation
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCarbCycleEnabled((v) => !v)}
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              backgroundColor: carbCycleEnabled ? '#f97316' : 'var(--color-surface-3)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background-color 0.2s',
              flexShrink: 0,
            }}
            aria-label="Toggle carb cycle"
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: carbCycleEnabled ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          </button>
        </div>

        <p className="text-xs mb-3" style={{ color: 'var(--color-text-hint)' }}>
          Overrides training/rest plans with a 4-day repeating cycle: Low, Low, Low, High.
        </p>

        {carbCycleEnabled && (
          <div className="flex flex-col gap-3">
            {/* Low + High side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  Low Carb Plan
                </label>
                <select
                  suppressHydrationWarning
                  value={carbCycleLowId}
                  onChange={(e) => setCarbCycleLowId(e.target.value)}
                  className="w-full px-3 py-2 text-sm"
                  style={selectStyle()}
                >
                  <option value="">Select plan...</option>
                  {allTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  High Carb Plan
                </label>
                <select
                  suppressHydrationWarning
                  value={carbCycleHighId}
                  onChange={(e) => setCarbCycleHighId(e.target.value)}
                  className="w-full px-3 py-2 text-sm"
                  style={selectStyle()}
                >
                  <option value="">Select plan...</option>
                  {allTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Start date */}
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Cycle Start Date
              </label>
              <input
                type="date"
                value={carbCycleStartDate}
                onChange={(e) => setCarbCycleStartDate(e.target.value)}
                className="px-3 py-2 text-sm"
                style={{ ...selectStyle(), maxWidth: 200, width: '100%' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-hint)' }}>
                Day 1 of the cycle starts on this date. High carb = every 4th day.
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm mb-3" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving || saved || !isDirty}
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium"
          style={{
            backgroundColor: saved ? '#16a34a' : 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: saving || saved || !isDirty ? 'not-allowed' : 'pointer',
            opacity: saved ? 1 : (saving || !isDirty ? 0.5 : 1),
            transition: 'opacity 0.15s, background-color 0.2s',
          }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
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
