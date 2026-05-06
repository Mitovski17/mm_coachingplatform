import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import ProgramsClient from './ProgramsClient'
import { getTemplates, getPrograms } from './actions'

async function resolveWorkspaceId(): Promise<string> {
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const rawMockEmail = cookieStore.get('dev_mock_email')?.value
    if (rawMockEmail) {
      const mockEmail = decodeURIComponent(rawMockEmail)
      const svc = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: { users } } = await svc.auth.admin.listUsers({ perPage: 1000 })
      const adminUser = users.find((u) => u.email === mockEmail)
      if (!adminUser) redirect('/login')
      const { data: profile } = await svc
        .from('profiles').select('workspace_id').eq('id', adminUser.id).single()
      if (!profile) redirect('/login')
      return profile.workspace_id
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles').select('workspace_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  return profile.workspace_id
}

export default async function ProgramsPage() {
  const workspaceId = await resolveWorkspaceId()
  const [templates, programs] = await Promise.all([
    getTemplates(workspaceId),
    getPrograms(workspaceId),
  ])

  return (
    <ProgramsClient
      templates={templates}
      programs={programs}
    />
  )
}
