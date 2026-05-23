import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import BillingActions from './BillingActions'

async function fetchWorkspaces() {
  const svc = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: workspaces } = await (svc as any)
    .from('workspaces')
    .select('id, name, owner_id, stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at')
    .order('created_at', { ascending: false })

  const { data: { users: authUsers } } = await svc.auth.admin.listUsers({ perPage: 1000 })

  return (workspaces ?? []).map((ws: {
    id: string; name: string; owner_id: string;
    stripe_customer_id: string | null; stripe_subscription_id: string | null;
    subscription_status: string; trial_ends_at: string | null
  }) => ({
    ...ws,
    ownerEmail: authUsers.find((u) => u.id === ws.owner_id)?.email ?? '—',
  }))
}

export default async function BillingPage() {
  const workspaces = await fetchWorkspaces()

  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Billing
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-hint)', marginTop: 4 }}>
          Manage Stripe subscriptions per workspace
        </p>
      </div>

      {!stripeConfigured && (
        <div
          style={{
            backgroundColor: '#f59e0b18',
            border: '1px solid #f59e0b44',
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: 24,
            fontSize: 13,
            color: '#92400e',
          }}
        >
          <strong>Stripe not configured.</strong> Add <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code>, and <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to <code>.env.local</code> to enable billing features.
        </div>
      )}

      <BillingActions workspaces={workspaces} />
    </div>
  )
}
