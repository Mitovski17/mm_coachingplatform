import { redirect } from 'next/navigation'
import AdminSidebar from './AdminSidebar'
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Every /admin page renders platform-wide data with the service-role key, so
  // the whole section is gated here on platform-admin membership. Non-admins are
  // bounced rather than shown an error.
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect('/login')
    if (e instanceof ForbiddenError) redirect('/')
    throw e
  }

  return <AdminSidebar>{children}</AdminSidebar>
}
