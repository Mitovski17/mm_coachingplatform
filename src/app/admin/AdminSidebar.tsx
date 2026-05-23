'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Building2, BarChart3, ShieldAlert, CreditCard } from 'lucide-react'

const NAV = [
  { label: 'Dashboard',   href: '/admin',             Icon: LayoutDashboard },
  { label: 'Users',       href: '/admin/users',        Icon: Users },
  { label: 'Workspaces',  href: '/admin/workspaces',   Icon: Building2 },
  { label: 'Analytics',   href: '/admin/analytics',    Icon: BarChart3 },
  { label: 'Content',     href: '/admin/content',      Icon: ShieldAlert },
  { label: 'Billing',     href: '/admin/billing',      Icon: CreditCard },
] as const

const EXPANDED = 220
const COLLAPSED = 64
const LS_KEY = 'admin_sidebar_collapsed'

export default function AdminSidebar({ children }: { children: React.ReactNode }) {
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
            paddingRight: collapsed ? 0 : '8px',
            justifyContent: collapsed ? 'center' : 'space-between',
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
              flex: collapsed ? undefined : '1 1 0',
              minWidth: 0,
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '-0.03em' }}>
                A
              </span>
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
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
                    color: '#7c3aed',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    marginTop: 1,
                  }}
                >
                  Admin Panel
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1 px-3 pt-4">
          {NAV.map(({ label, href, Icon }) => {
            const active = href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(href)
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
                  backgroundColor: active ? '#7c3aed' : 'transparent',
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
                <div style={{ flexShrink: 0 }}>
                  <Icon size={16} />
                </div>
                {!collapsed && (
                  <span className="whitespace-nowrap">{label}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Back to coach link */}
        <div
          className="flex-shrink-0 px-3 pb-5 pt-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <Link
            href="/coach/dashboard"
            title={collapsed ? 'Back to Coach' : undefined}
            className="flex items-center"
            style={{
              gap: collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '6px 0' : '6px 8px',
              color: 'var(--color-text-hint)',
              fontSize: 12,
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: 'var(--color-surface-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
              }}
            >
              MC
            </div>
            {!collapsed && (
              <span style={{ whiteSpace: 'nowrap' }}>← Coach view</span>
            )}
          </Link>
        </div>
      </aside>

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
