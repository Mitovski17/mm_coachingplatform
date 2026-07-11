import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Fallback root page — the middleware handles routing for authenticated users
// hitting "/" in production. This page is only reached in unusual edge cases
// (e.g. middleware couldn't resolve the role) or during local dev with mock auth.
export default async function RootPage() {
  // Dev mock: check dev_mock_email cookie and resolve role via service role key
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const rawMockEmail = cookieStore.get('dev_mock_email')?.value

    if (rawMockEmail) {
      const mockEmail = decodeURIComponent(rawMockEmail)
      const svc = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      let users: Awaited<ReturnType<typeof svc.auth.admin.listUsers>>['data']['users']
      try {
        const { data } = await svc.auth.admin.listUsers({ perPage: 1000 })
        users = data.users
      } catch (err) {
        console.warn('[page.tsx] listUsers failed - skipping auth check:', err)
        redirect('/login')
      }
      const mockUser = users.find((u) => u.email === mockEmail)
      if (!mockUser) redirect('/login')

      const { data: profile } = await svc
        .from('profiles')
        .select('id')
        .eq('id', mockUser.id)
        .single()
      if (profile) redirect('/coach/dashboard')

      redirect('/client')
    }
  }

  // Production fallback: use real auth session.
  // NOTE: redirect() works by throwing, so it must never be called inside a
  // try/catch — the catch would swallow it and send everyone to /login.
  let destination = '/login'
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      destination = profile ? '/coach/dashboard' : '/client'
    }
  } catch {
    // fall through to /login
  }
  redirect(destination)
}
