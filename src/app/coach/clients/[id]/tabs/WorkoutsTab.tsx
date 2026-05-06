'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import type { WorkoutSession, WorkoutSetEntry } from '../actions'

const cardBase: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-1)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  padding: 16,
}

function dateOnly(d: Date): string {
  return d.toISOString().split('T')[0]
}

function dayLabel(d: Date): string {
  return format(d, 'EEE')
}

function Heatmap({ sessions }: { sessions: WorkoutSession[] }) {
  // 28 days, ending today, grouped into weeks of 7 (Mon-Sun)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find the Monday 4 weeks back
  const day = today.getDay() // 0=Sun
  const diffToMonday = day === 0 ? -6 : 1 - day
  const lastMonday = new Date(today)
  lastMonday.setDate(today.getDate() + diffToMonday)
  const startMonday = new Date(lastMonday)
  startMonday.setDate(lastMonday.getDate() - 21) // 3 weeks before this week's Mon = 4 rows total

  const sessionDates = new Set(
    sessions.map((s) => dateOnly(new Date(s.performedAt)))
  )

  const rows: { weekLabel: string; cells: { date: Date; key: string }[] }[] = []
  for (let w = 0; w < 4; w++) {
    const cells: { date: Date; key: string }[] = []
    for (let d = 0; d < 7; d++) {
      const cell = new Date(startMonday)
      cell.setDate(startMonday.getDate() + w * 7 + d)
      cells.push({ date: cell, key: dateOnly(cell) })
    }
    rows.push({ weekLabel: format(cells[0].date, 'MMM d'), cells })
  }

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div>
      <div
        className="grid"
        style={{
          gridTemplateColumns: '60px repeat(7, 16px)',
          gap: 4,
          alignItems: 'center',
        }}
      >
        <div />
        {dayHeaders.map((h) => (
          <div
            key={h}
            className="text-center"
            style={{
              fontSize: 9,
              color: 'var(--color-text-hint)',
              fontWeight: 500,
            }}
          >
            {h[0]}
          </div>
        ))}
        {rows.map((row) => (
          <div key={row.weekLabel} className="contents">
            <div
              className="text-xs"
              style={{
                color: 'var(--color-text-hint)',
                fontSize: 10,
              }}
            >
              {row.weekLabel}
            </div>
            {row.cells.map(({ date, key }) => {
              const isFuture = date > today
              const hasSession = sessionDates.has(key)
              let bg = 'var(--color-surface-3)'
              if (hasSession) bg = '#22c55e'
              else if (isFuture) bg = 'var(--color-surface-2)'
              return (
                <div
                  key={key}
                  title={`${format(date, 'MMM d')}${
                    hasSession ? ' — workout logged' : ''
                  }`}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    backgroundColor: bg,
                    opacity: isFuture && !hasSession ? 0.5 : 1,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function SetsBreakdown({ sets }: { sets: WorkoutSetEntry[] }) {
  // Group by exercise
  const byExercise = new Map<string, WorkoutSetEntry[]>()
  for (const s of sets) {
    const arr = byExercise.get(s.exerciseId) ?? []
    arr.push(s)
    byExercise.set(s.exerciseId, arr)
  }

  if (byExercise.size === 0) {
    return (
      <div
        className="text-sm py-2"
        style={{ color: 'var(--color-text-hint)' }}
      >
        No exercise data
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 mt-3">
      {Array.from(byExercise.entries()).map(([exId, exSets]) => {
        const setsLabel = exSets
          .map((st) => {
            const w = st.weightKg ?? 0
            const r = st.reps ?? 0
            return `${w}kg×${r}`
          })
          .join(', ')
        return (
          <div
            key={exId}
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {exSets[0].exerciseName}
            </span>{' '}
            — {exSets.length} sets: {setsLabel}
          </div>
        )
      })}
    </div>
  )
}

function SessionCard({ session }: { session: WorkoutSession }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        borderBottom: '1px solid var(--color-border)',
        padding: '12px 0',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="min-w-0">
          <div
            className="font-medium truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {session.name}
          </div>
          <div
            className="text-xs mt-0.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {session.durationMinutes ?? 0} min · {session.setCount} sets ·{' '}
            {Math.round(session.totalVolumeKg)}kg total
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {format(new Date(session.performedAt), 'MMM d')}
          </span>
          <span
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              color: 'var(--color-text-hint)',
              display: 'inline-block',
            }}
          >
            ▾
          </span>
        </div>
      </button>
      {open && <SetsBreakdown sets={session.sets} />}
    </div>
  )
}

export default function WorkoutsTab({
  workoutHistory,
}: {
  workoutHistory: WorkoutSession[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <div style={cardBase}>
        <div
          className="text-xs uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
        >
          Training Activity — Last 4 Weeks
        </div>
        <Heatmap sessions={workoutHistory} />
      </div>

      <div style={cardBase}>
        <div className="flex items-center justify-between mb-2">
          <div
            className="text-xs uppercase tracking-wide"
            style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
          >
            Session History
          </div>
          <div
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {workoutHistory.length}{' '}
            {workoutHistory.length === 1 ? 'session' : 'sessions'}
          </div>
        </div>
        {workoutHistory.length === 0 ? (
          <div
            className="text-sm text-center py-6"
            style={{ color: 'var(--color-text-hint)' }}
          >
            No sessions logged yet.
          </div>
        ) : (
          <div>
            {workoutHistory.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
