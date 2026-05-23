import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import ContentTable from './ContentTable'

async function fetchDigests() {
  const svc = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: digests } = await (svc as any)
    .from('ai_digests')
    .select('id, summary, rag_status, week_start_date, flagged, flag_reason, client_id, workspace_id')
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: clients } = await svc
    .from('clients')
    .select('id, full_name')

  const { data: workspaces } = await svc
    .from('workspaces')
    .select('id, name')

  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.full_name]))
  const wsMap = Object.fromEntries((workspaces ?? []).map((w) => [w.id, w.name]))

  return (digests ?? []).map((d: {
    id: string; summary: string; rag_status: string; week_start_date: string;
    flagged: boolean; flag_reason: string | null; client_id: string; workspace_id: string
  }) => ({
    id: d.id,
    summary: d.summary,
    rag_status: d.rag_status,
    week_start_date: d.week_start_date,
    flagged: d.flagged ?? false,
    flag_reason: d.flag_reason ?? null,
    clientName: clientMap[d.client_id] ?? 'Unknown',
    workspaceName: wsMap[d.workspace_id] ?? 'Unknown',
  }))
}

export default async function ContentPage() {
  const digests = await fetchDigests()
  const flaggedCount = digests.filter((d) => d.flagged).length

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Content Moderation
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-hint)', marginTop: 4 }}>
          {digests.length} AI digests — {flaggedCount} flagged
        </p>
      </div>

      {digests.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '40px',
            textAlign: 'center',
            color: 'var(--color-text-hint)',
            fontSize: 14,
          }}
        >
          No AI digests have been generated yet.
        </div>
      ) : (
        <ContentTable digests={digests} />
      )}
    </div>
  )
}
