import { NextRequest } from 'next/server'
import { generateDigestForClient } from '@/lib/digest'

export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const client_id = (raw as Record<string, unknown>)?.client_id
  if (!client_id || typeof client_id !== 'string') {
    return Response.json({ error: 'client_id is required' }, { status: 400 })
  }

  const result = await generateDigestForClient(client_id)

  if (!result.ok) {
    const status = result.error === 'Client not found' ? 404 : 500
    return Response.json({ error: result.error }, { status })
  }

  return Response.json(result.data, { status: 200 })
}
