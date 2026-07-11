import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Shared authentication / authorization guards for server actions and API
 * routes.
 *
 * Every mutating server action in this app talks to Supabase through the
 * service-role key, which bypasses Row Level Security. That makes the caller's
 * identity impossible to trust from arguments alone — a server action is a
 * public POST endpoint. These guards resolve the *acting* user from the
 * session (never from a client-supplied id) so callers can only ever act on
 * their own data.
 *
 * Throwing `Unauthorized`/`Forbidden` here surfaces as a rejected server
 * action / 500 to an attacker, which is the desired outcome. Legitimate flows
 * never hit these throws because the session is always present.
 */

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/**
 * Resolves the acting auth user's id + email from the session.
 * In development, honours the `dev_mock_email` cookie set by the proxy.
 * Returns null when there is no authenticated user.
 */
export const getSessionUser = cache(async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const raw = cookieStore.get('dev_mock_email')?.value
    if (raw) {
      const email = decodeURIComponent(raw).toLowerCase().trim()
      const svc = createServiceClient()
      const { data } = await svc.auth.admin.listUsers({ perPage: 1000 })
      const u = data.users.find((x) => x.email?.toLowerCase() === email)
      if (!u?.email) return null
      return { id: u.id, email: u.email.toLowerCase() }
    }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return null
    return { id: user.id, email: user.email.toLowerCase() }
  } catch {
    return null
  }
})

/** Like getSessionUser but only needs the email — cheaper for client flows. */
export const getSessionEmail = cache(async function getSessionEmail(): Promise<string | null> {
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const raw = cookieStore.get('dev_mock_email')?.value
    if (raw) return decodeURIComponent(raw).toLowerCase().trim()
  }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.email?.toLowerCase() ?? null
  } catch {
    return null
  }
})

export interface ClientContext {
  clientId: string
  workspaceId: string
  email: string
  coachId: string | null
}

/**
 * Requires the caller to be an authenticated client and returns their own
 * client record. Never trusts a caller-supplied client id.
 */
export const requireClient = cache(async function requireClient(): Promise<ClientContext> {
  const email = await getSessionEmail()
  if (!email) throw new UnauthorizedError()

  const svc = createServiceClient()
  const { data } = await svc
    .from('clients')
    .select('id, workspace_id, email, coach_id')
    .eq('email', email)
    .maybeSingle()

  if (!data) throw new UnauthorizedError('No client record for this account')
  return {
    clientId: data.id,
    workspaceId: data.workspace_id,
    email: data.email,
    coachId: data.coach_id ?? null,
  }
})

export interface CoachContext {
  userId: string
  workspaceId: string
  email: string
}

/**
 * Requires the caller to be an authenticated coach (has a profiles row) and
 * returns their identity + workspace. Never trusts a caller-supplied
 * workspace id.
 */
export const requireCoach = cache(async function requireCoach(): Promise<CoachContext> {
  const user = await getSessionUser()
  if (!user) throw new UnauthorizedError()

  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) throw new ForbiddenError('Not a coach account')
  return { userId: user.id, workspaceId: profile.workspace_id, email: user.email }
})

/** Requires the caller to be a platform admin. */
export async function requireAdmin(): Promise<CoachContext> {
  const coach = await requireCoach()
  const svc = createServiceClient()
  const { data: admin } = await svc
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', coach.userId)
    .maybeSingle()

  if (!admin) throw new ForbiddenError('Not a platform admin')
  return coach
}

/**
 * Maps a thrown guard error to an HTTP Response for use in API route handlers.
 * Returns null for anything that isn't an auth/authorization error so the
 * caller can rethrow. Usage:
 *   try { coach = await requireCoach() }
 *   catch (e) { const r = authErrorResponse(e); if (r) return r; throw e }
 */
export function authErrorResponse(e: unknown): Response | null {
  if (e instanceof UnauthorizedError) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (e instanceof ForbiddenError) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/**
 * Asserts the given client id belongs to the coach's workspace. Use in coach
 * actions that receive a client id, so a coach can only touch their own
 * clients.
 */
export async function assertCoachOwnsClient(
  coach: CoachContext,
  clientId: string,
): Promise<void> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('workspace_id', coach.workspaceId)
    .maybeSingle()
  if (!data) throw new ForbiddenError('Client not in your workspace')
}
