import { unstable_cache } from 'next/cache'
import { getCurrentClient, getActiveMealPlan, getActiveCarbCyclePlan, getDateMealOverride, getDayLogs } from './actions'
import { getTodayTemplate } from '../workouts/actions'
import NutritionClient from './NutritionClient'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getCachedMealPlan = unstable_cache(
  getActiveMealPlan,
  ['meal-plan'],
  { revalidate: 60 }
)

export default async function ClientNutritionPage() {
  const client = await getCurrentClient()
  const today = todayISO()

  if (!client) {
    return (
      <NutritionClient
        initialClientId={null}
        initialWorkspaceId={null}
        initialMealPlanTraining={null}
        initialMealPlanRest={null}
        initialDayLogs={[]}
        initialPlanType="rest"
        initialDate={today}
      />
    )
  }

  const [mealPlanTraining, mealPlanRest, mealPlanOverall, carbCycleResult, todayLogs, todayTemplate, dateOverride] = await Promise.all([
    getCachedMealPlan(client.id, 'training'),
    getCachedMealPlan(client.id, 'rest'),
    getCachedMealPlan(client.id, 'overall'),
    getActiveCarbCyclePlan(client.id, today),
    getDayLogs(client.id, today),
    getTodayTemplate(client.id),
    getDateMealOverride(client.id, today),
  ])

  // Resolution priority: date override > carb cycle > training/rest plan > overall fallback
  const carbCyclePlan = carbCycleResult?.plan ?? null
  const effectiveTraining = dateOverride ?? carbCyclePlan ?? mealPlanTraining ?? mealPlanOverall
  const effectiveRest = dateOverride ?? carbCyclePlan ?? mealPlanRest ?? mealPlanOverall

  return (
    <NutritionClient
      initialClientId={client.id}
      initialWorkspaceId={client.workspaceId}
      initialMealPlanTraining={effectiveTraining}
      initialMealPlanRest={effectiveRest}
      initialDayLogs={todayLogs}
      initialPlanType={todayTemplate ? 'training' : 'rest'}
      initialDate={today}
    />
  )
}
