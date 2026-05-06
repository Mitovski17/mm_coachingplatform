export const dynamic = 'force-dynamic'

import { getCurrentClient, getActiveMealPlan, getDayLogs } from './actions'
import { getTodayTemplate } from '../workouts/actions'
import NutritionClient from './NutritionClient'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

  const [mealPlanTraining, mealPlanRest, todayLogs, todayTemplate] = await Promise.all([
    getActiveMealPlan(client.id, 'training'),
    getActiveMealPlan(client.id, 'rest'),
    getDayLogs(client.id, today),
    getTodayTemplate(client.id),
  ])

  return (
    <NutritionClient
      initialClientId={client.id}
      initialWorkspaceId={client.workspaceId}
      initialMealPlanTraining={mealPlanTraining}
      initialMealPlanRest={mealPlanRest}
      initialDayLogs={todayLogs}
      initialPlanType={todayTemplate ? 'training' : 'rest'}
      initialDate={today}
    />
  )
}
