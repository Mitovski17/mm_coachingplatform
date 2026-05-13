// Required env vars: CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
import { generateDigestForClient } from '@/lib/digest'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id')

  if (error) {
    return Response.json(
      { error: `Failed to fetch clients: ${error.message}` },
      { status: 500 }
    )
  }

  let generated = 0
  let failed = 0
  const errors: { client_id: string; error: string }[] = []

  for (const client of clients ?? []) {
    const result = await generateDigestForClient(client.id)
    if (result.ok) {
      generated++
    } else {
      failed++
      errors.push({ client_id: client.id, error: result.error })
    }
  }

  return Response.json({ generated, failed, errors }, { status: 200 })
}
