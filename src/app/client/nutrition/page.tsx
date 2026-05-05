'use client'

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'

interface MacroRingProps {
  label: string
  current: number
  total: number
  unit: string
  color: string
  size?: number
  strokeWidth?: number
}

function MacroRing({ label, current, total, unit, color, size = 64, strokeWidth = 6 }: MacroRingProps) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(current / total, 1)
  const offset = circ * (1 - pct)

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-surface-3)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
            {current}
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{label}</p>
        <p style={{ fontSize: '9px', color: 'var(--color-text-hint)', margin: '1px 0 0' }}>/ {total}{unit}</p>
      </div>
    </div>
  )
}

const meals = [
  {
    name: 'Breakfast',
    kcal: 487,
    items: [
      { name: 'Oats with milk', macros: '42g C · 8g P · 4g F', kcal: 232 },
      { name: 'Banana', macros: '27g C · 1g P · 0g F', kcal: 105 },
      { name: 'Whey protein shake', macros: '5g C · 25g P · 2g F', kcal: 150 },
    ],
  },
  {
    name: 'Lunch',
    kcal: 620,
    items: [
      { name: 'Chicken breast (200g)', macros: '0g C · 46g P · 4g F', kcal: 220 },
      { name: 'Brown rice (150g)', macros: '40g C · 4g P · 1g F', kcal: 186 },
      { name: 'Mixed greens + olive oil', macros: '8g C · 2g P · 14g F', kcal: 164 },
      { name: 'Apple', macros: '25g C · 0g P · 0g F', kcal: 50 },
    ],
  },
  {
    name: 'Dinner',
    kcal: 540,
    items: [
      { name: 'Salmon fillet (180g)', macros: '0g C · 38g P · 18g F', kcal: 318 },
      { name: 'Sweet potato (200g)', macros: '40g C · 3g P · 0g F', kcal: 172 },
      { name: 'Broccoli (100g)', macros: '7g C · 3g P · 0g F', kcal: 50 },
    ],
  },
  {
    name: 'Snacks',
    kcal: 193,
    items: [
      { name: 'Greek yogurt (150g)', macros: '8g C · 15g P · 3g F', kcal: 115 },
      { name: 'Almonds (20g)', macros: '3g C · 4g P · 12g F', kcal: 78 },
    ],
  },
]

export default function NutritionPage() {
  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 88px' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '52px 20px 20px' }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          Nutrition
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
            aria-label="Previous day"
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            Today, May 5
          </span>
          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text-hint)',
              cursor: 'not-allowed',
              opacity: 0.5,
            }}
            aria-label="Next day"
            disabled
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Macro rings */}
      <div
        style={{
          margin: '0 16px 20px',
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '20px 16px',
        }}
      >
        <div className="flex justify-around items-start">
          <MacroRing label="Calories" current={1840} total={2400} unit="" color="#ffffff" size={72} strokeWidth={7} />
          <MacroRing label="Protein" current={156} total={190} unit="g" color="#3b82f6" size={60} />
          <MacroRing label="Carbs" current={210} total={280} unit="g" color="#f59e0b" size={60} />
          <MacroRing label="Fat" current={52} total={80} unit="g" color="#10b981" size={60} />
        </div>
      </div>

      {/* Meals */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {meals.map((meal) => (
          <div
            key={meal.name}
            style={{
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          >
            {/* Meal header */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: '13px 16px',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {meal.name}
              </span>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>
                  {meal.kcal} kcal
                </span>
                <button
                  type="button"
                  style={{
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--color-surface-3)',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                  aria-label={`Add food to ${meal.name}`}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* Food items */}
            {meal.items.map((item, i) => (
              <div
                key={item.name}
                className="flex items-center justify-between"
                style={{
                  padding: '10px 16px',
                  borderBottom: i < meal.items.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>
                    {item.name}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-hint)', margin: 0 }}>
                    {item.macros}
                  </p>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {item.kcal} kcal
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Floating add button */}
      <button
        type="button"
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '16px',
          height: '48px',
          paddingLeft: '20px',
          paddingRight: '20px',
          backgroundColor: '#f59e0b',
          color: '#ffffff',
          border: 'none',
          borderRadius: '9999px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
          zIndex: 40,
        }}
      >
        <Plus size={16} />
        Add Food
      </button>
    </div>
  )
}
