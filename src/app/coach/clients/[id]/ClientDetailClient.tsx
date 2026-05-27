'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import type {
  AiDigest,
  BodyMetric,
  Checkin,
  ClientAssignments,
  ClientProfile,
  NutritionDay,
  NutritionSummary,
  ProgressPhoto,
  RedFlag,
  WorkoutCompliance,
  WorkoutSession,
} from './actions'
import OverviewTab from './tabs/OverviewTab'
import WorkoutsTab from './tabs/WorkoutsTab'
import NutritionTab from './tabs/NutritionTab'
import CheckInsTab from './tabs/CheckInsTab'
import ProgressTab from './tabs/ProgressTab'
import DigestTab from './tabs/DigestTab'

export type TabId = 'overview' | 'workouts' | 'nutrition' | 'checkins' | 'progress' | 'digest'

const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#ef4444', // red
  '#a855f7', // purple
  '#14b8a6', // teal
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % 1000000
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? ''
  const b = parts[parts.length - 1]?.[0] ?? ''
  return (a + (parts.length > 1 ? b : '')).toUpperCase() || '?'
}

const TABS: { id: TabId; label: string; dotColor: string }[] = [
  { id: 'overview',  label: 'Overview',  dotColor: '#ffffff' },
  { id: 'workouts',  label: 'Workouts',  dotColor: '#3b82f6' },
  { id: 'nutrition', label: 'Nutrition', dotColor: '#f97316' },
  { id: 'checkins',  label: 'Check-ins', dotColor: '#a855f7' },
  { id: 'progress',  label: 'Progress',  dotColor: '#22c55e' },
  { id: 'digest',    label: 'Digest',    dotColor: '#14b8a6' },
]

type Props = {
  profile: ClientProfile
  compliance: WorkoutCompliance
  workoutHistory: WorkoutSession[]
  nutritionSummary: NutritionSummary
  nutritionHistory: NutritionDay[]
  checkins: Checkin[]
  assignments: ClientAssignments
  photos: ProgressPhoto[]
  redFlags: RedFlag[]
  initialDigest: AiDigest | null
  bodyMetrics: BodyMetric[]
}

export default function ClientDetailClient(props: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { profile, assignments, checkins } = props

  // Compute header stats from check-in history
  const latestCheckin = checkins[0] ?? null
  const oldestCheckin = checkins[checkins.length - 1] ?? null
  const currentWeight = latestCheckin?.weight ?? null
  const startingWeight = oldestCheckin?.weight ?? null
  const totalChange =
    currentWeight !== null && startingWeight !== null
      ? currentWeight - startingWeight
      : null
  const changeStr =
    totalChange !== null
      ? totalChange >= 0
        ? `+${totalChange.toFixed(1)} kg`
        : `${totalChange.toFixed(1)} kg`
      : '—'
  const changeColor =
    totalChange !== null
      ? totalChange < 0
        ? '#22c55e'
        : '#ef4444'
      : 'var(--color-text-primary)'

  // Submitted this week badge
  const todayMonday = (() => {
    const now = new Date()
    const day = now.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    const m = new Date(now)
    m.setUTCDate(now.getUTCDate() + diff)
    m.setUTCHours(0, 0, 0, 0)
    return m.toISOString().split('T')[0]
  })()
  const submittedThisWeek =
    latestCheckin?.weekStartDate === todayMonday

  // Week number estimate from check-in count
  const weekNum = checkins.length

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Link
          href="/coach/clients"
          style={{ fontSize: 12, color: 'var(--color-text-hint)', textDecoration: 'none' }}
        >
          CLIENTS
        </Link>
        <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>›</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>
          {profile.name.toUpperCase()}
        </span>
      </div>

      {/* Title + action buttons */}
      <div className="coach-client-title-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1 }}>
          {profile.name}
        </h1>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link
            href={`/coach/messages/${profile.id}`}
            style={{
              padding:         '8px 16px',
              fontSize:        13,
              fontWeight:      600,
              color:           'var(--color-text-primary)',
              backgroundColor: 'transparent',
              border:          '1px solid var(--color-border)',
              borderRadius:    8,
              cursor:          'pointer',
              textDecoration:  'none',
              display:         'inline-flex',
              alignItems:      'center',
            }}
          >
            Message
          </Link>
          <button
            style={{
              padding:         '8px 16px',
              fontSize:        13,
              fontWeight:      600,
              color:           '#fff',
              backgroundColor: 'var(--color-accent)',
              border:          'none',
              borderRadius:    8,
              cursor:          'pointer',
              display:         'flex',
              alignItems:      'center',
              gap:             6,
            }}
          >
            Open as client <span style={{ fontSize: 15 }}>→</span>
          </button>
        </div>
      </div>

      {/* Client info card */}
      <div
        className="coach-client-info-card"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border:          '1px solid var(--color-border)',
          borderRadius:    12,
          padding:         '14px 18px',
          display:         'flex',
          alignItems:      'center',
          gap:             16,
          marginBottom:    20,
          flexWrap:        'wrap',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: avatarColor(profile.name),
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {initials(profile.name)}
        </div>

        {/* Name + badge + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {profile.name}
            </span>
            {submittedThisWeek && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#22c55e',
                  backgroundColor: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 999,
                  padding: '2px 8px',
                }}
              >
                Submitted
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: 'var(--color-text-hint)' }}>
            <span>Started · {format(new Date(profile.createdAt), 'MMM d, yyyy')}</span>
            {assignments.workoutProgram && (
              <span>Program · {assignments.workoutProgram.name}</span>
            )}
            {assignments.trainingMealPlan && (
              <span>Plan · {assignments.trainingMealPlan.name}</span>
            )}
          </div>
        </div>

        {/* Week + total change */}
        <div className="coach-client-card-stats" style={{ display: 'flex', gap: 28, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 2 }}>
              Week
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>
              {weekNum} <span style={{ fontSize: 14, color: 'var(--color-text-hint)', fontWeight: 500 }}>/ —</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 2 }}>
              Total Change
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: changeColor, lineHeight: 1 }}>
              {changeStr}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="coach-client-tabs flex gap-4 mb-6"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        {TABS.map((tab) => {
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="pb-2.5 transition-colors flex items-center gap-1.5"
              style={{
                color: active
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-muted)',
                fontWeight: active ? 600 : 500,
                fontSize: 14,
                borderBottom: active
                  ? `2px solid var(--color-accent)`
                  : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {active && (
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    backgroundColor: tab.dotColor,
                    flexShrink: 0,
                  }}
                />
              )}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          profile={props.profile}
          compliance={props.compliance}
          checkins={props.checkins}
          nutritionSummary={props.nutritionSummary}
          assignments={props.assignments}
          redFlags={props.redFlags}
          onTabChange={setActiveTab}
        />
      )}
      {activeTab === 'workouts' && (
        <WorkoutsTab workoutHistory={props.workoutHistory} />
      )}
      {activeTab === 'nutrition' && (
        <NutritionTab
          summary={props.nutritionSummary}
          history={props.nutritionHistory}
        />
      )}
      {activeTab === 'checkins' && (
        <CheckInsTab checkins={props.checkins} photos={props.photos} />
      )}
      {activeTab === 'progress' && (
        <ProgressTab
          checkins={props.checkins}
          photos={props.photos}
          bodyMetrics={props.bodyMetrics}
          clientId={props.profile.id}
          workspaceId={props.profile.workspaceId}
        />
      )}
      {activeTab === 'digest' && (
        <DigestTab
          clientId={props.profile.id}
          initialDigest={props.initialDigest}
        />
      )}
    </div>
  )
}
