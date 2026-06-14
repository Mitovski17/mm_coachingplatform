'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ChevronRight, Dumbbell } from 'lucide-react'
import type { TodayTemplate, HistorySession, ProgramWorkoutDay } from './actions'
import { getProgramWorkoutDays } from './actions'
import { useLanguage, tx, type Translations } from '@/lib/i18n'
import { useWorkoutSession } from '@/lib/WorkoutSessionContext'

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#ef4444',
  back: '#3b82f6',
  shoulders: '#f59e0b',
  core: '#06b6d4',
  cardio: '#ec4899',
  biceps: '#0ea5e9',
  triceps: '#f97316',
  arms: '#f59e0b',
  quads: '#14b8a6',
  hamstrings: '#10b981',
  glutes: '#f43f5e',
  calves: '#84cc16',
  abductors: '#8b5cf6',
  adductors: '#d946ef',
  legs: '#7c3aed',
}

export default function WorkoutsClient({
  todayTemplate,
  history,
  clientId,
  hasPlan,
}: {
  todayTemplate: TodayTemplate | null
  history: HistorySession[]
  clientId: string
  hasPlan: boolean
}) {
  const { t } = useLanguage()
  const router = useRouter()
  const { session, hydrated } = useWorkoutSession()
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today')

  // If a workout session is already in progress, go straight to it.
  // Wait for hydration so we never flash the default screen before knowing session state.
  useEffect(() => {
    if (!hydrated) return
    if (!session) return
    const url = session.isCustom
      ? '/client/workouts/session?custom=true'
      : `/client/workouts/session?templateDayId=${session.templateDayId}&templateName=${encodeURIComponent(session.templateName)}`
    router.replace(url)
  }, [hydrated, session, router])

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerDays, setPickerDays] = useState<ProgramWorkoutDay[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)

  async function openPicker() {
    setPickerOpen(true)
    if (pickerDays.length === 0) {
      setPickerLoading(true)
      const days = await getProgramWorkoutDays(clientId)
      setPickerDays(days)
      setPickerLoading(false)
    }
  }

  // Don't render anything until localStorage is read — prevents flash of default screen
  if (!hydrated || session) return null

  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      <div
        className="flex items-center justify-between"
        style={{ padding: '52px 20px 20px' }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          {t.workouts.title}
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
          {t.workouts.today}
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
          {t.workouts.history}
        </button>
      </div>

      {activeTab === 'today' && (
        <div style={{ padding: '16px 16px 16px' }}>
          <TodayWorkoutCard today={todayTemplate} hasPlan={hasPlan} onSwitch={openPicker} t={t} />
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ padding: '16px 16px 8px' }}>
          <HistoryList sessions={history} t={t} />
        </div>
      )}

      {/* Workout picker bottom sheet */}
      {pickerOpen && (
        <div
          onClick={() => setPickerOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--color-surface-1)',
              borderRadius: '24px 24px 0 0',
              minHeight: '70vh',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14, paddingBottom: 6, flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: 'var(--color-surface-3)' }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 20px 14px',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
            }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                  {t.workouts.chooseWorkout}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '2px 0 0' }}>
                  {t.workouts.pickOrBuild}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  backgroundColor: 'var(--color-surface-3)',
                  border: 'none', color: 'var(--color-text-hint)',
                  cursor: 'pointer', fontSize: 20, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* Scrollable template list */}
            <div style={{
              overflowY: 'auto',
              flex: 1,
              padding: '16px 16px 0',
            }}>
              {pickerLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 120 }}>
                  <p style={{ color: 'var(--color-text-hint)', fontSize: 14 }}>{t.workouts.loadingProgram}</p>
                </div>
              ) : pickerDays.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 100, gap: 6 }}>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 14, fontWeight: 500, margin: 0 }}>
                    {t.workouts.noTemplates}
                  </p>
                  <p style={{ color: 'var(--color-text-hint)', fontSize: 12, margin: 0 }}>
                    {t.workouts.coachWillAdd}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pickerDays.map((day) => (
                    <Link
                      key={day.templateDayId}
                      href={`/client/workouts/session?templateDayId=${encodeURIComponent(day.templateDayId)}&templateName=${encodeURIComponent(day.label)}`}
                      onClick={() => setPickerOpen(false)}
                      style={{ display: 'block', textDecoration: 'none' }}
                    >
                      <div style={{
                        padding: '14px 16px',
                        backgroundColor: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 16,
                        display: 'flex', alignItems: 'center', gap: 14,
                      }}>
                        {/* Icon circle */}
                        <div style={{
                          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                          backgroundColor: 'var(--color-surface-3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 4v16M18 4v16M2 12h4M18 12h4M4 8h2M4 16h2M18 8h2M18 16h2" />
                          </svg>
                        </div>
                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {day.label}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '0 0 6px' }}>
                            {day.templateName && day.templateName !== day.label ? `${day.templateName} · ` : ''}{day.exerciseCount} {day.exerciseCount === 1 ? t.workouts.exercise : t.workouts.exercises}
                          </p>
                          {day.muscleGroups.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {day.muscleGroups.map((g) => (
                                <span key={g} style={{
                                  fontSize: 10, fontWeight: 600, padding: '2px 7px',
                                  borderRadius: 999,
                                  backgroundColor: `${MUSCLE_COLORS[g] ?? '#6b7280'}22`,
                                  color: MUSCLE_COLORS[g] ?? '#9ca3af',
                                }}>
                                  {tx(t.muscleGroups as Record<string, string>, g)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Chevron */}
                        <ChevronRight size={16} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Custom workout — pinned at the bottom, always visible */}
            <div style={{
              padding: '12px 16px',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
              borderTop: '1px solid var(--color-border)',
              flexShrink: 0,
            }}>
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false)
                  // Use window.location for reliable navigation — router.push
                  // can silently drop when the sheet unmounts in the same tick.
                  window.location.href = '/client/workouts/session?custom=true'
                }}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px dashed var(--color-border)',
                  borderRadius: 16,
                  color: 'var(--color-text-muted)',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  backgroundColor: 'var(--color-surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{t.workouts.createCustom}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-hint)', fontWeight: 400 }}>{t.workouts.customSub}</p>
                </div>
              </button>
            </div>

          </div>{/* end sheet panel */}
        </div>
      )}
    </div>
  )
}

