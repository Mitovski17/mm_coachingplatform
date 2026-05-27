export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getSessionDetail } from '../../actions'
import HistoryDetailView from './HistoryDetailView'

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  try {
    const session = await getSessionDetail(id)
    return <HistoryDetailView session={session} />
  } catch {
    notFound()
  }
}
