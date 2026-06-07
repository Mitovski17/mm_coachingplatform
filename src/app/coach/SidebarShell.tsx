'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users, ListChecks, LayoutList, Settings, UtensilsCrossed,
  MessageSquare, MessageCircle, ShieldCheck, MoreHorizontal, X,
} from 'lucide-react'
import NotificationBell from '@/components/shared/NotificationBell'
import CoachOnboardingWizard from '@/components/onboarding/CoachOnboardingWizard'

// ─── Navigation definitions ───────────────────────────────────────────────────

/** All 7 nav items — used by the desktop sidebar */
const NAV = [
  { label: 'Clients',           href: '/coach/dashboard', Icon: Users },
  { label: 'Check-ins',         href: '/coach/check-ins', Icon: ListChecks },
  { label: 'Messages',          href: '/coach/messages',  Icon: MessageCircle },
  { label: 'Training Programs', href: '/coach/programs',  Icon: LayoutList },
  { label: 'Meal Plans',        href: '/coach/meal-plans',Icon: UtensilsCrossed },
  { label: 'Assistant',         href: '/coach/assistant', Icon: MessageSquare },
  { label: 'Settings',          href: '/coach/settings',  Icon: Settings },
] as const

/** 3 primary items shown in the mobile bottom bar */
const MOBILE_PRIMARY = [
  { label: 'Home',      href: '/coach/dashboard', Icon: Users },
  { label: 'Check-ins', href: '/coach/check-ins', Icon: ListChecks },
  { label: 'Messages',  href: '/coach/messages',  Icon: MessageCircle },
] as const

/** Items shown in the mobile "More" bottom sheet */
const MOBILE_MORE = [
  { label: 'Programs',  href: '/coach/programs',  Icon: LayoutList },
  { label: 'Meal Plans', href: '/coach/meal-plans', Icon: UtensilsCrossed },
  { label: 'Assistant',  href: '/coach/assistant',  Icon: MessageSquare },
  { label: 'Settings',   href: '/coach/settings',   Icon: Settings },
] as const

// ─── Layout constants ─────────────────────────────────────────────────────────

const EXPANDED  = 220
const COLLAPSED = 64
const LS_KEY    = 'coach_sidebar_collapsed'

// ─── Component ────────────────────────────────────────────────────────────────

