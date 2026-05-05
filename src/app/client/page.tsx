export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getClientId,
  getTodayTemplate,
  type TodayTemplate,
} from './workouts/actions'

const checkInDone = false

const stats = [
  { label: 'Workouts Logged', value: '3 / 4', trend: '↑', up: true },
  { label: 'Calories avg', value: '2,340 kcal', trend: '↑', up: true },
  { label: 'Avg Sleep', value: '7.2 hrs', trend: '↓', up: false },
  { label: 'Body Weight', value: '84.2 kg', trend: '↓', up: true },
]

const recentWorkouts = [
  { name: 'Upper A', date: 'Mon May 4', duration: '52 min', exercises: 6 },
  { name: 'Pull Day', date: 'Sat May 2', duration: '48 min', exercises: 7 },
  { name: 'Push Day', date: 'Thu Apr 30', duration: '44 min', exercises: 6 },
]

async function resolveTodayTemplate(): Promise<TodayTemplate | null> {
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
      return null
    }
  }

  if (!email) return null

  const client = await getClientId(email)
  if (!client) return null
  return getTodayTemplate(client.id)
}

export default async function ClientHomePage() {
  const today = await resolveTodayTemplate()

  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '52px 20px 20px' }}
      >
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>
            Good morning, Alex
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Week of May 5 · Day 2 of 7
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
          AM
        </div>
      </div>

      {/* Today's Workout widget */}
      <div style={{ padding: '0 16px 16px' }}>
        <TodayWorkoutWidget today={today} />
      </div>

      {/* Weekly Check-in CTA */}
      <div style={{ padding: '0 16px 16px' }}>
        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '4px',
              background: checkInDone
                ? '#22c55e'
                : 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e)',
            }}
          />
          <div style={{ padding: '16px 18px 18px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Weekly Check-in
              </span>
              {!checkInDone ? (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.12)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  Due today
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.12)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  Submitted ✓
                </span>
              )}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
              Tell your coach how the week went.
            </p>
            {!checkInDone ? (
              <Link
                href="/check-in"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-accent)',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '11px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Start Check-in →
              </Link>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  color: '#22c55e',
                  fontSize: '14px',
                  fontWeight: 500,
                  padding: '11px',
                  backgroundColor: 'rgba(34,197,94,0.06)',
                  borderRadius: '10px',
                }}
              >
                Great work — check-in complete 🎉
              </div>
            )}
          </div>
        </div>
      </div>

      {/* This Week at a Glance */}
      <section style={{ padding: '0 16px 16px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          This Week
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                backgroundColor: 'var(--color-surface-2)',
                borderRadius: '12px',
                padding: '14px 14px 12px',
                border: '1px solid var(--color-border)',
              }}
            >
              <p style={{ fontSize: '11px', color: 'var(--color-text-hint)', margin: '0 0 4px', fontWeight: 500 }}>
                {s.label}
              </p>
              <div className="flex items-baseline gap-1.5">
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.1 }}>
                  {s.value}
                </span>
                <span style={{ fontSize: '14px', color: s.up ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  {s.trend}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Workouts */}
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
          {recentWorkouts.map((w) => (
            <div
              key={w.name + w.date}
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
                {w.date}
              </p>
              <div className="flex gap-2">
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    backgroundColor: 'var(--color-surface-3)',
                    borderRadius: '6px',
                    padding: '2px 7px',
                  }}
                >
                  {w.duration}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    backgroundColor: 'var(--color-surface-3)',
                    borderRadius: '6px',
                    padding: '2px 7px',
                  }}
                >
                  {w.exercises} exercises
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Coach Message */}
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
              <p style={{ fontSize: '11px', color: 'var(--color-text-hint)', margin: '2px 0 0' }}>
                2 days ago
              </p>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
            &ldquo;Great work this week. Keep protein above 180g on training days.&rdquo;
          </p>
        </div>
      </section>
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
