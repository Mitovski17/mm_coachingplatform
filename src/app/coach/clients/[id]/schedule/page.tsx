export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getClientProfile } from '../actions'
import { getScheduleData } from './actions'
import ScheduleOverridesEditor from './ScheduleOverridesEditor'

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = await params

  const profile = await getClientProfile(clientId).catch(() => null)
  if (!profile) notFound()

  const { workoutOverrides, mealOverrides, templateDays, mealTemplates } =
    await getScheduleData(clientId, profile.workspaceId)

  return (
    <ScheduleOverridesEditor
      clientId={clientId}
      clientName={profile.name}
      workspaceId={profile.workspaceId}
      workoutOverrides={workoutOverrides}
      mealOverrides={mealOverrides}
      templateDays={templateDays}
      mealTemplates={mealTemplates}
    />
  )
}
