'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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

  // `size` is tuned per icon rather than shared: the artworks have different
  // aspect ratios, so a single box would leave the (wide, horizontal) dumbbell
  // reading much lighter than the dense, square house and apple.
  const NAV = [
    { label: t.nav.home,    href: '/client',           icon: '/icons/nav/home.png',    size: 25 },
    { label: t.nav.train,   href: '/client/workouts',  icon: '/icons/nav/train.png',   size: 28 },
    { label: t.nav.food,    href: '/client/nutrition', icon: '/icons/nav/food.png',    size: 24 },
    { label: t.nav.profile, href: '/client/profile',   icon: '/icons/nav/profile.png', size: 25 },
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
        {NAV.map(({ label, href, icon, size }) => {
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
              {/* The pill is its own layer behind the icon so that only the pill
                  scales in on activation. Scaling a wrapper would shrink the
                  artwork too, and an icon rendered at 72% on a near-black bar
                  reads as dimmed even at full opacity. */}
              <div
                style={{
                  position: 'relative',
                  width: 54,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  className="cx-nav-pill"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 999,
                    backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                    transform: active ? 'scale(1)' : 'scale(0.72)',
                  }}
                />
                {/* Labelled by the text beneath it, so the image is decorative. */}
                <img
                  src={icon}
                  alt=""
                  aria-hidden="true"
                  width={size}
                  height={size}
                  draggable={false}
                  className="cx-nav-icon"
                  style={{ position: 'relative', width: size, height: size }}
                />
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
