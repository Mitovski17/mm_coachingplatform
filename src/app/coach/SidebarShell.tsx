'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, ListChecks, Settings, ChevronLeft, ChevronRight } from 'lucide-react'

const NAV = [
  { label: 'Clients', href: '/coach/dashboard', Icon: Users },
  { label: 'Check-ins', href: '/coach/check-ins', Icon: ListChecks },
  { label: 'Settings', href: '/coach/settings', Icon: Settings },
] as const

const EXPANDED = 220
const COLLAPSED = 64
const LS_KEY = 'coach_sidebar_collapsed'

export default function SidebarShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  // Restore persisted state after hydration (avoids SSR mismatch)
  useEffect(() => {
    if (localStorage.getItem(LS_KEY) === 'true') setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(LS_KEY, String(next))
      return next
    })
  }

  const w = collapsed ? COLLAPSED : EXPANDED

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-base)' }}>
      {/* ── Sidebar ── */}
      <aside
        className="fixed top-0 left-0 h-screen flex flex-col"
        style={{
          width: `${w}px`,
          backgroundColor: 'var(--color-surface-1)',
          borderRight: '1px solid var(--color-border)',
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Wordmark */}
        <div
          className="flex-shrink-0 pt-6 pb-8"
          style={{ paddingLeft: collapsed ? 0 : '20px', paddingRight: collapsed ? 0 : '20px' }}
        >
          {collapsed ? (
            <div className="flex justify-center">
              <span
                className="text-base leading-tight"
                style={{ color: 'var(--color-text-primary)', fontWeight: 700, letterSpacing: '-0.01em' }}
              >
                MC
              </span>
            </div>
          ) : (
            <>
              <span
                className="block text-2xl leading-tight whitespace-nowrap"
                style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
              >
                Mitovski
              </span>
              <span
                className="block text-2xl leading-tight whitespace-nowrap"
                style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
              >
                Coaching
              </span>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1 px-3">
          {NAV.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className="flex items-center py-2 text-sm transition-colors"
                style={{
                  gap: collapsed ? 0 : '10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  paddingLeft: collapsed ? 0 : active ? '10px' : '12px',
                  paddingRight: collapsed ? 0 : '12px',
                  backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                  borderLeft:
                    !collapsed && active
                      ? '2px solid var(--color-accent)'
                      : '2px solid transparent',
                  borderRadius: 'var(--radius-md)',
                  color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  fontWeight: active ? 500 : 400,
                  textDecoration: 'none',
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                {!collapsed && <span className="whitespace-nowrap">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Toggle button */}
        <div className="flex-shrink-0 px-3 pb-5">
          <button
            type="button"
            onClick={toggle}
            className="flex items-center justify-center w-full py-2 transition-colors"
            style={{
              color: 'var(--color-text-hint)',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-3)'
              e.currentTarget.style.color = 'var(--color-text-muted)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--color-text-hint)'
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main
        className="flex-1 min-h-screen"
        style={{
          marginLeft: `${w}px`,
          backgroundColor: 'var(--color-base)',
          transition: 'margin-left 0.2s ease',
        }}
      >
        {children}
      </main>
    </div>
  )
}
