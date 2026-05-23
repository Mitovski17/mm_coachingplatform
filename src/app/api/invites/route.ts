import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/email'

const bodySchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.string().default('coach'),
})

export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { email, role } = parsed.data

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('workspace_id, full_name')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .insert({
      workspace_id: profile.workspace_id,
      email,
      role,
      invited_by: user.id,
    })
    .select()
    .single()

  if (inviteError || !invite) {
    return Response.json(
      { error: inviteError?.message ?? 'Failed to create invite' },
      { status: 500 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteUrl = `${appUrl}/invite/${invite.token}`
  const coachName = profile.full_name ?? 'Your coach'

  const { error: emailError } = await sendInviteEmail({ to: email, inviteUrl, coachName })
    .catch((err: unknown) => ({ data: null, error: err }))

  return Response.json(
    {
      ...invite,
      invite_url: inviteUrl,
      ...(emailError ? { email_error: String(emailError) } : {}),
    },
    { status: 201 }
  )
}
