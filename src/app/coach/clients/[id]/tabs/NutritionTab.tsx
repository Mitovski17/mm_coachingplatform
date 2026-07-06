'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import type {
  NutritionDay,
  NutritionSummary,
  NutritionMealGroup,
} from '../actions'

const cardBase: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-1)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  padding: 16,
}

function MacroCard({
  label,
  value,
  unit,
  color,
}: {
  label: string
  value: number
  unit: string
  color: string
}) {
  return (
    <div style={cardBase}>
      <div
        className="text-xs uppercase tracking-wide mb-1"
        style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
      >
        {label}
      </div>
      <div
        className="text-xl"
        style={{ color, fontWeight: 600 }}
      >
        {value}
        <span
          className="text-xs ml-1"
          style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}
        >
          {unit}
        </span>
      </div>
    </div>
  )
}

function Calendar({ history }: { history: NutritionDay[] }) {
  // 28 days into 4 rows of 7
  const rows: NutritionDay[][] = []
  for (let i = 0; i < 4; i++) {
    rows.push(history.slice(i * 7, i * 7 + 7))
  }

  // No target yet, so any logged day is green
  function colorFor(day: NutritionDay): string {
    if (!day.totalCalories || day.totalCalories <= 0) {
      return 'var(--color-surface-3)'
    }
    return '#22c55e'
  }

  const dayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div>
      <div
        className="grid mb-1"
        style={{
          gridTemplateColumns: '60px repeat(7, 16px)',
          gap: 4,
        }}
      >
        <div />
        {dayHeaders.map((h, i) => (
          <div
            key={i}
            className="text-center"
            style={{
              fontSize: 9,
              color: 'var(--color-text-hint)',
              fontWeight: 500,
            }}
          >
            {h}
          </div>
        ))}
      </div>
      <div
        className="grid"
        style={{
          gridTemplateColumns: '60px repeat(7, 16px)',
          gap: 4,
          alignItems: 'center',
        }}
      >
        {rows.map((row, rIdx) => (
          <div key={rIdx} className="contents">
            <div
              className="text-xs"
              style={{ color: 'var(--color-text-hint)', fontSize: 10 }}
            >
              {row[0] ? format(new Date(row[0].date), 'MMM d') : ''}
            </div>
            {row.map((day) => (
              <div
                key={day.date}
                title={`${format(new Date(day.date), 'MMM d')}: ${
                  day.totalCalories ? Math.round(day.totalCalories) + ' kcal' : 'no logs'
                }`}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: colorFor(day),
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-3 mt-3 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span className="flex items-center gap-1.5">
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: '#22c55e',
            }}
          />
          On target
        </span>
        <span className="flex items-center gap-1.5">
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: '#f97316',
            }}
          />
          Partial
        </span>
        <span className="flex items-center gap-1.5">
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: '#ef4444',
            }}
          />
          Low
        </span>
      </div>
    </div>
  )
}

const MACRO_COLORS = {
  protein: '#3b82f6',
  carbs: '#f97316',
  fat: '#ef4444',
}

function MealMacroPill({
  value,
  unit,
  color,
}: {
  value: number
  unit: string
  color: string
}) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        backgroundColor: 'var(--color-surface-3)',
        padding: '2px 6px',
        borderRadius: 5,
        whiteSpace: 'nowrap',
      }}
    >
      {Math.round(value)}
      {unit}
    </span>
  )
}