export default function SidebarShell({
  children,
  pendingCount       = 0,
  unreadMessageCount = 0,
  coachId            = '',
  isAdmin            = false,
  coachName          = 'Coach',
  coachEmail         = '',
  coachAvatarUrl     = null,
  onboardingCompleted = true,
}: {
  children: React.ReactNode
  pendingCount?: number
  unreadMessageCount?: number
  coachId?: string
  isAdmin?: boolean
  coachName?: string
  coachEmail?: string
  coachAvatarUrl?: string | null
  onboardingCompleted?: boolean
}) {
  const [collapsed,  setCollapsed]  = useState(false)
  const [moreOpen,   setMoreOpen]   = useState(false)
  const pathname = usePathname()

  // Restore sidebar collapse preference
  useEffect(() => {
    if (localStorage.getItem(LS_KEY) === 'true') setCollapsed(true)
  }, [])

  // Close "More" sheet on route change
  useEffect(() => { setMoreOpen(false) }, [pathname])

  // Close "More" sheet when screen grows beyond mobile breakpoint
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

  /** Returns notification badge count for a given href */
  function badgeFor(href: string): number {
    if (href === '/coach/check-ins') return pendingCount
    if (href === '/coach/messages')  return unreadMessageCount
    return 0
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-base)' }}>

      {/* ══════════════════════════════════════════════════════
          MOBILE — fixed top header   (hidden on ≥ 768 px)
          ══════════════════════════════════════════════════════ */}
      <header
        className="coach-mobile-header"
        style={{
          position:        'fixed',
          top:             0,
          left:            0,
          right:           0,
          height:          56,
          backgroundColor: 'var(--color-surface-1)',
          borderBottom:    '1px solid var(--color-border)',
          paddingLeft:     16,
          paddingRight:    12,
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
              backgroundColor: 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>M</span>
          </div>
          <span style={{ color: 'var(--color-text-primary)', fontSize: 15, fontWeight: 700 }}>
            Mitovski
          </span>
        </div>

        {/* Right: notification bell */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {coachId && <NotificationBell recipientType="coach" recipientId={coachId} />}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          DESKTOP — collapsible sidebar   (hidden on < 768 px)
          ══════════════════════════════════════════════════════ */}
      <aside
        className="coach-sidebar"
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
        {/* ── Logo / collapse toggle ── */}
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
            suppressHydrationWarning
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
                backgroundColor: 'var(--color-accent)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                flexShrink:      0,
              }}
            >
              <span style={{ color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: '-0.03em' }}>
                M
              </span>
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    display:        'block',
                    color:          'var(--color-text-primary)',
                    fontSize:       14,
                    fontWeight:     700,
                    letterSpacing:  '-0.01em',
                    whiteSpace:     'nowrap',
                    lineHeight:     1.2,
                  }}
                >
                  Mitovski
                </span>
                <span
                  style={{
                    display:        'block',
                    color:          'var(--color-text-hint)',
                    fontSize:       10,
                    fontWeight:     600,
                    letterSpacing:  '0.08em',
                    textTransform:  'uppercase',
                    whiteSpace:     'nowrap',
                    marginTop:      1,
                  }}
                >
                  Coach Console
                </span>
              </div>
            )}
          </button>
          {coachId && <NotificationBell recipientType="coach" recipientId={coachId} />}
        </div>

        {/* ── Nav items ── */}
        <nav className="flex flex-col gap-0.5 flex-1 px-3 pt-4">
          {NAV.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            const badge  = badgeFor(href)
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
                  backgroundColor: active ? 'var(--color-accent)' : 'transparent',
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
                {/* Icon + notification dot */}
                <div className="relative" style={{ flexShrink: 0 }}>
                  <Icon size={16} />
                  {badge > 0 && (
                    <span
                      className="absolute"
                      style={{
                        top:             -3,
                        right:           -3,
                        width:           7,
                        height:          7,
                        borderRadius:    '50%',
                        backgroundColor: active ? '#ffffff' : '#ef4444',
                        display:         'block',
                      }}
                    />
                  )}
                </div>

                {/* Label + count badge */}
                {!collapsed && (
                  <span className="whitespace-nowrap flex items-center gap-1.5">
                    {label}
                    {badge > 0 && (
                      <span
                        className="inline-flex items-center justify-center text-xs font-semibold"
                        style={{
                          minWidth:        18,
                          height:          18,
                          borderRadius:    '9999px',
                          backgroundColor: active ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.18)',
                          color:           active ? '#fff' : '#ef4444',
                          padding:         '0 5px',
                          lineHeight:      1,
                        }}
                      >
                        {badge}
                      </span>
                    )}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* ── Admin panel link ── */}
        {isAdmin && (
          <div className="flex-shrink-0 px-3 pb-2">
            <Link
              href="/admin"
              title={collapsed ? 'Admin Panel' : undefined}
              className="flex items-center transition-colors"
              style={{
                gap:             collapsed ? 0 : '10px',
                justifyContent:  collapsed ? 'center' : 'flex-start',
                padding:         collapsed ? '8px 0' : '8px 12px',
                backgroundColor: 'rgba(124,58,237,0.10)',
                borderRadius:    8,
                color:           '#7c3aed',
                fontWeight:      600,
                fontSize:        '13px',
                textDecoration:  'none',
              }}
            >
              <ShieldCheck size={15} style={{ flexShrink: 0 }} />
              {!collapsed && <span className="whitespace-nowrap">Admin Panel</span>}
            </Link>
          </div>
        )}

        {/* ── User avatar → settings ── */}
        <div
          className="flex-shrink-0 px-3 pb-5 pt-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <Link
            href="/coach/settings"
            title={collapsed ? 'Profile & Settings' : undefined}
            className="flex items-center transition-colors"
            style={{
              gap:           collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding:       collapsed ? '6px 0' : '6px 8px',
              borderRadius:  8,
              textDecoration:'none',
              display:       'flex',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-3)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <div
              style={{
                width:           32,
                height:          32,
                borderRadius:    '50%',
                backgroundColor: coachAvatarUrl ? 'transparent' : 'var(--color-accent)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                flexShrink:      0,
                fontSize:        12,
                fontWeight:      700,
                color:           '#fff',
                overflow:        'hidden',
              }}
            >
              {coachAvatarUrl
                ? <img src={coachAvatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : coachName.trim().split(/\s+/).map((p) => p[0]?.toUpperCase() ?? '').join('').slice(0, 2) || 'MC'}
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    fontSize:     13,
                    fontWeight:   500,
                    color:        'var(--color-text-secondary)',
                    margin:       0,
                    lineHeight:   1.2,
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}
                >
                  {coachName}
                </p>
                {coachEmail && (
                  <p
                    style={{
                      fontSize:     11,
                      color:        'var(--color-text-hint)',
                      margin:       0,
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}
                  >
                    {coachEmail}
                  </p>
                )}
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════
          Main content area
          ══════════════════════════════════════════════════════ */}
      <main
        className="coach-main-content flex-1 min-h-screen"
        style={{
          marginLeft:      `${w}px`,
          backgroundColor: 'var(--color-base)',
          transition:      'margin-left 0.2s ease',
        }}
      >
        {children}
      </main>

      {/* ══════════════════════════════════════════════════════
          MOBILE — fixed bottom navigation   (hidden on ≥ 768 px)
          ══════════════════════════════════════════════════════ */}
      <nav
        className="coach-mobile-nav"
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
          const active = pathname === href || pathname.startsWith(href + '/')
          const badge  = badgeFor(href)
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
                color:          active ? 'var(--color-accent)' : 'var(--color-text-hint)',
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
                  backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                  position:        'relative',
                }}
              >
                <Icon size={20} />
                {badge > 0 && (
                  <span
                    style={{
                      position:        'absolute',
                      top:             2,
                      right:           4,
                      width:           7,
                      height:          7,
                      borderRadius:    '50%',
                      backgroundColor: '#ef4444',
                      display:         'block',
                    }}
                  />
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, lineHeight: 1 }}>
                {label}
              </span>
            </Link>
          )
        })}

        {/* ── "More" button ── */}
        <button
          suppressHydrationWarning
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          style={{
            flex:           1,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            3,
            color:          moreOpen ? 'var(--color-accent)' : 'var(--color-text-hint)',
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
              backgroundColor: moreOpen ? 'var(--color-accent-dim)' : 'transparent',
            }}
          >
            {moreOpen ? <X size={20} /> : <MoreHorizontal size={20} />}
          </div>
          <span style={{ fontSize: 10, fontWeight: moreOpen ? 600 : 400, lineHeight: 1 }}>More</span>
        </button>
      </nav>

      {/* ══════════════════════════════════════════════════════
          MOBILE — "More" bottom sheet overlay
          ══════════════════════════════════════════════════════ */}
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
              padding:         '8px 16px 16px',
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
              const active = pathname === href || pathname.startsWith(href + '/')
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
                    backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                    color:           active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
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

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMoreOpen(false)}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  gap:             14,
                  padding:         '12px 16px',
                  borderRadius:    12,
                  backgroundColor: 'rgba(124,58,237,0.10)',
                  color:           '#7c3aed',
                  fontWeight:      600,
                  fontSize:        15,
                  textDecoration:  'none',
                }}
              >
                <ShieldCheck size={20} />
                Admin Panel
              </Link>
            )}
          </div>
        </>
      )}

      {/* ── Coach onboarding wizard ── */}
      {!onboardingCompleted && (
        <CoachOnboardingWizard
          coachName={coachName}
          coachAvatarUrl={coachAvatarUrl}
          coachId={coachId}
        />
      )}
    </div>
  )
}
