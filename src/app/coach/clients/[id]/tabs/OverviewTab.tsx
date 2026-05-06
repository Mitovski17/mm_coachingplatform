'use client'

import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { AlertTriangle, Dumbbell, ClipboardList, Scale, UtensilsCrossed } from 'lucide-react'
import type {
  Checkin,
  ClientAssignments,
  ClientProfile,
  NutritionSummary,
  RedFlag,
  WorkoutCompliance,
} from '../actions'
import type { TabId } from '../ClientDetailClient'

type Props = {
  profile: ClientProfile
  compliance: WorkoutCompliance
  checkins: Checkin[]
  nutritionSummary: NutritionSummary
  assignments: ClientAssignments
  redFlags: RedFlag[]
  onTabChange: (tab: TabId) => void
}

const cardBase: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-1)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  padding: 16,
}

function todayMondayStr(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

function SectionLabel({
  children,
  color,
}: {
  children: React.ReactNode
  color: string
}) {
  return (
    <div
      className="text-xs uppercase tracking-wide mb-2"
      style={{
        color: 'var(--color-text-hint)',
        fontWeight: 500,
        borderLeft: `2px solid ${color}`,
        paddingLeft: 8,
      }}
    >
      {children}
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: 80, color: 'var(--color-text-hint)' }}
      >
        Not enough data yet
      </div>
    )
  }
  const W = 600
  const H = 80
  const pad = 8
  const min = Math.min(...values) - 1
  const max = Math.max(...values) + 1
  const range = max - min || 1
  const step = (W - pad * 2) / (values.length - 1)
  const pts = values.map((v, i) => {
    const x = pad + i * step
    const y = pad + ((max - v) / range) * (H - pad * 2)
    return [x, y] as const
  })
  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const polygon = `${pad},${H - pad} ${polyline} ${W - pad},${H - pad}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(59,130,246,0.25)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0)" />
        </linearGradient>
      </defs>
      <polygon points={polygon} fill="url(#spark-grad)" />
      <polyline
        points={polyline}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#3b82f6" />
      ))}
      <text
        x={pts[0][0]}
        y={pts[0][1] - 8}
        fontSize={10}
        fill="#B0B0B0"
        textAnchor="middle"
      >
        {values[0].toFixed(1)}
      </text>
      <text
        x={pts[pts.length - 1][0]}
        y={pts[pts.length - 1][1] - 8}
        fontSize={10}
        fill="#fff"
        textAnchor="middle"
      >
        {values[values.length - 1].toFixed(1)}
      </text>
    </svg>
  )
}

export default function OverviewTab({
  compliance,
  checkins,
  nutritionSummary,
  assignments,
  redFlags,
  onTabChange,
}: Props) {
  const latest = checkins[0] ?? null
  const monday = todayMondayStr()

  const target = compliance.targetPerWeek

  // Card 3 — body weight trend
  const weightSeries = checkins
    .slice()
    .reverse()
    .map((c) => c.weight)
    .filter((w): w is number => w !== null)
  const lastWeight = weightSeries[weightSeries.length - 1] ?? null
  const fourBack = weightSeries[weightSeries.length - 5] ?? null
  const weightDelta =
    lastWeight !== null && fourBack !== null ? lastWeight - fourBack : null

  // Trend arrow color: green = going down, red = going up, gray = stable
  const trendColor =
    weightDelta === null || weightDelta === 0
      ? 'var(--color-text-muted)'
      : weightDelta < 0
        ? '#22c55e'
        : '#ef4444'


  const sparkValues = weightSeries.slice(-8)

  return (
    <div className="flex flex-col gap-4">
      {/* Red flags */}
      {redFlags.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, #1a0a0a 0%, #1a1a1a 100%)',
            borderLeft: '4px solid #ef4444',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderLeftWidth: 4,
            borderRadius: 'var(--radius-lg)',
            padding: 14,
          }}
        >
          <div
            className="flex items-center gap-2 mb-2"
            style={{ color: '#ef4444', fontWeight: 600, fontSize: 13 }}
          >
            <AlertTriangle size={18} color="#ef4444" />
            <span>Needs attention</span>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {redFlags.map((f) => (
              <li
                key={f.type}
                className="flex items-center gap-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <span style={{ color: '#ef4444', fontWeight: 700 }}>•</span>
                {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2x2 stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Workouts card */}
        <button
          onClick={() => onTabChange('workouts')}
          style={{
            ...cardBase,
            textAlign: 'left',
            borderTop: '3px solid #3b82f6',
          }}
          className="hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <SectionLabel color="#3b82f6">Workouts This Week</SectionLabel>
            <Dumbbell size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
          </div>
          <div
            className="text-2xl mb-1"
            style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
          >
            {compliance.sessionsThisWeek} / {target || '—'}
          </div>
          <div
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {compliance.sessionsThisMonth} this month ·{' '}
            {compliance.totalSessions} total
          </div>
        </button>

        {/* Check-ins card */}
        <button
          onClick={() => onTabChange('checkins')}
          style={{
            ...cardBase,
            textAlign: 'left',
            borderTop: '3px solid #a855f7',
          }}
          className="hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div
              className="text-xs uppercase tracking-wide"
              style={{
                color: 'var(--color-text-hint)',
                fontWeight: 500,
                borderLeft: '2px solid #a855f7',
                paddingLeft: 8,
              }}
            >
              Last Check-in
            </div>
            <ClipboardList size={16} color="#a855f7" style={{ flexShrink: 0 }} />
          </div>
          <div
            className="text-2xl mb-1"
            style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
          >
            {latest?.performanceRating !== null && latest?.performanceRating !== undefined
              ? `${latest.performanceRating}/10`
              : 'None yet'}
          </div>
          <div
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {latest
              ? formatDistanceToNow(new Date(latest.submittedAt), { addSuffix: true })
              : 'No check-in submitted yet'}
          </div>
        </button>

        {/* Body weight card */}
        <button
          onClick={() => onTabChange('progress')}
          style={{
            ...cardBase,
            textAlign: 'left',
            borderTop: '3px solid rgba(255,255,255,0.25)',
          }}
          className="hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <SectionLabel color="rgba(255,255,255,0.25)">Body Weight</SectionLabel>
            <Scale size={16} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
          </div>
          <div
            className="text-2xl mb-1 flex items-baseline gap-2"
            style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
          >
            <span>{lastWeight !== null ? `${lastWeight} kg` : '—'}</span>
            {weightDelta !== null && weightDelta !== 0 && (
              <span
                className="text-sm"
                style={{ color: trendColor, fontWeight: 500 }}
              >
                {weightDelta < 0 ? '↓' : '↑'}
              </span>
            )}
          </div>
          <div
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {weightDelta !== null
              ? `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} kg in 4 weeks`
              : 'Not enough data yet'}
          </div>
        </button>

        {/* Nutrition card */}
        <button
          onClick={() => onTabChange('nutrition')}
          style={{
            ...cardBase,
            textAlign: 'left',
            borderTop: '3px solid #f97316',
          }}
          className="hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <SectionLabel color="#f97316">Nutrition This Week</SectionLabel>
            <UtensilsCrossed size={16} color="#f97316" style={{ flexShrink: 0 }} />
          </div>
          <div
            className="text-2xl mb-1"
            style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
          >
            {nutritionSummary.loggingDaysThisWeek} / 7 days logged
          </div>
          <div
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Avg {nutritionSummary.last7DaysAvgCalories} kcal ·{' '}
            {nutritionSummary.last7DaysAvgProtein}g protein
          </div>
        </button>
      </div>

      {/* Weight trend sparkline */}
      <div
        style={{
          ...cardBase,
          background: 'linear-gradient(135deg, #1a1a1a 0%, #0f1a2e 100%)',
        }}
      >
        <div
          className="text-xs uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
        >
          Weight Trend
        </div>
        <Sparkline values={sparkValues} />
      </div>

      {/* Current assignments */}
      <div style={cardBase}>
        <div
          className="text-xs uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
        >
          Current Assignments
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Workout Program:{' '}
              {assignments.workoutProgram ? (
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {assignments.workoutProgram.name}
                </span>
              ) : (
                <span style={{ color: 'var(--color-text-hint)' }}>
                  No program assigned
                </span>
              )}
            </span>
            {assignments.workoutProgram ? (
              <Link
                href={`/coach/programs/${assignments.workoutProgram.id}`}
                className="text-xs hover:underline"
                style={{ color: 'var(--color-accent)' }}
              >
                Edit
              </Link>
            ) : (
              <Link
                href="/coach/programs"
                className="text-xs hover:underline"
                style={{ color: 'var(--color-accent)' }}
              >
                + Assign
              </Link>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Training Plan:{' '}
              {assignments.trainingMealPlan ? (
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {assignments.trainingMealPlan.name}
                </span>
              ) : (
                <span style={{ color: 'var(--color-text-hint)' }}>—</span>
              )}
              {' · '}
              Rest Plan:{' '}
              {assignments.restMealPlan ? (
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {assignments.restMealPlan.name}
                </span>
              ) : (
                <span style={{ color: 'var(--color-text-hint)' }}>—</span>
              )}
            </span>
            <Link
              href={`/coach/meal-plans/assignments/${'__client__'}`.replace(
                '__client__',
                ''
              )}
              className="text-xs hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              Manage
            </Link>
          </div>
        </div>
      </div>

      {/* Latest check-in highlights */}
      {latest && (
        <div style={cardBase}>
          <div className="flex items-center justify-between mb-3">
            <div
              className="text-xs uppercase tracking-wide"
              style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
            >
              Latest Check-in
            </div>
            <div
              className="text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {format(new Date(latest.submittedAt), 'MMM d, yyyy')}
            </div>
          </div>
          {latest.biggestWin && (
            <div className="mb-2 text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>💪 Biggest Win: </span>
              <span style={{ color: 'var(--color-text-primary)' }}>
                {latest.biggestWin}
              </span>
            </div>
          )}
          {latest.biggestChallenge && (
            <div className="mb-3 text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>🚧 Biggest Challenge: </span>
              <span style={{ color: 'var(--color-text-primary)' }}>
                {latest.biggestChallenge}
              </span>
            </div>
          )}
          <button
            onClick={() => onTabChange('checkins')}
            className="text-sm hover:underline"
            style={{ color: 'var(--color-accent)' }}
          >
            View all check-ins →
          </button>
        </div>
      )}
    </div>
  )
}