function DayDetail({ groups }: { groups: NutritionMealGroup[] }) {
  if (groups.length === 0) {
    return (
      <div
        className="text-xs"
        style={{ color: 'var(--color-text-hint)', padding: '10px 12px' }}
      >
        No meals logged this day.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3" style={{ padding: '10px 12px 12px' }}>
      {groups.map((g) => (
        <div key={g.mealType}>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
            <span
              className="text-xs"
              style={{
                color: 'var(--color-text-primary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {g.mealType}
            </span>
            <div className="flex items-center gap-1">
              <MealMacroPill value={g.totalCalories} unit="" color="var(--color-text-primary)" />
              <MealMacroPill value={g.totalProtein} unit="P" color={MACRO_COLORS.protein} />
              <MealMacroPill value={g.totalCarbs} unit="C" color={MACRO_COLORS.carbs} />
              <MealMacroPill value={g.totalFat} unit="F" color={MACRO_COLORS.fat} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {g.entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                }}
              >
                <div className="min-w-0">
                  <div
                    className="text-sm truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {e.foodName}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: 'var(--color-text-hint)' }}
                  >
                    {Math.round(e.quantity)}
                    {e.unit}
                    {e.isCustom && (
                      <span style={{ marginLeft: 6, color: 'var(--color-accent)' }}>
                        · added by client
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <MealMacroPill value={e.calories} unit="" color="var(--color-text-primary)" />
                  <MealMacroPill value={e.proteinG} unit="P" color={MACRO_COLORS.protein} />
                  <MealMacroPill value={e.carbsG} unit="C" color={MACRO_COLORS.carbs} />
                  <MealMacroPill value={e.fatG} unit="F" color={MACRO_COLORS.fat} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NutritionTab({
  summary,
  history,
}: {
  summary: NutritionSummary
  history: NutritionDay[]
}) {
  const todayKey = new Date().toISOString().split('T')[0]
  const last14 = history.slice(-14).reverse()

  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  function toggleDay(date: string, empty: boolean) {
    if (empty) return
    setExpandedDate((cur) => (cur === date ? null : date))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Macro averages */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MacroCard
          label="Calories"
          value={summary.last7DaysAvgCalories}
          unit="kcal"
          color="var(--color-text-primary)"
        />
        <MacroCard
          label="Protein"
          value={summary.last7DaysAvgProtein}
          unit="g"
          color="#3b82f6"
        />
        <MacroCard
          label="Carbs"
          value={summary.last7DaysAvgCarbs}
          unit="g"
          color="#f97316"
        />
        <MacroCard
          label="Fat"
          value={summary.last7DaysAvgFat}
          unit="g"
          color="#ef4444"
        />
      </div>

      {/* Calendar */}
      <div style={cardBase}>
        <div
          className="text-xs uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
        >
          Logging Calendar — Last 4 Weeks
        </div>
        <Calendar history={history} />
      </div>

      {/* Daily breakdown */}
      <div style={cardBase}>
        <div
          className="text-xs uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
        >
          Daily Breakdown — Last 14 Days
        </div>
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <div
            className="grid text-xs"
            style={{
              gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr',
              borderBottom: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface-2)',
              padding: '8px 12px',
              color: 'var(--color-text-hint)',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            <span>Date</span>
            <span className="text-right">Calories</span>
            <span className="text-right">Protein</span>
            <span className="text-right">Carbs</span>
            <span className="text-right">Fat</span>
          </div>
          {last14.map((d, idx) => {
            const isToday = d.date === todayKey
            const empty = !d.totalCalories
            const isExpanded = expandedDate === d.date
            const rowBg = isExpanded
              ? 'var(--color-surface-3)'
              : isToday
                ? 'rgba(255,255,255,0.04)'
                : idx % 2 === 0
                  ? 'var(--color-surface-1)'
                  : 'var(--color-surface-2)'
            return (
              <div key={d.date}>
                <button
                  type="button"
                  onClick={() => toggleDay(d.date, empty)}
                  disabled={empty}
                  className="grid text-sm w-full text-left"
                  style={{
                    gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr',
                    padding: '8px 12px',
                    backgroundColor: rowBg,
                    color: empty
                      ? 'var(--color-text-hint)'
                      : 'var(--color-text-secondary)',
                    border: 'none',
                    cursor: empty ? 'default' : 'pointer',
                    alignItems: 'center',
                  }}
                >
                  <span
                    className="flex items-center gap-1.5"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {!empty && (
                      <ChevronDown
                        size={13}
                        style={{
                          color: 'var(--color-text-hint)',
                          transform: isExpanded ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span className="truncate">
                      {format(new Date(d.date), 'EEE, MMM d')}
                    </span>
                    {isToday && (
                      <span
                        className="text-xs"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        Today
                      </span>
                    )}
                  </span>
                  <span className="text-right">
                    {empty ? '—' : Math.round(d.totalCalories ?? 0)}
                  </span>
                  <span className="text-right">
                    {empty ? '—' : Math.round(d.totalProtein ?? 0) + 'g'}
                  </span>
                  <span className="text-right">
                    {empty ? '—' : Math.round(d.totalCarbs ?? 0) + 'g'}
                  </span>
                  <span className="text-right">
                    {empty ? '—' : Math.round(d.totalFat ?? 0) + 'g'}
                  </span>
                </button>
                {isExpanded && (
                  <div style={{ backgroundColor: 'var(--color-surface-1)' }}>
                    <DayDetail groups={d.meals} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
