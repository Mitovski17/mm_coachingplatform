export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  getCheckinHistory,
  getClientAssignments,
  getClientProfile,
  getLatestDigest,
  getNutritionHistory,
  getNutritionSummary,
  getProgressPhotos,
  getWorkoutCompliance,
  getWorkoutHistory,
} from './actions'
import { computeRedFlags } from './utils'
import ClientDetailClient from './ClientDetailClient'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = await params

  const [
    profile,
    compliance,
    workoutHistory,
    nutritionSummary,
    nutritionHistory,
    checkins,
    assignments,
    initialDigest,
  ] = await Promise.all([
    getClientProfile(clientId),
    getWorkoutCompliance(clientId),
    getWorkoutHistory(clientId),
    getNutritionSummary(clientId),
    getNutritionHistory(clientId),
    getCheckinHistory(clientId),
    getClientAssignments(clientId),
    getLatestDigest(clientId),
  ])

  const photos = await getProgressPhotos(clientId)

  const hasMealPlan =
    !!assignments.trainingMealPlan || !!assignments.restMealPlan
  const redFlags = computeRedFlags({
    compliance,
    checkins,
    nutritionSummary,
    hasMealPlan,
  })

  return (
    <div className="px-6 py-6">
      <div className="mb-4">
        <Link
          href="/coach/dashboard"
          className="text-sm hover:underline"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← All Clients
        </Link>
      </div>

      <ClientDetailClient
        profile={profile}
        compliance={compliance}
        workoutHistory={workoutHistory}
        nutritionSummary={nutritionSummary}
        nutritionHistory={nutritionHistory}
        checkins={checkins}
        assignments={assignments}
        photos={photos}
        redFlags={redFlags}
        initialDigest={initialDigest}
      />
    </div>
  )
}
