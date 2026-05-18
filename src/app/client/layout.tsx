'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, Dumbbell, Apple, BarChart2, User } from 'lucide-react'

const NAV = [
  { label: 'Home',     href: '/client',           Icon: House },
  { label: 'Train',    href: '/client/workouts',   Icon: Dumbbell },
  { label: 'Food',     href: '/client/nutrition',  Icon: Apple },
  { label: 'Progress', href: '/client/progress',   Icon: BarChart2 },
  { label: 'Profile',  href: '/client/profile',    Icon: User },
] as const

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-base)' }}>
      <main style={{ paddingBottom: '76px' }}>
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 flex items-stretch"
        style={{
          height: '68px',
          backgroundColor: 'var(--color-surface-1)',
          borderTop: '1px solid var(--color-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 50,
        }}
      >
        {NAV.map(({ label, href, Icon }) => {
          const active = href === '/client' ? pathname === '/client' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center flex-1 gap-1 transition-colors"
              style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-hint)', textDecoration: 'none' }}
            >
              <div
                style={{
                  width: 38,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                }}
              >
                <Icon size={20} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: active ? 600 : 400, lineHeight: 1 }}>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
