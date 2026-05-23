import { createServiceClient } from '@/lib/supabase/service'
import { sendCheckinReminderEmail } from '@/lib/email'
import { getSundayStart } from '@/lib/checkin-window'

const VALID_HOURS = [12, 18, 24, 36] as const

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const hoursParam = Number(searchParams.get('hours'))
  if (!VALID_HOURS.includes(hoursParam as (typeof VALID_HOURS)[number])) {
    return Response.json({ error: 'Invalid hours param. Must be 12, 18, 24, or 36.' }, { status: 400 })
  }
  const hours = hoursParam as (typeof VALID_HOURS)[number]

  const supabase = createServiceClient()
  const weekStart = getSundayStart()

  // Find clients who have NOT submitted a check-in this week
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, email, full_name')
    .not('email', 'is', null)

  if (error) {
    return Response.json({ error: `Failed to fetch clients: ${error.message}` }, { status: 500 })
  }

  if (!clients?.length) {
    return Response.json({ sent: 0, skipped: 0 })
  }

  // Get IDs of clients who already submitted this week
  const { data: submitted } = await supabase
    .from('checkins')
    .select('client_id')
    .eq('week_start_date', weekStart)

  const submittedIds = new Set((submitted ?? []).map((r) => r.client_id))

  let sent = 0
  let skipped = 0
  const errors: { client_id: string; error: string }[] = []

  for (const client of clients) {
    if (submittedIds.has(client.id)) {
      skipped++
      continue
    }

    const result = await sendCheckinReminderEmail({
      to: client.email,
      clientName: client.full_name ?? 'there',
      hoursLate: hours,
    })

    if (result.error) {
      errors.push({ client_id: client.id, error: result.error.message })
    } else {
      sent++
    }
  }

  return Response.json({ sent, skipped, errors, week_start: weekStart })
}
