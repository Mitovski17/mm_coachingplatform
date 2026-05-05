'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ChevronRight, Dumbbell } from 'lucide-react'
import type { TodayTemplate, HistorySession } from './actions'

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#ef4444',
  back: '#3b82f6',
  legs: '#22c55e',
  shoulders: '#f59e0b',
  arms: '#a855f7',
  core: '#06b6d4',
  cardio: '#ec4899',
}

export default function WorkoutsClient({
  todayTemplate,
  history,
}: {
  todayTemplate: TodayTemplate | null
  history: HistorySession[]
}) {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today')

  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      <div
        className="flex items-center justify-between"
        style={{ padding: '52px 20px 20px' }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          Workouts
        </h1>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-border)',
          margin: '0 16px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('today')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'today' ? '2px solid #ffffff' : '2px solid transparent',
            color: activeTab === 'today' ? '#ffffff' : 'var(--color-text-muted)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: -1,
          }}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid #ffffff' : '2px solid transparent',
            color: activeTab === 'history' ? '#ffffff' : 'var(--color-text-muted)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: -1,
          }}
        >
          History
        </button>
      </div>

      {activeTab === 'today' && (
        <div style={{ padding: '16px 16px 16px' }}>
          <TodayWorkoutCard today={todayTemplate} />
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ padding: '16px 16px 8px' }}>
          <HistoryList sessions={history} />
        </div>
      )}
    </div>
  )
}

function TodayWorkoutCard({ today }: { today: TodayTemplate | null }) {
  if (!today) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: '20px',
          padding: '20px',
        }}
      >
        <p
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            margin: '0 0 6px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Today
        </p>
        <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
          Rest Day
        </p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
          Recovery is part of the program.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: '20px',
        padding: '20px',
      }}
    >
      <p
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          margin: '0 0 6px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Today&apos;s Workout
      </p>
      <p
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          margin: '0 0 4px',
          lineHeight: 1.2,
        }}
      >
        {today.templateName}
      </p>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
        {today.exerciseCount} {today.exerciseCount === 1 ? 'exercise' : 'exercises'}
      </p>
      {today.muscleGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5" style={{ marginBottom: '16px' }}>
          {today.muscleGroups.map((g) => (
            <span
              key={g}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: '999px',
                backgroundColor: `${MUSCLE_COLORS[g] ?? '#6b7280'}20`,
                color: MUSCLE_COLORS[g] ?? '#9ca3af',
                textTransform: 'capitalize',
              }}
            >
              {g}
            </span>
          ))}
        </div>
      )}
      <Link
        href={`/client/workouts/session?templateId=${encodeURIComponent(today.templateId)}&templateName=${encodeURIComponent(today.templateName)}`}
        style={{
          display: 'block',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          color: '#000000',
          borderRadius: '12px',
          padding: '13px',
          fontSize: '15px',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        Start Workout
      </Link>
    </div>
  )
}

function HistoryList({ sessions }: { sessions: HistorySession[] }) {
  if (sessions.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px dashed var(--color-border)',
          borderRadius: '14px',
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: 'var(--color-surface-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
          }}
        >
          <Dumbbell size={20} style={{ color: 'var(--color-text-hint)' }} />
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
          No workouts logged yet. Start your first session above.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      {sessions.map((s, i) => {
        const date = format(new Date(s.performedAt), 'EEE, MMM d')
        const parts: string[] = []
        if (s.durationMinutes !== null) parts.push(`${s.durationMinutes} min`)
        parts.push(`${s.setCount} ${s.setCount === 1 ? 'set' : 'sets'}`)
        if (s.totalVolumeKg > 0) {
          parts.push(`${s.totalVolumeKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`)
        }
        return (
          <Link
            key={s.id}
            href={`/client/workouts/history/${s.id}`}
            className="flex items-center gap-3"
            style={{
              padding: '14px 16px',
              borderBottom: i < sessions.length - 1 ? '1px solid var(--color-border)' : 'none',
              textDecoration: 'none',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  margin: '0 0 2px',
                }}
              >
                {s.name}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-hint)', margin: 0 }}>
                {date} · {parts.join(' · ')}
              </p>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
          </Link>
        )
      })}
    </div>
  )
}
