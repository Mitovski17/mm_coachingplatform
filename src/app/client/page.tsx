export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getClientId,
  getTodayTemplate,
  type TodayTemplate,
} from './workouts/actions'
import { getDayLogs, type DayLog } from './nutrition/actions'
import { getHomeStats, type HomeStats } from './home-actions'
import { getNextSundayMidnight } from '@/lib/checkin-window'
import CheckinWidget from './CheckinWidget'

function getGreeting(): string {
  const hour = new Date().getUTCHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getWeekLabel(): string {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - daysSinceMonday)
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getCurrentDayOfWeek(): number {
  const day = new Date().getUTCDay()
  return day === 0 ? 7 : day
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatWorkoutDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function daysAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

async function resolveClientAndData(): Promise<{
  today: TodayTemplate | null
  logs: DayLog[]
  stats: HomeStats | null
}> {
  let email: string | null = null

  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    const raw = cookieStore.get('dev_mock_email')?.value
    if (raw) email = decodeURIComponent(raw)
  }

  if (!email) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      email = user?.email ?? null
    } catch {
      return { today: null, logs: [], stats: null }
    }
  }

  if (!email) return { today: null, logs: [], stats: null }

  const client = await getClientId(email)
  if (!client) return { today: null, logs: [], stats: null }

  const isoToday = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const [today, logs, stats] = await Promise.all([
    getTodayTemplate(client.id),
    getDayLogs(client.id, isoToday),
    getHomeStats(email, client.id),
  ])

  return { today, logs, stats }
}

