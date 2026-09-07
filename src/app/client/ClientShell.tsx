'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { House, Dumbbell, Apple, User } from 'lucide-react'
import ClientNotificationBell from '@/components/client/ClientNotificationBell'
import WorkoutFloatingWidget from '@/components/client/WorkoutFloatingWidget'
import { WorkoutSessionProvider } from '@/lib/WorkoutSessionContext'
import { useLanguage } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  const NAV = [
    { label: t.nav.home,    href: '/client',           Icon: House },
    { label: t.nav.train,   href: '/client/workouts',  Icon: Dumbbell },
    { label: t.nav.food,    href: '/client/nutrition', Icon: Apple },
    { label: t.nav.profile, href: '/client/profile',   Icon: User },
  ] as const

  return (
    <div className="cx" style={{ minHeight: '100dvh', backgroundColor: 'var(--color-base)' }}>
      <WorkoutFloatingWidget />
      {/* Translucent header: content scrolling beneath it stays faintly visible,
          which is what makes the chrome feel like a layer rather than a lid. */}
      <header
        className="cx-chrome fixed top-0 left-0 right-0 flex items-center justify-between"
        style={{
          height: 'calc(52px + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          borderBottom: '1px solid var(--color-border)',
          paddingLeft: 16,
          paddingRight: 12,
          zIndex: 50,
        }}
      >
        <span
          className="cx-display"
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: 'var(--color-text-primary)',
          }}
        >
          Mitovski
        </span>
        <ClientNotificationBell />
      </header>

      <main
        style={{
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          // Clears the nav's full height including the home indicator
          paddingBottom: 'calc(76px + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </main>

      <nav
        className="cx-chrome cx-chrome-nav fixed bottom-0 left-0 right-0 flex items-stretch"
        style={{
          height: 'calc(68px + env(safe-area-inset-bottom))',
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
              aria-current={active ? 'page' : undefined}
              data-active={active}
              className="cx-nav-item flex flex-col items-center justify-center flex-1"
              style={{
                gap: 5,
                color: active ? 'var(--color-accent)' : 'var(--color-text-hint)',
                textDecoration: 'none',
              }}
            >
              {/* The pill scales in behind the icon when the tab becomes
                  active — the only thing that moves is a transform. */}
              <div
                className="cx-nav-pill"
                style={{
                  width: 54,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 999,
                  backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                  transform: active ? 'scale(1)' : 'scale(0.72)',
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  lineHeight: 1,
                  letterSpacing: '-0.005em',
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkoutSessionProvider>
      <Shell>{children}</Shell>
    </WorkoutSessionProvider>
  )
}
