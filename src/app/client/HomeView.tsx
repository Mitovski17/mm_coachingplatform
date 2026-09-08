'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Dumbbell, MessageCircle, ClipboardList } from 'lucide-react'
import type { TodayTemplate } from './workouts/actions'
import type { DayLog } from './nutrition/actions'
import type { HomeStats } from './home-actions'
import type { NutritionTargets } from './page'
import { useLanguage, tx } from '@/lib/i18n'

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

function dayIdx(date: Date): number {
  const d = date.getUTCDay()
  return d === 0 ? 6 : d - 1
}

type Props = {
  today: TodayTemplate | null
  logs: DayLog[]
  stats: HomeStats | null
  avatarUrl: string | null
  onboardingComplete: boolean
  targets: NutritionTargets | null
}

export default function HomeView({ today, logs, stats, avatarUrl, onboardingComplete, targets }: Props) {
  const router = useRouter()
  const { t, lang } = useLanguage()

  useEffect(() => {
    if (!onboardingComplete) {
      const skipped = localStorage.getItem('onboarding_skipped') === '1'
      if (!skipped) router.replace('/onboarding')
    }
  }, [onboardingComplete, router])

  const clientName = stats?.clientName ?? 'there'
  const initials   = stats?.clientName ? getInitials(stats.clientName) : '?'

  const greeting = (() => {
    const h = new Date().getUTCHours()
    if (h < 12) return t.home.greetingMorning
    if (h < 17) return t.home.greetingAfternoon
    return t.home.greetingEvening
  })()

  const locale = lang === 'bg' ? 'bg-BG' : 'en-US'
  const now = new Date()
  const dateLine = `${now.toLocaleDateString(locale, { weekday: 'long' }).toUpperCase()} · ${now.toLocaleDateString(locale, { month: 'short' }).toUpperCase()} ${now.getDate()}`

  const todayIdx = dayIdx(now)
  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setUTCDate(now.getUTCDate() - (6 - i))
    return d
  })

  const completedSet = new Set(
    (stats?.recentWorkouts ?? []).map((w) => {
      const d = new Date(w.performedAt)
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
    })
  )

  const todayKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`
  const todayWorkoutDone = completedSet.has(todayKey)

  const DAY_LETTERS = lang === 'bg'
    ? ['П', 'В', 'С', 'Ч', 'П', 'С', 'Н']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const totals = logs.reduce(
    (acc, l) => ({
      cal:    acc.cal    + l.calories,
      pro:    acc.pro    + l.proteinG,
      carbs:  acc.carbs  + l.carbsG,
      fat:    acc.fat    + l.fatG,
    }),
    { cal: 0, pro: 0, carbs: 0, fat: 0 }
  )
  const calConsumed = Math.round(totals.cal)
  const proG        = Math.round(totals.pro)
  const carbG       = Math.round(totals.carbs)
  const fatG        = Math.round(totals.fat)

  const CAL_TARGET  = targets?.calories ?? null
  const PRO_TARGET  = targets?.proteinG ?? null
  const CARB_TARGET = targets?.carbsG ?? null
  const FAT_TARGET  = targets?.fatG ?? null

  const remaining = CAL_TARGET != null ? Math.max(CAL_TARGET - calConsumed, 0) : null

  const R = 68, SW = 10, CX = 84, CY = 84
  const circ = 2 * Math.PI * R
  const pct  = CAL_TARGET != null ? Math.min(calConsumed / CAL_TARGET, 1) : 1
  const dash = circ * (1 - pct)

  const checkinDue = !(stats?.checkinSubmittedThisWeek ?? false)
  const estimatedDuration = today ? Math.round((today.exerciseCount * 9) / 5) * 5 : 0

  void todayIdx

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 16 }}>

      <div className="cx-in" style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-hint)', margin: '0 0 5px', letterSpacing: '0.08em' }}>
            {dateLine}
          </p>
          <h1 className="cx-display cx-display-lg" style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.1 }}>
            {greeting}, {getFirstName(clientName)}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginTop: 4 }}>
          <Link href="/client/messages" aria-label={t.nav.messages} className="cx-press cx-tint" style={{
            width: 40, height: 40, borderRadius: '50%',
            backgroundColor: 'var(--color-surface-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none', flexShrink: 0,
          }}>
            <MessageCircle size={20} color="var(--color-text-muted)" />
          </Link>
          <Link href="/client/profile" aria-label={t.nav.profile} className="cx-press" style={{
            width: 40, height: 40, borderRadius: '50%',
            backgroundColor: avatarUrl ? 'transparent' : 'var(--color-surface-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)',
            textDecoration: 'none', flexShrink: 0, overflow: 'hidden',
            boxShadow: 'inset 0 0 0 1px var(--color-border-strong)',
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </Link>
        </div>
      </div>

      <div className="cx-in" style={{ '--cx-i': 1, padding: '0 20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties}>
        {strip.map((date, i) => {
          const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`
          const isToday     = i === 6
          const isCompleted = completedSet.has(key) && !isToday
          const letter      = DAY_LETTERS[dayIdx(date)]
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: isToday ? 'var(--color-accent)' : 'var(--color-text-hint)', margin: 0, letterSpacing: '0.06em' }}>
                {letter}
              </p>
              <div
                className={isCompleted || isToday ? 'cx-pop' : undefined}
                style={{
                  '--cx-i': i,
                  width: 36, height: 36, borderRadius: '50%',
                  backgroundColor: isCompleted ? 'var(--color-accent)' : isToday ? 'transparent' : 'var(--color-surface-2)',
                  border: isToday ? '2px solid var(--color-accent)' : isCompleted ? 'none' : '2px solid var(--color-surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  // Only the day that carries meaning gets a shadow
                  boxShadow: isCompleted ? 'var(--cx-shadow-cta)' : 'none',
                  animationDelay: `calc(${i} * 40ms)`,
                } as React.CSSProperties}
              >
                {isCompleted ? (
                  <Check size={16} color="#fff" strokeWidth={3} />
                ) : isToday ? (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-accent)' }} />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {!onboardingComplete && (
        <ActionBanner
          icon={<ClipboardList size={18} color="var(--color-accent)" />}
          title={t.home.completeProfile}
          sub={t.home.completeProfileSub}
          href="/onboarding"
          cta={t.common.finish}
          index={2}
        />
      )}

      {checkinDue && (
        <ActionBanner
          icon={
            <img
              src="/icons/checkin.png"
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{ width: 46, height: 46, objectFit: 'contain', display: 'block' }}
            />
          }
          bareIcon
          title={t.home.weeklyCheckinDue}
          sub={t.home.takesAbout3Min}
          href="/check-in"
          cta={t.common.start}
          index={2}
        />
      )}

      <div className="cx-in" style={{ '--cx-i': 3, margin: '0 16px 16px' } as React.CSSProperties}>
        <div className="cx-card" style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--cx-r-lg)', padding: '18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-hint)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {t.home.todaysNutrition}
            </p>
            <Link href="/client/nutrition" className="cx-press" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
              {t.home.logMeal} <ChevronRight size={14} />
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ flexShrink: 0, position: 'relative' }}>
              <svg width={CX * 2} height={CY * 2} viewBox={`0 0 ${CX * 2} ${CY * 2}`} aria-hidden="true">
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-surface-3)" strokeWidth={SW} />
                {/* Draws itself in from empty on mount, then eases to any new value */}
                <circle cx={CX} cy={CY} r={R} fill="none"
                  className="cx-ring"
                  stroke="var(--color-accent)" strokeWidth={SW}
                  strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={dash}
                  transform={`rotate(-90 ${CX} ${CY})`}
                  style={{ '--cx-circ': circ } as React.CSSProperties}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                {remaining != null ? (
                  <>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-hint)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {t.home.remaining}
                    </p>
                    <p className="cx-num" style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1 }}>
                      {remaining.toLocaleString()}
                    </p>
                    <p className="cx-num" style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-hint)', margin: '4px 0 0', textAlign: 'center', lineHeight: 1.3 }}>
                      {calConsumed.toLocaleString()} / {CAL_TARGET!.toLocaleString()}<br />{t.home.kcal}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="cx-num" style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1 }}>
                      {calConsumed.toLocaleString()}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--color-text-hint)', margin: '4px 0 0', textAlign: 'center', lineHeight: 1.3 }}>
                      {t.home.kcal}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <MacroRow label={t.home.protein} value={proG} target={PRO_TARGET} color="#22c55e" />
              <MacroRow label={t.home.carbs}   value={carbG} target={CARB_TARGET} color="#3b82f6" />
              <MacroRow label={t.home.fat}     value={fatG}  target={FAT_TARGET} color="#f59e0b" />
            </div>
          </div>
        </div>
      </div>

      <div className="cx-in" style={{ '--cx-i': 4, margin: '0 16px 16px' } as React.CSSProperties}>
        <WorkoutCard today={today} estimatedDuration={estimatedDuration} todayDone={todayWorkoutDone} />
      </div>

      <div className="cx-in" style={{ '--cx-i': 5, padding: '0 16px' } as React.CSSProperties}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-hint)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {t.home.thisWeek}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatCard
            label={t.home.workouts}
            value={`${stats?.workoutsLogged ?? 0} / ${stats?.workoutsTarget ?? 0}`}
          />
          <StatCard
            label={t.home.avgCalories}
            value={stats?.caloriesAvg != null ? `${stats.caloriesAvg.toLocaleString()} ${t.home.kcal}` : t.common.noData}
          />
          <StatCard
            label={t.home.sleepQuality}
            value={stats?.sleepQuality != null ? `${stats.sleepQuality} / 10` : t.common.noData}
            valueColor={
              stats?.sleepQuality == null ? undefined
              : stats.sleepQuality >= 7 ? '#22c55e'
              : stats.sleepQuality >= 5 ? '#f59e0b'
              : '#ef4444'
            }
          />
          <StatCard
            label={t.home.bodyWeight}
            value={stats?.bodyWeight != null ? `${stats.bodyWeight} ${t.checkin.weightUnit}` : t.common.noData}
            trend={stats?.bodyWeightTrend === 'down' ? '↓' : stats?.bodyWeightTrend === 'up' ? '↑' : undefined}
            trendColor={stats?.bodyWeightTrend === 'down' ? '#22c55e' : '#ef4444'}
          />
        </div>
      </div>

      {stats?.coachNote && (
        <div className="cx-in" style={{ '--cx-i': 6, margin: '16px 16px 0' } as React.CSSProperties}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-hint)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {t.home.coach}
          </p>
          <div className="cx-card" style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--cx-r-md)', padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-accent)',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                MC
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', margin: 0 }}>{t.home.coachNoteTitle}</p>
                {stats.coachNoteDate && (
                  <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: '1px 0 0' }}>
                    {(() => {
                      const days = Math.floor((Date.now() - new Date(stats.coachNoteDate).getTime()) / 86_400_000)
                      return t.home.daysAgo(days)
                    })()}
                  </p>
                )}
              </div>
            </div>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
              &ldquo;{stats.coachNote}&rdquo;
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* A single banner shape shared by every "you have something to do" prompt, so
   they stay identical instead of drifting apart. */
