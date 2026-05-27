'use client'

import { useState, useRef } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import type {
  Checkin,
  ClientAssignments,
  ClientProfile,
  NutritionSummary,
  RedFlag,
  WorkoutCompliance,
} from '../actions'
import { saveCoachNotes } from '../actions'
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

// ─── Circular metric gauge ────────────────────────────────────────────────────

function percentColor(value: number, maxValue: number): string {
  const pct = (value / maxValue) * 100
  if (pct >= 75) return '#22c55e'
  if (pct >= 50) return '#f59e0b'
  return '#ef4444'
}

function MetricCircle({
  label,
  value,
  color,
  maxValue = 10,
  dynamicColor = false,
}: {
  label: string
  value: number | null
  color: string
  maxValue?: number
  dynamicColor?: boolean
}) {
  const r = 24
  const circ = 2 * Math.PI * r
  const pct = value !== null ? Math.max(0, Math.min(value / maxValue, 1)) : 0
  const dash = pct * circ
  const resolvedColor = value !== null && dynamicColor ? percentColor(value, maxValue) : color

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={64} height={64} viewBox="0 0 64 64">
        {/* Track */}
        <circle
          cx={32} cy={32} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={5}
        />
        {/* Progress */}
        <circle
          cx={32} cy={32} r={r}
          fill="none"
          stroke={value !== null ? resolvedColor : 'transparent'}
          strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        {/* Value */}
        <text
          x={32} y={28}
          textAnchor="middle"
          fontSize={maxValue === 100 ? 11 : 14}
          fontWeight={700}
          fill={value !== null ? '#fff' : 'rgba(255,255,255,0.25)'}
        >
          {value !== null ? value : '—'}
        </text>
        <text
          x={32} y={41}
          textAnchor="middle"
          fontSize={8}
          fill="rgba(255,255,255,0.35)"
        >
          /{maxValue}
        </text>
      </svg>
      <span style={{ fontSize: 11, color: 'var(--color-text-hint)', fontWeight: 500 }}>
        {label}
      </span>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  sub,
  subColor,
}: {
  label: string
  value: string
  unit?: string
  sub: string
  subColor?: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-text-hint)',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          lineHeight: 1,
          marginBottom: 4,
          display: 'flex',
          alignItems: 'baseline',
          gap: 3,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-hint)' }}>
            {unit}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: subColor ?? 'var(--color-text-hint)' }}>
        {sub}
      </div>
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

