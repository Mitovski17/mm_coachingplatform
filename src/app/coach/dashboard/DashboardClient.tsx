'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Bell, Search, X, UserPlus } from 'lucide-react'
import ClientCard from './ClientCard'

export type ClientData = {
  id: string
  name: string
  initials: string
  avatarColor: string
  goal: string | null
  goalKey: string | null
  weekNumber: number
  weight: string | null
  weightUnit: string | null
  badgeType: 'submitted' | 'due_today' | 'overdue' | 'active' | 'none'
  lastCheckinLabel: string | null
  lastActiveLabel: string | null
  lastActiveIso: string | null
  compliancePct: number
}

type FilterKey = 'all' | 'submitted' | 'due' | 'no_activity' | string

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'New submission' },
  { key: 'due', label: 'Check-in due' },
  { key: 'no_activity', label: 'No activity' },
]

export default function DashboardClient({
  clients,
  pendingNames,
}: {
  clients: ClientData[]
  pendingNames: string[]
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [alertDismissed, setAlertDismissed] = useState(false)

  // Unique goals for goal filter tabs
  const goalTabs = useMemo(() => {
    const seen = new Set<string>()
    const result: { key: string; label: string }[] = []
    for (const c of clients) {
      if (c.goalKey && c.goal && !seen.has(c.goalKey)) {
        seen.add(c.goalKey)
        result.push({ key: `goal:${c.goalKey}`, label: c.goal })
      }
    }
    return result
  }, [clients])

  const allTabs = [...FILTER_TABS, ...goalTabs]

  // Filtered clients
  const filtered = useMemo(() => {
    let list = clients

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q))
    }

    if (filter === 'submitted') {
      list = list.filter((c) => c.badgeType === 'submitted')
    } else if (filter === 'due') {
      list = list.filter((c) => c.badgeType === 'due_today' || c.badgeType === 'overdue' || c.badgeType === 'none')
    } else if (filter === 'no_activity') {
      list = list.filter((c) => !c.lastActiveIso ||
        (Date.now() - new Date(c.lastActiveIso).getTime()) > 14 * 86_400_000)
    } else if (filter.startsWith('goal:')) {
      const goalKey = filter.slice(5)
      list = list.filter((c) => c.goalKey === goalKey)
    }

    return list
  }, [clients, search, filter])

  const counts: Record<string, number> = useMemo(() => ({
    all: clients.length,
    submitted: clients.filter((c) => c.badgeType === 'submitted').length,
    due: clients.filter((c) => ['due_today', 'overdue', 'none'].includes(c.badgeType)).length,
    no_activity: clients.filter(
      (c) => !c.lastActiveIso || (Date.now() - new Date(c.lastActiveIso).getTime()) > 14 * 86_400_000
    ).length,
    ...Object.fromEntries(goalTabs.map((t) => [t.key, clients.filter((c) => `goal:${c.goalKey}` === t.key).length])),
  }), [clients, goalTabs])

  const submittedCount = counts['submitted'] ?? 0
  const needAttention = submittedCount

  const showAlert = needAttention > 0 && !alertDismissed

  return (
    <div className="coach-page" style={{ minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div className="coach-dash-header" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>

        {/* Title row (on mobile this becomes its own row via .coach-dash-header-row) */}
        <div className="coach-dash-header-row" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-hint)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Your Clients
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>
              {clients.length} active
              {needAttention > 0 && (
                <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-accent)', marginLeft: 10 }}>
                  · {needAttention} need attention
                </span>
              )}
            </h1>
          </div>

          {/* Add client button — always visible */}
          <Link
            href="/coach/clients/new"
            style={{
              display:         'inline-flex',
              alignItems:      'center',
              gap:             7,
              backgroundColor: 'var(--color-accent)',
              color:           '#ffffff',
              fontSize:        13,
              fontWeight:      700,
              borderRadius:    8,
              padding:         '9px 16px',
              textDecoration:  'none',
              flexShrink:      0,
              whiteSpace:      'nowrap',
            }}
          >
            <UserPlus size={14} />
            Add client
          </Link>
        </div>

        {/* Search — full-width on mobile, fixed on desktop */}
        <div className="coach-search-wrap" style={{ position: 'relative', flexShrink: 0 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-hint)', pointerEvents: 'none' }} />
          <input
            suppressHydrationWarning
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background:   'var(--color-surface-1)',
              border:       '1px solid var(--color-border)',
              borderRadius: 8,
              padding:      '8px 12px 8px 34px',
              fontSize:     13,
              color:        'var(--color-text-primary)',
              outline:      'none',
              width:        200,
            }}
          />
        </div>
      </div>

      {/* ── Alert banner ── */}
      {showAlert && (
        <div
          style={{
            marginBottom: 20,
            backgroundColor: 'rgba(255,92,0,0.07)',
            border: '1px solid rgba(255,92,0,0.18)',
            borderRadius: 10,
            padding: '13px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Bell size={16} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', flex: 1 }}>
            <strong style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {submittedCount} new check-in{submittedCount > 1 ? 's' : ''} to review.
            </strong>
            {' '}{pendingNames.slice(0, 2).join(', ')}{pendingNames.length > 2 ? ` and ${pendingNames.length - 2} more.` : '.'}
          </span>
          <Link
            href="/coach/check-ins"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-accent)',
              border: '1.5px solid var(--color-accent)',
              borderRadius: 7,
              padding: '6px 14px',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            Review
          </Link>
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setAlertDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', padding: 2, flexShrink: 0 }}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div
        className="coach-tabs-scroll"
        style={{
          display:      'flex',
          gap:          6,
          marginBottom: 20,
          flexWrap:     'wrap',
        }}
      >
        {allTabs.map((tab) => {
          const count = counts[tab.key] ?? 0
          const active = filter === tab.key
          const isSubmitted = tab.key === 'submitted'
          const isDue = tab.key === 'due'

          return (
            <button
              suppressHydrationWarning
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                transition: 'all 0.12s ease',
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    backgroundColor: isSubmitted
                      ? 'rgba(34,197,94,0.15)'
                      : isDue
                      ? 'rgba(255,92,0,0.15)'
                      : active
                      ? 'var(--color-accent-dim)'
                      : 'var(--color-surface-3)',
                    color: isSubmitted
                      ? '#22c55e'
                      : isDue
                      ? 'var(--color-accent)'
                      : active
                      ? 'var(--color-accent)'
                      : 'var(--color-text-hint)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Card grid ── */}
      {clients.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 14, color: 'var(--color-text-hint)', margin: 0 }}>
            No clients yet. Add one to get started.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ fontSize: 14, color: 'var(--color-text-hint)', margin: 0 }}>
            No clients match this filter.
          </p>
        </div>
      ) : (
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
            gap:                 12,
          }}
        >
          {filtered.map((c) => (
            <ClientCard key={c.id} client={c} />
          ))}
        </div>
      )}
    </div>
  )
}
