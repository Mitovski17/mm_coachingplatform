import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

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

      const {
        data: { users },
      } = await svc.auth.admin.listUsers({ perPage: 1000 })
      const mockUser = users.find((u) => u.email === mockEmail)
      if (!mockUser) redirect('/login')

      const { data: profile } = await svc
        .from('profiles')
        .select('id')
        .eq('id', mockUser.id)
        .single()
      if (profile) redirect('/coach/dashboard')

      const { data: client } = await svc
        .from('clients')
        .select('id')
        .eq('email', mockEmail)
        .single()
      if (client) redirect('/check-in')

      redirect('/login')
    }
  }

  // Production (and dev without mock cookie): use real auth session
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()
  if (profile) redirect('/coach/dashboard')

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('email', user.email!)
    .single()
  if (client) redirect('/check-in')

  redirect('/login')
}
