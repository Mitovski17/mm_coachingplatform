'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, BarChart3, ShieldAlert,
  CreditCard, MoreHorizontal, X, ArrowLeft,
} from 'lucide-react'

const NAV = [
  { label: 'Dashboard',  href: '/admin',            Icon: LayoutDashboard },
  { label: 'Users',      href: '/admin/users',       Icon: Users },
  { label: 'Workspaces', href: '/admin/workspaces',  Icon: Building2 },
  { label: 'Analytics',  href: '/admin/analytics',   Icon: BarChart3 },
  { label: 'Content',    href: '/admin/content',     Icon: ShieldAlert },
  { label: 'Billing',    href: '/admin/billing',     Icon: CreditCard },
] as const

/** 3 primary items in mobile bottom bar */
const MOBILE_PRIMARY = [
  { label: 'Dashboard',  href: '/admin',            Icon: LayoutDashboard },
  { label: 'Users',      href: '/admin/users',       Icon: Users },
  { label: 'Workspaces', href: '/admin/workspaces',  Icon: Building2 },
] as const

/** Items in the mobile "More" bottom sheet */
const MOBILE_MORE = [
  { label: 'Analytics', href: '/admin/analytics',  Icon: BarChart3 },
  { label: 'Content',   href: '/admin/content',    Icon: ShieldAlert },
  { label: 'Billing',   href: '/admin/billing',    Icon: CreditCard },
] as const

const EXPANDED  = 220
const COLLAPSED = 64
const LS_KEY    = 'admin_sidebar_collapsed'

