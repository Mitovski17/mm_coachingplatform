'use client'

import Link from 'next/link'
import type { ClientData } from './DashboardClient'

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({ color }: { color: string }) {
  // Decorative sparkline - slight upward curve
  const pts = [0, 8, 5, 12, 7, 4, 10, 2]
  const max = Math.max(...pts)
  const min = Math.min(...pts)
  const range = max - min || 1
  const W = 56
  const H = 28
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W)
  const ys = pts.map((v) => H - ((v - min) / range) * (H - 6) - 3)
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ')

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <path d={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Badge config ─────────────────────────────────────────────────────────────

const BADGE_CONFIG: Record<ClientData['badgeType'], { dot: string; text: string; label: string }> = {
  submitted: { dot: '#22c55e', text: '#22c55e', label: 'Submitted' },
  due_today:  { dot: 'var(--color-accent)', text: 'var(--color-accent)', label: 'Due today' },
  overdue:    { dot: '#ef4444', text: '#ef4444', label: 'Overdue' },
  active:     { dot: '#6b7280', text: 'var(--color-text-hint)', label: 'Active' },
  none:       { dot: '#6b7280', text: 'var(--color-text-hint)', label: 'No check-in' },
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export default function ClientCard({ client: c }: { client: ClientData }) {
  const badge = BADGE_CONFIG[c.badgeType]

  const sparkColor = c.badgeType === 'submitted' || c.badgeType === 'active'
    ? 'var(--color-accent)'
    : c.badgeType === 'overdue'
    ? '#ef4444'
    : 'var(--color-text-hint)'

  return (
    <Link href={`/coach/clients/${c.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'var(--color-border-strong)'
          el.style.backgroundColor = 'var(--color-surface-2)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'var(--color-border)'
          el.style.backgroundColor = 'var(--color-surface-1)'
        }}
      >
        {/* Orange compliance bar at top */}
        <div style={{ height: 3, backgroundColor: 'var(--color-surface-3)' }}>
          <div
            style={{
              height: '100%',
              width: `${c.compliancePct}%`,
              backgroundColor: c.badgeType === 'overdue' ? '#ef4444' : 'var(--color-accent)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        <div style={{ padding: '16px 18px 18px' }}>
          {/* Top row: avatar + info + badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            {/* Avatar */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: c.avatarColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.02em',
              }}
            >
              {c.initials}
            </div>

            {/* Name + goal + week */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                margin: '0 0 2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {c.name}
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: 0 }}>
                {c.goal ?? 'No goal'}
                {' · '}
                <span>Wk {c.weekNumber}</span>
              </p>
            </div>

            {/* Status badge with dot */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: badge.dot,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: badge.text, whiteSpace: 'nowrap' }}>
                {badge.label}
              </span>
            </div>
          </div>

          {/* Bottom stats row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
            {/* Weight */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-hint)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Weight
              </p>
              {c.weight ? (
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>
                  {c.weight}
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-hint)', marginLeft: 2 }}>
                    {c.weightUnit}
                  </span>
                </p>
              ) : (
                <p style={{ fontSize: 14, color: 'var(--color-text-hint)', margin: 0 }}>—</p>
              )}
            </div>

            {/* Last active */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-hint)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Last Active
              </p>
              <p style={{ fontSize: 14, fontWeight: 500, color: c.lastActiveLabel ? 'var(--color-text-secondary)' : 'var(--color-text-hint)', margin: 0, lineHeight: 1.2 }}>
                {c.lastActiveLabel ?? '—'}
              </p>
            </div>

            {/* Sparkline */}
            <div style={{ flexShrink: 0, opacity: 0.8 }}>
              <Sparkline color={sparkColor} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