function TodayWorkoutCard({ today, hasPlan, onSwitch, t }: { today: TodayTemplate | null; hasPlan: boolean; onSwitch: () => void; t: Translations }) {
  if (!today && !hasPlan) {
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
          {t.workouts.today}
        </p>
        <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
          {t.workouts.noPlanHeadline}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
          {t.workouts.noPlanSub}
        </p>
        <button
          type="button"
          onClick={onSwitch}
          style={{
            marginTop: 14,
            width: '100%',
            padding: '13px',
            backgroundColor: '#ffffff',
            border: 'none',
            borderRadius: 12,
            color: '#000000',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t.workouts.noPlanCta}
        </button>
      </div>
    )
  }

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
          {t.workouts.today}
        </p>
        <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
          {t.workouts.restDay}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
          {t.workouts.restSub}
        </p>
        <button
          type="button"
          onClick={onSwitch}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '11px',
            backgroundColor: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            color: 'var(--color-text-muted)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t.workouts.trainAnyway}
        </button>
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
        {t.workouts.todaysWorkout}
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
        {today.exerciseCount} {today.exerciseCount === 1 ? t.workouts.exercise : t.workouts.exercises}
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
              }}
            >
              {tx(t.muscleGroups as Record<string, string>, g)}
            </span>
          ))}
        </div>
      )}
      <Link
        href={`/client/workouts/session?templateDayId=${encodeURIComponent(today.templateDayId)}&templateName=${encodeURIComponent(today.templateName)}`}
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
        {t.workouts.startWorkout}
      </Link>
      <button
        type="button"
        onClick={onSwitch}
        style={{
          marginTop: 10,
          width: '100%',
          padding: '9px',
          backgroundColor: 'transparent',
          border: 'none',
          color: 'var(--color-text-hint)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        {t.workouts.switchWorkout}
      </button>
    </div>
  )
}

function HistoryList({ sessions, t }: { sessions: HistorySession[]; t: Translations }) {
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
          {t.workouts.noWorkoutsYet}
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
        if (s.durationMinutes !== null) parts.push(`${s.durationMinutes} ${t.home.min}`)
        parts.push(`${s.setCount} ${s.setCount === 1 ? t.workouts.set : t.workouts.sets}`)
        if (s.totalVolumeKg > 0) {
          parts.push(`${s.totalVolumeKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t.checkin.weightUnit}`)
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
