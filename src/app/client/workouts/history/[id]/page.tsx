export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import { getSessionDetail } from '../../actions'

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#ef4444',
  back: '#3b82f6',
  shoulders: '#f59e0b',
  core: '#06b6d4',
  cardio: '#ec4899',
  biceps: '#ef4444',
  triceps: '#f97316',
  quads: '#14b8a6',
  hamstrings: '#10b981',
  glutes: '#ec4899',
  calves: '#84cc16',
  abductors: '#8b5cf6',
  adductors: '#d946ef',
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let session
  try {
    session = await getSessionDetail(id)
  } catch {
    notFound()
  }

  const date = format(new Date(session.performedAt), 'EEEE, MMMM d, yyyy')

  let totalSets = 0
  let totalVolume = 0
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      totalSets += 1
      const w = s.weightKg ?? 0
      const r = s.reps ?? 0
      totalVolume += w * r
    }
  }

  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 24px' }}>
      <div style={{ padding: '52px 16px 8px' }}>
        <Link
          href="/client/workouts"
          className="inline-flex items-center gap-1"
          style={{
            fontSize: 13,
            color: 'var(--color-text-muted)',
            textDecoration: 'none',
            marginBottom: 14,
          }}
        >
          <ArrowLeft size={14} />
          Back
        </Link>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          {session.name}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>{date}</p>
      </div>

      {/* Stats */}
      <div style={{ padding: '0 16px', marginTop: 16 }}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: 14,
          }}
        >
          <Stat label="Duration" value={session.durationMinutes !== null ? `${session.durationMinutes} min` : '—'} />
          <Stat label="Sets" value={String(totalSets)} />
          <Stat
            label="Volume"
            value={
              totalVolume > 0
                ? `${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`
                : '—'
            }
          />
        </div>
      </div>

      {/* Notes */}
      {session.notes && (
        <div style={{ padding: '16px 16px 0' }}>
          <div
            style={{
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 14,
              padding: 14,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                margin: '0 0 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Notes
            </p>
            <p
              style={{
                fontSize: 14,
                color: 'var(--color-text-secondary)',
                margin: 0,
                fontStyle: 'italic',
                lineHeight: 1.5,
              }}
            >
              {session.notes}
            </p>
          </div>
        </div>
      )}

      {/* Exercises */}
      <div style={{ padding: '16px 16px 0' }}>
        {session.exercises.map((ex) => {
          const muscleColor = MUSCLE_COLORS[ex.muscleGroup] ?? '#6b7280'
          return (
            <div
              key={ex.exerciseId}
              style={{
                backgroundColor: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 16,
                marginBottom: 12,
                overflow: 'hidden',
              }}
            >
              <div
                className="flex items-center gap-2"
                style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}
              >
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {ex.exerciseName}
                </p>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--color-surface-2)',
                    color: muscleColor,
                    textTransform: 'capitalize',
                  }}
                >
                  {ex.muscleGroup}
                </span>
              </div>
              <div>
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: '60px 1fr 1fr',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--color-text-hint)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <span>Set</span>
                  <span>Weight</span>
                  <span>Reps</span>
                </div>
                {ex.sets.map((s, i) => (
                  <div
                    key={s.setNumber}
                    className="grid"
                    style={{
                      gridTemplateColumns: '60px 1fr 1fr',
                      fontSize: 14,
                      color: 'var(--color-text-secondary)',
                      padding: '10px 16px',
                      backgroundColor:
                        i % 2 === 0 ? 'var(--color-surface-1)' : 'var(--color-surface-2)',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      {s.setNumber}
                    </span>
                    <span>{s.weightKg !== null ? `${s.weightKg} kg` : '—'}</span>
                    <span>{s.reps !== null ? s.reps : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--color-text-hint)',
          margin: '0 0 2px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {value}
      </p>
    </div>
  )
}
