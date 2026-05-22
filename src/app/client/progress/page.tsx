export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getClientId } from '../workouts/actions'
import { getProgressData } from './progress-actions'
import ProgressClient from './ProgressClient'

async function resolveProgressData() {
  let email: string | null = null

  if (process.env.NODE_ENV === 'development') {
    const cs = await cookies()
    const raw = cs.get('dev_mock_email')?.value
    if (raw) email = decodeURIComponent(raw)
  }

  if (!email) {
    try {
      const sb = await createClient()
      const {
        data: { user },
      } = await sb.auth.getUser()
      email = user?.email ?? null
    } catch {
      return null
    }
  }

  if (!email) return null
  const client = await getClientId(email)
  if (!client) return null

  return getProgressData(client.id)
}

export default async function ProgressPage() {
  const data = await resolveProgressData()

  if (!data) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 20px 24px' }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            margin: '0 0 8px',
          }}
        >
          Progress
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-hint)' }}>
          Unable to load your progress data. Please try again.
        </p>
      </div>
    )
  }

  return <ProgressClient data={data} />
}
