'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, Dumbbell, UtensilsCrossed, TrendingUp } from 'lucide-react'

const NAV = [
  { label: 'Home', href: '/client', Icon: House },
  { label: 'Workouts', href: '/client/workouts', Icon: Dumbbell },
  { label: 'Nutrition', href: '/client/nutrition', Icon: UtensilsCrossed },
  { label: 'Progress', href: '/client/progress', Icon: TrendingUp },
] as const

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-base)' }}>
      <main style={{ paddingBottom: '64px' }}>
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 flex items-stretch"
        style={{
          height: '64px',
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
              className="flex flex-col items-center justify-center flex-1 gap-1 text-xs font-medium transition-colors"
              style={{
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-hint)',
                textDecoration: 'none',
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: '10px', fontWeight: active ? 600 : 400 }}>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
