'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  const router = useRouter()

  // Redirect to login on session loss (covers stale/invalid refresh tokens)
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

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
    // `cx` opts the whole console into the design layer the client view uses —
    // the shared tokens, easing curves and press/lift/rise vocabulary defined
    // in globals.css. Everything below reads from it rather than restating it.
    <div className="cx flex min-h-screen" style={{ backgroundColor: 'var(--color-base)' }}>

      {/* ══════════════════════════════════════════════════════
          MOBILE — fixed top header   (hidden on ≥ 768 px)
          ══════════════════════════════════════════════════════ */}
      {/* No inline background: `cx-chrome` owns it so the frosted treatment
          can layer on where color-mix is supported. An inline colour would
          outrank the class and leave the bar flatly opaque. */}
      <header
        className="coach-mobile-header cx-chrome"
        style={{
          position:        'fixed',
          top:             0,
          left:            0,
          right:           0,
          height:          56,
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
              width: 28, height: 28, borderRadius: 8,
              backgroundColor: 'var(--color-accent)',
              boxShadow: 'var(--cx-shadow-cta)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span className="cx-display" style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>M</span>
          </div>
          <span className="cx-display" style={{ color: 'var(--color-text-primary)', fontSize: 15, fontWeight: 800 }}>
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
          // Width is layout-bound and can't be composited, so it uses the
          // shared curve at the fast duration rather than lingering.
          transition:      'width var(--cx-dur) var(--cx-ease)',
          overflow:        'hidden',
          zIndex:          40,
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
            className="cx-press"
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
                borderRadius:    9,
                backgroundColor: 'var(--color-accent)',
                boxShadow:       'var(--cx-shadow-cta)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                flexShrink:      0,
              }}
            >
              <span className="cx-display" style={{ color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: '-0.03em' }}>
                M
              </span>
            </div>
            {!collapsed && (
              <div className="cx-side-label" style={{ minWidth: 0 }}>
                <span
                  className="cx-display"
                  style={{
                    display:        'block',
                    color:          'var(--color-text-primary)',
                    fontSize:       14,
                    fontWeight:     800,
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
              // Colours come from `.cx-side` keyed on data-active, not from
              // inline styles swapped in pointer handlers — a CSS state change
              // transitions, an inline-style swap just snaps.
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                data-active={active}
                aria-current={active ? 'page' : undefined}
                className="cx-side flex items-center"
                style={{
                  gap:             collapsed ? 0 : '10px',
                  justifyContent:  collapsed ? 'center' : 'flex-start',
                  padding:         collapsed ? '9px 0' : '9px 12px',
                  fontWeight:      active ? 600 : 400,
                  fontSize:        '14px',
                }}
              >
                {/* Icon + notification dot */}
                <div className="relative" style={{ flexShrink: 0 }}>
                  <Icon size={16} />
                  {badge > 0 && (
                    <span
                      className="absolute cx-pop"
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
                  <span className="cx-side-label flex items-center gap-1.5">
                    {label}
                    {badge > 0 && (
                      <span
                        className="cx-pop cx-num inline-flex items-center justify-center text-xs font-semibold"
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
              className="cx-press flex items-center"
              style={{
                gap:             collapsed ? 0 : '10px',
                justifyContent:  collapsed ? 'center' : 'flex-start',
                padding:         collapsed ? '8px 0' : '8px 12px',
                backgroundColor: 'rgba(124,58,237,0.10)',
                borderRadius:    10,
                color:           '#7c3aed',
                fontWeight:      600,
                fontSize:        '13px',
                textDecoration:  'none',
              }}
            >
              <ShieldCheck size={15} style={{ flexShrink: 0 }} />
              {!collapsed && <span className="cx-side-label">Admin Panel</span>}
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
            data-active={false}
            className="cx-side flex items-center"
            style={{
              gap:           collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding:       collapsed ? '6px 0' : '6px 8px',
              display:       'flex',
            }}
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
              <div className="cx-side-label" style={{ minWidth: 0, flex: 1 }}>
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
      {/* `key` restarts the entrance on every route change, so a navigation
          reads as the new page arriving rather than as content silently
          swapping under a static frame. `cx-page-in` fades without moving —
          see the note on it in globals.css for why this one cannot translate. */}
      <main
        key={pathname}
        className="coach-main-content cx-page-in flex-1 min-h-screen"
        style={{
          marginLeft:      `${w}px`,
          backgroundColor: 'var(--color-base)',
          transition:      'margin-left var(--cx-dur) var(--cx-ease)',
        }}
      >
        {children}
      </main>

      {/* ══════════════════════════════════════════════════════
          MOBILE — fixed bottom navigation   (hidden on ≥ 768 px)
          ══════════════════════════════════════════════════════ */}
      {/* The client app's pattern: a pill grows in behind the active icon. It
          is its own layer so only the pill scales — scaling a wrapper would
          shrink the icon too, and a 72%-size glyph reads as dimmed. */}
      <nav
        className="coach-mobile-nav cx-chrome cx-chrome-nav"
        style={{
          position:        'fixed',
          bottom:          0,
          left:            0,
          right:           0,
          height:          68,
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
              aria-current={active ? 'page' : undefined}
              className="cx-nav-item"
              style={{
                flex:           1,
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            4,
                color:          active ? 'var(--color-accent)' : 'var(--color-text-hint)',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  position:        'relative',
                  width:           46,
                  height:          28,
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                }}
              >
                <span
                  className="cx-nav-pill"
                  aria-hidden="true"
                  style={{
                    position:        'absolute',
                    inset:           0,
                    borderRadius:    999,
                    backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                    transform:       active ? 'scale(1)' : 'scale(0.72)',
                  }}
                />
                <Icon size={20} style={{ position: 'relative' }} />
                {badge > 0 && (
                  <span
                    className="cx-pop"
                    style={{
                      position:        'absolute',
                      top:             1,
                      right:           5,
                      width:           7,
                      height:          7,
                      borderRadius:    '50%',
                      backgroundColor: '#ef4444',
                      display:         'block',
                    }}
                  />
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1, letterSpacing: '-0.005em' }}>
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
          aria-expanded={moreOpen}
          className="cx-nav-item"
          style={{
            flex:           1,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            4,
            color:          moreOpen ? 'var(--color-accent)' : 'var(--color-text-hint)',
            background:     'none',
            border:         'none',
            cursor:         'pointer',
          }}
        >
          <div
            style={{
              position:        'relative',
              width:           46,
              height:          28,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
            }}
          >
            <span
              className="cx-nav-pill"
              aria-hidden="true"
              style={{
                position:        'absolute',
                inset:           0,
                borderRadius:    999,
                backgroundColor: moreOpen ? 'var(--color-accent-dim)' : 'transparent',
                transform:       moreOpen ? 'scale(1)' : 'scale(0.72)',
              }}
            />
            <span style={{ position: 'relative', display: 'flex' }}>
              {moreOpen ? <X size={20} /> : <MoreHorizontal size={20} />}
            </span>
          </div>
          <span style={{ fontSize: 10, fontWeight: moreOpen ? 700 : 500, lineHeight: 1, letterSpacing: '-0.005em' }}>More</span>
        </button>
      </nav>

      {/* ══════════════════════════════════════════════════════
          MOBILE — "More" bottom sheet overlay
          ══════════════════════════════════════════════════════ */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="cx-backdrop"
            style={{
              position:        'fixed',
              inset:           0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter:  'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex:          48,
            }}
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet */}
          <div
            className="cx-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More"
            style={{
              position:        'fixed',
              bottom:          68,
              left:            0,
              right:           0,
              backgroundColor: 'var(--color-surface-1)',
              borderTop:       '1px solid var(--color-border)',
              borderRadius:    '24px 24px 0 0',
              boxShadow:       'var(--cx-shadow-lg)',
              padding:         '8px 16px 16px',
              zIndex:          49,
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                width:           40,
                height:          4,
                borderRadius:    999,
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
                  className="cx-press"
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             14,
                    padding:         '12px 16px',
                    borderRadius:    14,
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
                className="cx-press"
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  gap:             14,
                  padding:         '12px 16px',
                  borderRadius:    14,
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
