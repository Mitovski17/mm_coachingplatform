export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getClientId,
  getTodayTemplate,
  getWorkoutHistory,
} from './actions'
import WorkoutsClient from './WorkoutsClient'

async function resolveClient(): Promise<{ id: string; workspace_id: string }> {
  let email: string | null = null

  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const raw = cookieStore.get('dev_mock_email')?.value
    if (raw) email = decodeURIComponent(raw)
  }

  if (!email) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) redirect('/login')
    email = user.email
  }

  const client = await getClientId(email)
  if (!client) redirect('/login')
  return client
}

export default async function WorkoutsPage() {
  const client = await resolveClient()

  const [todayTemplate, history] = await Promise.all([
    getTodayTemplate(client.id),
    getWorkoutHistory(client.id),
  ])

  return <WorkoutsClient todayTemplate={todayTemplate} history={history} />
}