function ActionBanner({ icon, title, sub, href, cta, index, bareIcon = false }: {
  icon: React.ReactNode; title: string; sub: string; href: string; cta: string; index: number
  /* Full-colour artwork stands on its own; only line glyphs need the tinted
     plate behind them to hold their weight against the card. */
  bareIcon?: boolean
}) {
  return (
    <div className="cx-in" style={{ '--cx-i': index, margin: '0 16px 16px' } as React.CSSProperties}>
      <div className="cx-card" style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderLeft: '3px solid var(--color-accent)',
        borderRadius: 'var(--cx-r-md)',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {bareIcon ? icon : (
          <div style={{
            width: 38, height: 38, borderRadius: 'var(--cx-r-sm)',
            backgroundColor: 'var(--color-accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="cx-display" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
            {title}
          </p>
          <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: 0 }}>
            {sub}
          </p>
        </div>
        <Link href={href} className="cx-cta" style={{
          backgroundColor: 'var(--color-accent)', color: '#fff',
          fontSize: 14, fontWeight: 700, borderRadius: 'var(--cx-r-sm)',
          padding: '10px 18px', textDecoration: 'none', flexShrink: 0,
        }}>
          {cta}
        </Link>
      </div>
    </div>
  )
}

function MacroRow({ label, value, target, color }: { label: string; value: number; target: number | null; color: string }) {
  const pct = target != null ? Math.min(value / target, 1) : 1
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-hint)' }}>{label}</span>
        <span className="cx-num" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          <span>{value}</span>
          {target != null && (
            <span style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}>/{target}g</span>
          )}
          {target == null && (
            <span style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}>g</span>
          )}
        </span>
      </div>
      {/* Track clips the fill, so scaleX still yields rounded ends */}
      <div style={{ height: 5, backgroundColor: 'var(--color-surface-3)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          className="cx-bar-fill"
          style={{
            '--cx-p': target != null ? pct : 1,
            height: '100%', backgroundColor: color, borderRadius: 999,
            opacity: target != null ? 1 : 0.3,
          } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, valueColor, trend, trendColor }: {
  label: string; value: string; valueColor?: string; trend?: string; trendColor?: string
}) {
  return (
    <div className="cx-card-flat" style={{
      backgroundColor: 'var(--color-surface-1)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--cx-r-md)', padding: '14px',
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-hint)', margin: '0 0 7px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span className="cx-num" style={{ fontSize: 19, fontWeight: 800, color: valueColor ?? 'var(--color-text-primary)', lineHeight: 1 }}>
          {value}
        </span>
        {trend && trendColor && (
          <span style={{ fontSize: 16, color: trendColor, fontWeight: 700 }}>{trend}</span>
        )}
      </div>
    </div>
  )
}

function WorkoutCard({ today, estimatedDuration, todayDone }: { today: TodayTemplate | null; estimatedDuration: number; todayDone: boolean }) {
  const { t } = useLanguage()

  if (todayDone) {
    return (
      <div className="cx-card" style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--cx-r-lg)', padding: '18px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-hint)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {t.home.todaysWorkout}
          </p>
          {/* The one celebratory beat on this screen — it earns the pop */}
          <div className="cx-pop" style={{
            width: 28, height: 28, borderRadius: '50%',
            backgroundColor: '#22c55e',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 4px 14px -4px rgba(34,197,94,0.7)',
          }}>
            <Check size={14} color="#fff" strokeWidth={3} />
          </div>
        </div>
        <p className="cx-display cx-display-lg" style={{ fontSize: 21, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 6px', lineHeight: 1.2 }}>
          {t.home.workoutDoneTitle}
        </p>
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', margin: 0, lineHeight: 1.5 }}>
          {t.home.workoutDoneBody}
        </p>
      </div>
    )
  }

  if (!today) {
    return (
      <div className="cx-card" style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--cx-r-lg)', padding: '18px',
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-hint)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {t.home.todaysWorkout}
        </p>
        <p className="cx-display" style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>{t.home.restDay}</p>
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', margin: 0 }}>{t.home.restDaySub}</p>
      </div>
    )
  }

  const visible = today.exerciseNames.slice(0, 3)
  const extra   = today.exerciseCount - 3

  return (
    <div className="cx-card" style={{
      backgroundColor: 'var(--color-surface-1)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--cx-r-lg)', padding: '18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-hint)', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {t.home.todaysWorkout}
          </p>
          <p className="cx-display cx-display-lg" style={{ fontSize: 23, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 3px', lineHeight: 1.15 }}>
            {today.templateDayLabel}
          </p>
          <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: 0 }}>
            {today.exerciseCount} {today.exerciseCount === 1 ? t.home.exercise : t.home.exercises}{estimatedDuration > 0 ? ` · ~${estimatedDuration} ${t.home.min}` : ''}
          </p>
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 'var(--cx-r-sm)',
          backgroundColor: 'var(--color-surface-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Dumbbell size={20} color="var(--color-text-muted)" />
        </div>
      </div>

      {visible.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {visible.map((name, i) => (
            <span key={i} style={{
              fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-surface-3)', borderRadius: 999, padding: '6px 12px',
            }}>
              {tx(t.exercises as Record<string, string>, name)}
            </span>
          ))}
          {extra > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 600, color: 'var(--color-accent)',
              backgroundColor: 'var(--color-accent-dim)', borderRadius: 999, padding: '6px 12px',
            }}>
              +{extra} {t.home.moreExercises}
            </span>
          )}
        </div>
      )}

      <Link
        href={`/client/workouts/session?templateDayId=${encodeURIComponent(today.templateDayId)}&templateName=${encodeURIComponent(today.templateName)}`}
        className="cx-cta cx-display"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          backgroundColor: 'var(--color-accent)', color: '#fff',
          borderRadius: 'var(--cx-r-md)', padding: '16px',
          fontSize: 16, fontWeight: 800, textDecoration: 'none',
        }}
      >
        {t.home.startWorkout} →
      </Link>
    </div>
  )
}
