'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, ListChecks, LayoutList, Settings, UtensilsCrossed, MessageSquare } from 'lucide-react'

const NAV = [
  { label: 'Clients', href: '/coach/dashboard', Icon: Users },
  { label: 'Check-ins', href: '/coach/check-ins', Icon: ListChecks },
  { label: 'Training Programs', href: '/coach/programs', Icon: LayoutList },
  { label: 'Meal Plans', href: '/coach/meal-plans', Icon: UtensilsCrossed },
  { label: 'Assistant', href: '/coach/assistant', Icon: MessageSquare },
  { label: 'Settings', href: '/coach/settings', Icon: Settings },
] as const

const EXPANDED = 220
const COLLAPSED = 64
const LS_KEY = 'coach_sidebar_collapsed'

export default function SidebarShell({
  children,
  pendingCount = 0,
}: {
  children: React.ReactNode
  pendingCount?: number
}) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

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
        {/* Logo */}
        <div
          className="flex-shrink-0 flex items-center"
          style={{
            height: 64,
            paddingLeft: collapsed ? 0 : '16px',
            paddingRight: collapsed ? 0 : '16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <button
            type="button"
            onClick={toggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {/* Orange square logo mark */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: '-0.03em' }}>
                M
              </span>
            </div>
            {!collapsed && (
              <div>
                <span
                  style={{
                    display: 'block',
                    color: 'var(--color-text-primary)',
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}
                >
                  Mitovski
                </span>
                <span
                  style={{
                    display: 'block',
                    color: 'var(--color-text-hint)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    marginTop: 1,
                  }}
                >
                  Coach Console
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1 px-3 pt-4">
          {NAV.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className="flex items-center transition-colors"
                style={{
                  gap: collapsed ? 0 : '10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '9px 0' : '9px 12px',
                  backgroundColor: active ? 'var(--color-accent)' : 'transparent',
                  borderRadius: 8,
                  color: active ? '#ffffff' : 'var(--color-text-muted)',
                  fontWeight: active ? 600 : 400,
                  fontSize: '14px',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-3)'
                    e.currentTarget.style.color = 'var(--color-text-secondary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--color-text-muted)'
                  }
                }}
              >
                <div className="relative" style={{ flexShrink: 0 }}>
                  <Icon size={16} />
                  {href === '/coach/check-ins' && pendingCount > 0 && (
                    <span
                      className="absolute"
                      style={{
                        top: -3,
                        right: -3,
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: active ? '#ffffff' : '#ef4444',
                        display: 'block',
                      }}
                    />
                  )}
                </div>
                {!collapsed && (
                  <span className="whitespace-nowrap flex items-center gap-1.5">
                    {label}
                    {href === '/coach/check-ins' && pendingCount > 0 && (
                      <span
                        className="inline-flex items-center justify-center text-xs font-semibold"
                        style={{
                          minWidth: 18,
                          height: 18,
                          borderRadius: '9999px',
                          backgroundColor: active ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.18)',
                          color: active ? '#fff' : '#ef4444',
                          padding: '0 5px',
                          lineHeight: 1,
                        }}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User avatar at bottom */}
        <div
          className="flex-shrink-0 px-3 pb-5 pt-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <div
            className="flex items-center"
            style={{
              gap: collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '6px 0' : '6px 8px',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--color-surface-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
              }}
            >
              MC
            </div>
            {!collapsed && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.2 }}>
                  Coach
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: 0 }}>
                  mitovski.co
                </p>
              </div>
            )}
          </div>
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
