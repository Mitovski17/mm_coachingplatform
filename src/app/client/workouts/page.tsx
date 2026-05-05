'use client'

import { useState } from 'react'
import { Plus, Dumbbell, ChevronRight } from 'lucide-react'

const sessions = [
  { name: 'Pull Day', date: 'Mon May 4', duration: '55 min', exercises: 7, color: '#22c55e' },
  { name: 'Push Day', date: 'Sat May 2', duration: '44 min', exercises: 6, color: '#3b82f6' },
  { name: 'Legs', date: 'Thu Apr 30', duration: '62 min', exercises: 8, color: '#22c55e' },
  { name: 'Upper A', date: 'Tue Apr 28', duration: '50 min', exercises: 6, color: '#3b82f6' },
]

export default function WorkoutsPage() {
  const [tab, setTab] = useState<'log' | 'history'>('history')

  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '52px 20px 20px' }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          Workouts
        </h1>
        <button
          type="button"
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
          aria-label="Log new session"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex"
        style={{
          margin: '0 16px 20px',
          backgroundColor: 'var(--color-surface-2)',
          borderRadius: '10px',
          padding: '3px',
        }}
      >
        {(['log', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background 0.15s, color 0.15s',
              backgroundColor: tab === t ? 'var(--color-surface-3)' : 'transparent',
              color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-hint)',
            }}
          >
            {t === 'log' ? 'Log' : 'History'}
          </button>
        ))}
      </div>

      {/* Log tab */}
      {tab === 'log' && (
        <div style={{ padding: '0 16px' }}>
          <div
            className="flex flex-col items-center justify-center"
            style={{
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'var(--color-surface-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Dumbbell size={24} style={{ color: 'var(--color-text-hint)' }} />
            </div>
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
              Log Today&apos;s Workout
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
              Track your sets, reps, and weights.
            </p>
            <button
              type="button"
              disabled
              style={{
                backgroundColor: 'var(--color-surface-3)',
                color: 'var(--color-text-hint)',
                border: 'none',
                borderRadius: '10px',
                padding: '11px 28px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'not-allowed',
              }}
            >
              Start Session
            </button>
          </div>
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div style={{ padding: '0 16px' }}>
          <div
            style={{
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          >
            {sessions.map((s, i) => (
              <div
                key={s.name + s.date}
                className="flex items-center gap-3"
                style={{
                  padding: '14px 16px',
                  borderBottom: i < sessions.length - 1 ? '1px solid var(--color-border)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: s.color,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
                    {s.name}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-hint)', margin: 0 }}>
                    {s.date} · {s.duration} · {s.exercises} exercises
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
