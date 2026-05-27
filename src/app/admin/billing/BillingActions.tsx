'use client'

import { useState } from 'react'
import { createStripeCustomer, cancelSubscription, setManualStatus, extendTrial } from './actions'

type Workspace = {
  id: string
  name: string
  ownerEmail: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string
  trial_ends_at: string | null
}

const STATUS_OPTIONS = ['trial', 'active', 'past_due', 'canceled']
const STATUS_COLORS: Record<string, string> = {
  active: '#10b981', trial: '#f59e0b', past_due: '#ef4444', canceled: '#6b7280', incomplete: '#f59e0b',
}

function WorkspaceRow({ ws }: { ws: Workspace }) {
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function handleCreateCustomer() {
    setPending(true)
    const r = await createStripeCustomer(ws.id, ws.ownerEmail)
    setFeedback(r.ok ? `Customer created: ${r.customerId}` : `Error: ${r.error}`)
    setPending(false)
  }

  async function handleCancel() {
    if (!ws.stripe_subscription_id) return
    setPending(true)
    const r = await cancelSubscription(ws.stripe_subscription_id)
    setFeedback(r.ok ? 'Subscription canceled' : `Error: ${r.error}`)
    setPending(false)
  }

  async function handleStatusChange(status: string) {
    setPending(true)
    await setManualStatus(ws.id, status)
    setFeedback(`Status set to ${status}`)
    setPending(false)
  }

  async function handleExtendTrial(days: number) {
    setPending(true)
    await extendTrial(ws.id, days)
    setFeedback(`Trial extended by ${days} days`)
    setPending(false)
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{ws.name}</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '2px 0 0' }}>{ws.ownerEmail}</p>
        </div>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 600,
            backgroundColor: (STATUS_COLORS[ws.subscription_status] ?? '#999') + '22',
            color: STATUS_COLORS[ws.subscription_status] ?? '#999',
            textTransform: 'capitalize',
          }}
        >
          {ws.subscription_status}
        </span>
      </div>

      <div className="admin-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 12 }}>
        <div>
          <span style={{ color: 'var(--color-text-hint)' }}>Stripe Customer: </span>
          <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
            {ws.stripe_customer_id ?? 'None'}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-hint)' }}>Subscription ID: </span>
          <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
            {ws.stripe_subscription_id ?? 'None'}
          </span>
        </div>
        {ws.trial_ends_at && (
          <div>
            <span style={{ color: 'var(--color-text-hint)' }}>Trial ends: </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {new Date(ws.trial_ends_at).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {!ws.stripe_customer_id && (
          <button
            onClick={handleCreateCustomer}
            disabled={pending}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              cursor: pending ? 'not-allowed' : 'pointer', border: 'none',
              backgroundColor: '#7c3aed', color: '#fff', opacity: pending ? 0.6 : 1,
            }}
          >
            Create Stripe Customer
          </button>
        )}

        {ws.stripe_subscription_id && ws.subscription_status !== 'canceled' && (
          <button
            onClick={handleCancel}
            disabled={pending}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              cursor: pending ? 'not-allowed' : 'pointer', border: 'none',
              backgroundColor: '#ef4444', color: '#fff', opacity: pending ? 0.6 : 1,
            }}
          >
            Cancel Subscription
          </button>
        )}

        <button
          onClick={() => handleExtendTrial(30)}
          disabled={pending}
          style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            cursor: pending ? 'not-allowed' : 'pointer', border: '1px solid var(--color-border)',
            backgroundColor: 'transparent', color: 'var(--color-text-muted)', opacity: pending ? 0.6 : 1,
          }}
        >
          +30d Trial
        </button>

        <select
          onChange={(e) => e.target.value && handleStatusChange(e.target.value)}
          defaultValue=""
          disabled={pending}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          <option value="" disabled>Set status…</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>
          ))}
        </select>
      </div>

      {feedback && (
        <p style={{ fontSize: 12, color: '#7c3aed', margin: '10px 0 0' }}>{feedback}</p>
      )}
    </div>
  )
}

export default function BillingActions({ workspaces }: { workspaces: Workspace[] }) {
  return (
    <div>
      {workspaces.map((ws) => (
        <WorkspaceRow key={ws.id} ws={ws} />
      ))}
    </div>
  )
}
