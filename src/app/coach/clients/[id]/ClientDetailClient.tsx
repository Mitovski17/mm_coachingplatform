'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import type {
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

export type TabId = 'overview' | 'workouts' | 'nutrition' | 'checkins' | 'progress'

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
}

export default function ClientDetailClient(props: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { profile, redFlags } = props

  return (
    <div>
      {/* Client header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: 56,
              height: 56,
              backgroundColor: avatarColor(profile.name),
              color: '#fff',
              fontWeight: 600,
              fontSize: 18,
            }}
          >
            {initials(profile.name)}
          </div>
          <div className="min-w-0">
            <div
              className="truncate"
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              {profile.name}
            </div>
            <div
              className="text-sm truncate"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {profile.email}
            </div>
            <div
              className="text-xs"
              style={{ color: 'var(--color-text-hint)' }}
            >
              Active since {format(new Date(profile.createdAt), 'MMM yyyy')}
            </div>
          </div>
        </div>
        {redFlags.length > 0 && (
          <span
            className="inline-flex items-center px-3 py-1 text-xs shrink-0"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            ⚠ {redFlags.length} {redFlags.length === 1 ? 'alert' : 'alerts'}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-6 mb-6"
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
                  ? `2px solid #fff`
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
        <ProgressTab checkins={props.checkins} photos={props.photos} />
      )}
    </div>
  )
}
