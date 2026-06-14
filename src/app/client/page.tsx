export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientId, getTodayTemplate } from './workouts/actions'
import { getDayLogs, getActiveMealPlan, type FullMealPlan } from './nutrition/actions'
import { getHomeStats } from './home-actions'
import HomeView from './HomeView'

export type NutritionTargets = {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

function computeTargets(plan: FullMealPlan | null): NutritionTargets | null {
  if (!plan || plan.meals.length === 0) return null
  let calories = 0, proteinG = 0, carbsG = 0, fatG = 0
  for (const meal of plan.meals) {
    const firstOption = meal.options[0]
    if (!firstOption) continue
    for (const food of firstOption.foods) {
      calories += food.calories
      proteinG += food.proteinG
      carbsG += food.carbsG
      fatG += food.fatG
    }
  }
  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
  }
}

async function resolveData() {
  let email: string | null = null
  let avatarUrl: string | null = null

  if (process.env.NODE_ENV === 'development') {
    const { cookies } = await import('next/headers')
    const cs = await cookies()
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
  if (!client) {
    // Email authenticated but no matching client record - send to login rather than
    // onboarding, since this is almost always a stale/mismatched session, not a new user
    redirect('/login')
  }

  const isoToday = new Date().toISOString().slice(0, 10)

  const [today, logs, stats, mealPlanTraining, mealPlanRest, mealPlanOverall] = await Promise.all([
    getTodayTemplate(client.id),
    getDayLogs(client.id, isoToday),
    getHomeStats(email, client.id),
    getActiveMealPlan(client.id, 'training'),
    getActiveMealPlan(client.id, 'rest'),
    getActiveMealPlan(client.id, 'overall'),
  ])

  const planType = today ? 'training' : 'rest'
  const mealPlan = planType === 'training'
    ? (mealPlanTraining ?? mealPlanOverall)
    : (mealPlanRest ?? mealPlanOverall)
  const targets = computeTargets(mealPlan)

  return { today, logs, stats, avatarUrl, onboardingComplete: stats.onboardingComplete, targets }
}

export default async function ClientHomePage() {
  const data = await resolveData()
  return (
    <HomeView
      today={data?.today ?? null}
      logs={data?.logs ?? []}
      stats={data?.stats ?? null}
      avatarUrl={data?.avatarUrl ?? null}
      onboardingComplete={data?.onboardingComplete ?? false}
      targets={data?.targets ?? null}
    />
  )
}