export default async function ClientHomePage() {
  const { today, logs, stats } = await resolveClientAndData()

  const greeting = getGreeting()
  const clientName = stats?.clientName ?? 'there'
  const initials = stats?.clientName ? getInitials(stats.clientName) : '?'

  const workoutsLogged = stats?.workoutsLogged ?? 0
  const workoutsTarget = stats?.workoutsTarget ?? 0
  const workoutsOnTrack = workoutsTarget > 0 && workoutsLogged >= workoutsTarget

  const sleepQuality = stats?.sleepQuality ?? null
  const sleepColor =
    sleepQuality == null
      ? 'var(--color-text-primary)'
      : sleepQuality >= 7
      ? '#22c55e'
      : sleepQuality >= 5
      ? '#f59e0b'
      : '#ef4444'

  const bodyWeight = stats?.bodyWeight ?? null
  const bodyWeightTrend = stats?.bodyWeightTrend ?? null

  const caloriesAvg = stats?.caloriesAvg ?? null
  const caloriesTrend = stats?.caloriesTrend ?? null

  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '52px 20px 20px' }}
      >
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>
            {greeting}, {clientName}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Week of {getWeekLabel()} · Day {getCurrentDayOfWeek()} of 7
          </p>
        </div>
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: 'var(--color-surface-3)',
            color: 'var(--color-text-muted)',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {initials}
        </div>
      </div>

      {/* Today's Workout widget */}
      <div style={{ padding: '0 16px 16px' }}>
        <TodayWorkoutWidget today={today} />
      </div>

      {/* Today's Nutrition widget */}
      <div style={{ padding: '0 16px 16px' }}>
        <TodayNutritionWidget logs={logs} />
      </div>

      {/* Weekly Check-in CTA */}
      <div style={{ padding: '0 16px 16px' }}>
        <CheckinWidget
          submitted={stats?.checkinSubmittedThisWeek ?? false}
          nextSundayMs={getNextSundayMidnight().getTime()}
        />
      </div>

      {/* This Week at a Glance */}
      <section style={{ padding: '0 16px 16px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          This Week
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* Workouts */}
          <StatCard
            label="Workouts"
            value={`${workoutsLogged} / ${workoutsTarget}`}
            trend={workoutsTarget > 0 ? (workoutsOnTrack ? '↑' : '↓') : ''}
            trendColor={workoutsTarget > 0 ? (workoutsOnTrack ? '#22c55e' : '#f59e0b') : 'transparent'}
          />
          {/* Calories */}
          <StatCard
            label="Calories avg"
            value={caloriesAvg != null ? `${caloriesAvg.toLocaleString()} kcal` : '—'}
            trend={caloriesTrend === 'up' ? '↑' : caloriesTrend === 'down' ? '↓' : ''}
            trendColor={caloriesTrend === 'up' ? '#22c55e' : caloriesTrend === 'down' ? '#ef4444' : 'transparent'}
          />
          {/* Sleep Quality */}
          <StatCard
            label="Sleep Quality"
            value={sleepQuality != null ? `${sleepQuality} / 10` : '—'}
            trend=""
            trendColor="transparent"
            valueColor={sleepColor}
          />
          {/* Body Weight */}
          <StatCard
            label="Body Weight"
            value={bodyWeight != null ? `${bodyWeight} kg` : '—'}
            trend={bodyWeightTrend === 'up' ? '↑' : bodyWeightTrend === 'down' ? '↓' : ''}
            trendColor={bodyWeightTrend === 'down' ? '#22c55e' : bodyWeightTrend === 'up' ? '#ef4444' : 'transparent'}
          />
        </div>
      </section>

      {/* Recent Workouts */}
      {stats?.recentWorkouts && stats.recentWorkouts.length > 0 && (
        <section style={{ padding: '0 0 16px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '16px' }}>
            Recent Workouts
          </h2>
          <div
            className="flex gap-3"
            style={{
              overflowX: 'auto',
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingBottom: '4px',
              scrollbarWidth: 'none',
            }}
          >
            {stats.recentWorkouts.map((w) => (
              <div
                key={w.id}
                style={{
                  flexShrink: 0,
                  width: '180px',
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '14px',
                }}
              >
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                  {w.name}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--color-text-hint)', margin: '0 0 8px' }}>
                  {formatWorkoutDate(w.performedAt)}
                </p>
                {w.durationMinutes != null && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                      backgroundColor: 'var(--color-surface-3)',
                      borderRadius: '6px',
                      padding: '2px 7px',
                    }}
                  >
                    {w.durationMinutes} min
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Coach Message */}
      {stats?.coachNote && (
        <section style={{ padding: '0 16px 16px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Coach
          </h2>
          <div
            style={{
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              padding: '16px',
            }}
          >
            <div className="flex items-center gap-3" style={{ marginBottom: '10px' }}>
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent-dim)',
                  color: 'var(--color-accent)',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                MC
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: 0 }}>
                  Your coach left a note:
                </p>
                {stats.coachNoteDate && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-hint)', margin: '2px 0 0' }}>
                    {daysAgo(stats.coachNoteDate)}
                  </p>
                )}
              </div>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
              &ldquo;{stats.coachNote}&rdquo;
            </p>
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  trend,
  trendColor,
  valueColor,
}: {
  label: string
  value: string
  trend: string
  trendColor: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '12px',
        padding: '14px 14px 12px',
        border: '1px solid var(--color-border)',
      }}
    >
      <p style={{ fontSize: '11px', color: 'var(--color-text-hint)', margin: '0 0 4px', fontWeight: 500 }}>
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <span style={{ fontSize: '18px', fontWeight: 700, color: valueColor ?? 'var(--color-text-primary)', lineHeight: 1.1 }}>
          {value}
        </span>
        {trend && (
          <span style={{ fontSize: '14px', color: trendColor, fontWeight: 600 }}>
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

function TodayNutritionWidget({ logs }: { logs: DayLog[] }) {
  const totals = logs.reduce(
    (acc, l) => ({
      calories: acc.calories + l.calories,
      proteinG: acc.proteinG + l.proteinG,
      carbsG: acc.carbsG + l.carbsG,
      fatG: acc.fatG + l.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  )

  return (
    <Link
      href="/client/nutrition"
      style={{
        display: 'block',
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        padding: '14px 16px',
        textDecoration: 'none',
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <p
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Today&apos;s Nutrition
        </p>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {Math.round(totals.calories)} kcal
        </span>
      </div>
      {logs.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', margin: 0 }}>
          No meals logged today
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <MiniMacro label="Protein" value={Math.round(totals.proteinG)} color="#3b82f6" />
          <MiniMacro label="Carbs" value={Math.round(totals.carbsG)} color="#f97316" />
          <MiniMacro label="Fat" value={Math.round(totals.fatG)} color="#ef4444" />
        </div>
      )}
    </Link>
  )
}

function MiniMacro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: 'var(--color-text-hint)', fontWeight: 600, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </p>
      <p style={{ fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 700, margin: '0 0 4px' }}>
        {value}g
      </p>
      <div style={{ height: 3, backgroundColor: 'var(--color-surface-3)', borderRadius: 999 }}>
        <div style={{ height: '100%', width: value > 0 ? '100%' : '0%', backgroundColor: color, borderRadius: 999 }} />
      </div>
    </div>
  )
}

function TodayWorkoutWidget({ today }: { today: TodayTemplate | null }) {
  if (!today) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '14px 16px',
        }}
      >
        <p
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            margin: '0 0 4px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Today
        </p>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Rest day — recovery matters
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: '16px',
        padding: '16px 18px',
      }}
    >
      <p
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          margin: '0 0 4px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        Today&apos;s Workout
      </p>
      <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
        {today.templateName}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
        {today.exerciseCount} {today.exerciseCount === 1 ? 'exercise' : 'exercises'}
      </p>
      <Link
        href={`/client/workouts/session?templateId=${encodeURIComponent(today.templateId)}&templateName=${encodeURIComponent(today.templateName)}`}
        style={{
          display: 'block',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          color: '#000000',
          borderRadius: '10px',
          padding: '11px',
          fontSize: '14px',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        Start Workout
      </Link>
    </div>
  )
}