export default function OverviewTab({
  compliance,
  checkins,
  redFlags,
  onTabChange,
}: Props) {
  const latest = checkins[0] ?? null
  const oldest = checkins[checkins.length - 1] ?? null

  // Weight stats
  const currentWeight = latest?.weight ?? null
  const startingWeight = oldest?.weight ?? null
  const totalChange =
    currentWeight !== null && startingWeight !== null
      ? currentWeight - startingWeight
      : null

  // Weight delta last 4 check-ins
  const prev4Weight = checkins[4]?.weight ?? null
  const recentDelta =
    currentWeight !== null && prev4Weight !== null
      ? currentWeight - prev4Weight
      : null
  const recentDeltaStr =
    recentDelta !== null
      ? `${recentDelta >= 0 ? '+' : ''}${recentDelta.toFixed(1)} kg this month`
      : 'Not enough data'

  // Starting weight date
  const startedStr = oldest
    ? format(new Date(oldest.submittedAt), 'MMM d, yyyy')
    : '—'

  // Check-in stats
  const totalCheckins = checkins.length
  const pctStr = totalCheckins > 0 ? '100% submitted' : 'None yet'

  // Training (total sessions as proxy)
  const totalSessions = compliance.totalSessions

  // Metric scores from latest check-in
  const energyScore =
    latest?.energyLevel != null ? parseFloat(latest.energyLevel) || null : null
  const sleepScore = latest?.sleepQuality ?? null
  const adherenceScore = latest?.nutritionAdherence ?? null
  const trainingScore = latest?.trainingAdherence ?? null

  // Client note from latest check-in
  const clientNote = latest?.biggestWin ?? latest?.anythingElse ?? null

  // Coach notes
  const [coachNotes, setCoachNotes] = useState(latest?.notes ?? '')
  const [savedLabel, setSavedLabel] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleNotesChange(val: string) {
    setCoachNotes(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!latest) return
      try {
        await saveCoachNotes(latest.id, val)
        setSavedLabel('just now')
      } catch {
        /* silent */
      }
    }, 1000)
  }

  const cardBase: React.CSSProperties = {
    backgroundColor: 'var(--color-surface-1)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: 16,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Alert banner */}
      {redFlags.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, #1a0a0a 0%, #1a1a1a 100%)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderLeft: '4px solid #ef4444',
            borderRadius: 10,
            padding: 14,
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontWeight: 600, fontSize: 13, marginBottom: 8 }}
          >
            <AlertTriangle size={16} />
            Needs attention
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {redFlags.map((f) => (
              <li
                key={f.type}
                style={{ fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span style={{ color: '#ef4444', fontWeight: 700 }}>•</span>
                {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 4 stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard
          label="Current Weight"
          value={currentWeight !== null ? String(currentWeight) : '—'}
          unit={currentWeight !== null ? 'kg' : undefined}
          sub={recentDeltaStr}
        />
        <StatCard
          label="Starting Weight"
          value={startingWeight !== null ? String(startingWeight) : '—'}
          unit={startingWeight !== null ? 'kg' : undefined}
          sub={startedStr}
        />
        <StatCard
          label="Check-ins"
          value={String(totalCheckins)}
          sub={pctStr}
          subColor={totalCheckins > 0 ? '#22c55e' : undefined}
        />
        <StatCard
          label="Sessions Total"
          value={String(totalSessions)}
          sub={compliance.lastSessionDate
            ? `Last: ${format(new Date(compliance.lastSessionDate), 'MMM d')}`
            : 'No sessions yet'}
        />
      </div>

      {/* Bottom 2-column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* Latest check-in */}
        {latest ? (
          <div style={cardBase}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 2 }}>
                  Latest Check-in
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Week {checkins.length} · Submitted {formatDistanceToNow(new Date(latest.submittedAt), { addSuffix: true })}
                </div>
              </div>
              <button
                onClick={() => onTabChange('checkins')}
                style={{
                  padding: '7px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: 'var(--color-accent)',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Review full check-in
              </button>
            </div>

            {/* Metric circles */}
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
              <MetricCircle label="Energy"     value={energyScore}    color="#f97316" />
              <MetricCircle label="Sleep"      value={sleepScore}     color="#3b82f6" />
              <MetricCircle label="Adherence"  value={adherenceScore} color="#a855f7" maxValue={100} dynamicColor />
              <MetricCircle label="Training"   value={trainingScore}  color="#22c55e" maxValue={100} dynamicColor />
            </div>

            {/* Client note */}
            {clientNote && (
              <div
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  borderLeft: '3px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 6 }}>
                  Client Note
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
                  &ldquo;{clientNote}&rdquo;
                </p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ ...cardBase, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-hint)', marginBottom: 8 }}>No check-ins submitted yet</div>
              <button
                onClick={() => onTabChange('checkins')}
                style={{ fontSize: 12, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                View check-ins →
              </button>
            </div>
          </div>
        )}

        {/* Coach notes */}
        <div style={cardBase}>
          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)' }}>
              Coach Notes
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 500 }}>
              {savedLabel ? `Auto-saved · ${savedLabel}` : 'Auto-saved'}
            </div>
          </div>

          {/* Textarea */}
          <textarea
            value={coachNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add coaching notes for this client — progress observations, next steps, flags to watch..."
            style={{
              width: '100%',
              minHeight: 140,
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              color: 'var(--color-text-primary)',
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />

          {/* Footer */}
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-hint)' }}>
            {latest?.notes
              ? `Last edited ${formatDistanceToNow(new Date(latest.submittedAt), { addSuffix: true })}`
              : 'Click to start writing notes'}
          </div>
        </div>
      </div>
    </div>
  )
}
