'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Dumbbell } from 'lucide-react'
import { useWorkoutSession } from '@/lib/WorkoutSessionContext'

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
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
      style={{
        position: 'fixed',
        bottom: 'calc(68px + env(safe-area-inset-bottom) + 10px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 18px',
        backgroundColor: 'var(--color-accent)',
        color: '#fff',
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <Dumbbell size={15} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
        {session.templateName}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>
        {fmt(elapsed)}
      </span>
      {rest.active && (
        <>
          <span style={{ opacity: 0.5, marginLeft: 2 }}>·</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>
            REST {fmt(rest.secondsLeft)}
          </span>
        </>
      )}
    </button>
  )
}
