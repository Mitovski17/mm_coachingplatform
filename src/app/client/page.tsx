export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientId, getTodayTemplate } from './workouts/actions'
import { getDayLogs } from './nutrition/actions'
import { getHomeStats } from './home-actions'
import HomeView from './HomeView'

async function resolveData() {
  let email: string | null = null
  let avatarUrl: string | null = null

  const cs = await cookies()

  if (process.env.NODE_ENV === 'development') {
    const raw = cs.get('dev_mock_email')?.value
    if (raw) email = decodeURIComponent(raw)
  }

  if (!email) {
    try {
      const sb = await createClient()
      const { data: { user } } = await sb.auth.getUser()
      email = user?.email ?? null
      avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null
    } catch { return null }
  }

  if (!email) return null
  const client = await getClientId(email)
  if (!client) return null

  const isoToday = new Date().toISOString().slice(0, 10)
  const onboardingSkipped = cs.get('onboarding_skipped')?.value === '1'

  const [today, logs, stats] = await Promise.all([
    getTodayTemplate(client.id),
    getDayLogs(client.id, isoToday),
    getHomeStats(email, client.id),
  ])

  if (!stats.onboardingComplete && !onboardingSkipped) {
    redirect('/onboarding')
  }

  return { today, logs, stats, avatarUrl, onboardingComplete: stats.onboardingComplete }
}

export default async function ClientHomePage() {
  const data = await resolveData()
  return (
    <HomeView
      today={data?.today ?? null}
      logs={data?.logs ?? []}
      stats={data?.stats ?? null}
      avatarUrl={data?.avatarUrl ?? null}
      onboardingComplete={data?.onboardingComplete ?? true}
    />
  )
}
