import SidebarShell from './SidebarShell'

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return <SidebarShell>{children}</SidebarShell>
}
