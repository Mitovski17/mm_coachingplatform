'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function createStripeCustomer(workspaceId: string, ownerEmail: string): Promise<{ ok: boolean; customerId?: string; error?: string }> {
  await requireAdmin()
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, error: 'Stripe not configured — add STRIPE_SECRET_KEY to .env.local' }
  }
  try {
    const customer = await getStripe().customers.create({
      email: ownerEmail,
      metadata: { workspace_id: workspaceId },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc() as any)
      .from('workspaces')
      .update({ stripe_customer_id: customer.id })
      .eq('id', workspaceId)
    revalidatePath('/admin/billing')
    return { ok: true, customerId: customer.id }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function cancelSubscription(subscriptionId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, error: 'Stripe not configured' }
  }
  try {
    await getStripe().subscriptions.cancel(subscriptionId)
    revalidatePath('/admin/billing')
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function setManualStatus(workspaceId: string, status: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc() as any)
    .from('workspaces')
    .update({ subscription_status: status })
    .eq('id', workspaceId)
  revalidatePath('/admin/billing')
  return { ok: !error }
}

export async function extendTrial(workspaceId: string, days: number): Promise<{ ok: boolean }> {
  await requireAdmin()
  const trialEndsAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc() as any)
    .from('workspaces')
    .update({ trial_ends_at: trialEndsAt, subscription_status: 'trial' })
    .eq('id', workspaceId)
  revalidatePath('/admin/billing')
  return { ok: !error }
}
