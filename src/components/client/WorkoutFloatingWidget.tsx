'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Dumbbell } from 'lucide-react'
import { useWorkoutSession } from '@/lib/WorkoutSessionContext'

function fmt(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

export default function WorkoutFloatingWidget() {
  const { session, elapsed } = useWorkoutSession()
  const pathname = usePathname()
  const router = useRouter()

  if (!session) return null
  // Hide on the session page itself
  if (pathname.startsWith('/client/workouts/session')) return null

  const rest = session.rest
  const sessionUrl = session.isCustom
    ? '/client/workouts/session?custom=true'
    : `/client/workouts/session?templateDayId=${session.templateDayId}&templateName=${encodeURIComponent(session.templateName)}`

  return (
    <button
      type="button"
      onClick={() => router.push(sessionUrl)}
      className="cx-fab"
      style={{
        position: 'fixed',
        bottom: 'calc(68px + env(safe-area-inset-bottom) + 10px)',
        left: '50%',
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 18px',
        backgroundColor: 'var(--color-accent)',
        color: '#fff',
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 8px 28px -6px rgba(255,92,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
        fontSize: 13,
        fontWeight: 700,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <Dumbbell size={15} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
        {session.templateName}
      </span>
      {/* Tabular figures keep the pill from resizing every second */}
      <span className="cx-num" style={{ fontWeight: 700, opacity: 0.9 }}>
        {fmt(elapsed)}
      </span>
      {rest.active && (
        <>
          <span style={{ opacity: 0.5, marginLeft: 2 }}>·</span>
          <span className="cx-num" style={{ fontWeight: 700, opacity: 0.9 }}>
            REST {fmt(rest.secondsLeft)}
          </span>
        </>
      )}
    </button>
  )
}
