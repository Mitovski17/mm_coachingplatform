import Link from 'next/link'
import {
  getBodyMetrics,
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
    bodyMetrics,
  ] = await Promise.all([
    getClientProfile(clientId),
    getWorkoutCompliance(clientId),
    getWorkoutHistory(clientId),
    getNutritionSummary(clientId),
    getNutritionHistory(clientId),
    getCheckinHistory(clientId),
    getClientAssignments(clientId),
    getLatestDigest(clientId),
    getBodyMetrics(clientId),
  ])

  const photos = await getProgressPhotos(clientId, checkins)

  const hasMealPlan =
    !!assignments.trainingMealPlan || !!assignments.restMealPlan
  const redFlags = computeRedFlags({
    compliance,
    checkins,
    nutritionSummary,
    hasMealPlan,
  })

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6">
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
        bodyMetrics={bodyMetrics}
      />
    </div>
  )
}