export default function AdminSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed,  setCollapsed]  = useState(false)
  const [moreOpen,   setMoreOpen]   = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (localStorage.getItem(LS_KEY) === 'true') setCollapsed(true)
  }, [])

  // Close "More" sheet on route change
  useEffect(() => { setMoreOpen(false) }, [pathname])

  // Close sheet when screen grows beyond mobile
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setMoreOpen(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(LS_KEY, String(next))
      return next
    })
  }

  const w = collapsed ? COLLAPSED : EXPANDED

  function isActive(href: string) {
    return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-base)' }}>

      {/* ══════════════════════════════════════════════
          MOBILE — fixed top header  (hidden on ≥768px)
          ══════════════════════════════════════════════ */}
      <header
        className="admin-mobile-header"
        style={{
          position:        'fixed',
          top:             0,
          left:            0,
          right:           0,
          height:          56,
          backgroundColor: 'var(--color-surface-1)',
          borderBottom:    '1px solid var(--color-border)',
          paddingLeft:     16,
          paddingRight:    16,
          zIndex:          50,
          alignItems:      'center',
          justifyContent:  'space-between',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: 7,
              backgroundColor: '#7c3aed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>A</span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-primary)', fontSize: 15, fontWeight: 700, display: 'block', lineHeight: 1.1 }}>
              Mitovski
            </span>
            <span style={{ color: '#7c3aed', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Admin Panel
            </span>
          </div>
        </div>

        {/* Back to coach */}
        <Link
          href="/coach/dashboard"
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            6,
            fontSize:       12,
            color:          'var(--color-text-hint)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={13} />
          Coach
        </Link>
      </header>

      {/* ══════════════════════════════════════════════
          DESKTOP — collapsible sidebar  (hidden <768px)
          ══════════════════════════════════════════════ */}
      <aside
        className="admin-sidebar"
        style={{
          position:        'fixed',
          top:             0,
          left:            0,
          height:          '100vh',
          display:         'flex',
          flexDirection:   'column',
          width:           `${w}px`,
          backgroundColor: 'var(--color-surface-1)',
          borderRight:     '1px solid var(--color-border)',
          transition:      'width 0.2s ease',
          overflow:        'hidden',
        }}
      >
        {/* Logo / collapse toggle */}
        <div
          className="flex-shrink-0 flex items-center"
          style={{
            height:         64,
            paddingLeft:    collapsed ? 0 : '16px',
            paddingRight:   collapsed ? 0 : '8px',
            justifyContent: collapsed ? 'center' : 'space-between',
            borderBottom:   '1px solid var(--color-border)',
          }}
        >
          <button
            type="button"
            onClick={toggle}
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        10,
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              padding:    0,
              flex:       collapsed ? undefined : '1 1 0',
              minWidth:   0,
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <div
              style={{
                width:           32,
                height:          32,
                borderRadius:    8,
                backgroundColor: '#7c3aed',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                flexShrink:      0,
              }}
            >
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '-0.03em' }}>A</span>
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                  Mitovski
                </span>
                <span style={{ display: 'block', color: '#7c3aed', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 1 }}>
                  Admin Panel
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 flex-1 px-3 pt-4">
          {NAV.map(({ label, href, Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className="flex items-center transition-colors"
                style={{
                  gap:             collapsed ? 0 : '10px',
                  justifyContent:  collapsed ? 'center' : 'flex-start',
                  padding:         collapsed ? '9px 0' : '9px 12px',
                  backgroundColor: active ? '#7c3aed' : 'transparent',
                  borderRadius:    8,
                  color:           active ? '#ffffff' : 'var(--color-text-muted)',
                  fontWeight:      active ? 600 : 400,
                  fontSize:        '14px',
                  textDecoration:  'none',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-3)'
                    e.currentTarget.style.color           = 'var(--color-text-secondary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color           = 'var(--color-text-muted)'
                  }
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <Icon size={16} />
                </div>
                {!collapsed && <span className="whitespace-nowrap">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Back to coach link */}
        <div className="flex-shrink-0 px-3 pb-5 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <Link
            href="/coach/dashboard"
            title={collapsed ? 'Back to Coach' : undefined}
            className="flex items-center"
            style={{
              gap:            collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding:        collapsed ? '6px 0' : '6px 8px',
              color:          'var(--color-text-hint)',
              fontSize:       12,
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width:           28,
                height:          28,
                borderRadius:    '50%',
                backgroundColor: 'var(--color-surface-3)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                flexShrink:      0,
                fontSize:        11,
                fontWeight:      700,
                color:           'var(--color-text-muted)',
              }}
            >
              MC
            </div>
            {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>← Coach view</span>}
          </Link>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════
          Main content
          ══════════════════════════════════════════════ */}
      <main
        className="admin-main-content flex-1 min-h-screen"
        style={{
          marginLeft:      `${w}px`,
          backgroundColor: 'var(--color-base)',
          transition:      'margin-left 0.2s ease',
        }}
      >
        {children}
      </main>

      {/* ══════════════════════════════════════════════
          MOBILE — fixed bottom nav  (hidden on ≥768px)
          ══════════════════════════════════════════════ */}
      <nav
        className="admin-mobile-nav"
        style={{
          position:        'fixed',
          bottom:          0,
          left:            0,
          right:           0,
          height:          68,
          backgroundColor: 'var(--color-surface-1)',
          borderTop:       '1px solid var(--color-border)',
          paddingBottom:   'env(safe-area-inset-bottom)',
          zIndex:          50,
          alignItems:      'stretch',
        }}
      >
        {MOBILE_PRIMARY.map(({ label, href, Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex:           1,
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            3,
                color:          active ? '#7c3aed' : 'var(--color-text-hint)',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  width:           40,
                  height:          28,
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  borderRadius:    8,
                  backgroundColor: active ? 'rgba(124,58,237,0.14)' : 'transparent',
                }}
              >
                <Icon size={20} />
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, lineHeight: 1 }}>
                {label}
              </span>
            </Link>
          )
        })}

        {/* "More" button */}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          style={{
            flex:           1,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            3,
            color:          moreOpen ? '#7c3aed' : 'var(--color-text-hint)',
            background:     'none',
            border:         'none',
            cursor:         'pointer',
          }}
        >
          <div
            style={{
              width:           40,
              height:          28,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              borderRadius:    8,
              backgroundColor: moreOpen ? 'rgba(124,58,237,0.14)' : 'transparent',
            }}
          >
            {moreOpen ? <X size={20} /> : <MoreHorizontal size={20} />}
          </div>
          <span style={{ fontSize: 10, fontWeight: moreOpen ? 600 : 400, lineHeight: 1 }}>More</span>
        </button>
      </nav>

      {/* ══════════════════════════════════════════════
          MOBILE — "More" bottom sheet overlay
          ══════════════════════════════════════════════ */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position:        'fixed',
              inset:           0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              zIndex:          48,
            }}
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet */}
          <div
            style={{
              position:        'fixed',
              bottom:          68,
              left:            0,
              right:           0,
              backgroundColor: 'var(--color-surface-1)',
              borderTop:       '1px solid var(--color-border)',
              borderRadius:    '20px 20px 0 0',
              padding:         '8px 16px 20px',
              zIndex:          49,
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                width:           36,
                height:          4,
                borderRadius:    2,
                backgroundColor: 'var(--color-surface-3)',
                margin:          '0 auto 16px',
              }}
            />

            {MOBILE_MORE.map(({ label, href, Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             14,
                    padding:         '12px 16px',
                    borderRadius:    12,
                    backgroundColor: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                    color:           active ? '#7c3aed' : 'var(--color-text-secondary)',
                    fontWeight:      active ? 600 : 400,
                    fontSize:        15,
                    textDecoration:  'none',
                    marginBottom:    4,
                  }}
                >
                  <Icon size={20} />
                  {label}
                </Link>
              )
            })}

            {/* Divider + Back to Coach */}
            <div style={{ borderTop: '1px solid var(--color-border)', margin: '8px 0 12px' }} />
            <Link
              href="/coach/dashboard"
              onClick={() => setMoreOpen(false)}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            14,
                padding:        '12px 16px',
                borderRadius:   12,
                color:          'var(--color-text-hint)',
                fontWeight:     400,
                fontSize:       15,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={20} />
              Back to Coach view
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
