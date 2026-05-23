import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function updateWorkspaceSubscription(customerId: string, status: string, subscriptionId?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = svc() as any
  const update: Record<string, string> = { subscription_status: status }
  if (subscriptionId) update.stripe_subscription_id = subscriptionId
  await db
    .from('workspaces')
    .update(update)
    .eq('stripe_customer_id', customerId)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sig = request.headers.get('stripe-signature')
  const body = await request.text()

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const status = sub.status === 'active' ? 'active'
        : sub.status === 'past_due' ? 'past_due'
        : sub.status === 'canceled' ? 'canceled'
        : sub.status === 'incomplete' ? 'incomplete'
        : 'trial'
      await updateWorkspaceSubscription(sub.customer as string, status, sub.id)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await updateWorkspaceSubscription(sub.customer as string, 'canceled')
      break
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice
      if (inv.customer) {
        await updateWorkspaceSubscription(inv.customer as string, 'past_due')
      }
      break
    }
    case 'invoice.payment_succeeded': {
      const inv = event.data.object as Stripe.Invoice
      if (inv.customer) {
        await updateWorkspaceSubscription(inv.customer as string, 'active')
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
