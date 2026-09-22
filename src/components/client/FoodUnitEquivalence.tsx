'use client'

import { foodUnitLabel } from '@/lib/food-units'
import { useLanguage } from '@/lib/i18n'
import type { FoodAmount } from './useFoodAmount'

/**
 * Shows how the chosen unit turns into grams, since that conversion is what
 * decides the macros and is otherwise invisible. Fixed conversions (a cup, a
 * litre) are stated; a serving, portion or piece has no universal weight, so
 * the client sets it here.
 *
 * Renders nothing for grams and millilitres, where there is nothing to explain.
 */
export default function FoodUnitEquivalence({
  amount,
  variant = 'panel',
}: {
  amount: FoodAmount
  variant?: 'panel' | 'overlay'
}) {
  const { t } = useLanguage()
  const { unit, unitDef, gramsPerUnit, setGramsPerUnit } = amount
  const overlay = variant === 'overlay'
  const singular = foodUnitLabel(unit, t.nutrition.units, 1)

  const hintColor = overlay ? 'rgba(255,255,255,0.5)' : 'var(--color-text-hint)'

  if (unitDef.customizable) {
    const invalid = !(parseFloat(gramsPerUnit) > 0)
    return (
      <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
        <label style={{ fontSize: 11, color: hintColor }}>
          {t.nutrition.gramsPerUnit(singular)}
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={gramsPerUnit}
          onChange={(e) => setGramsPerUnit(e.target.value)}
          aria-label={t.nutrition.gramsPerUnit(singular)}
          style={{
            width: 62,
            padding: overlay ? '5px 8px' : '4px 7px',
            fontSize: 12,
            backgroundColor: overlay ? 'rgba(255,255,255,0.1)' : 'var(--color-surface-3)',
            border:
              '1px solid ' +
              (invalid
                ? 'rgba(239,68,68,0.6)'
                : overlay
                  ? 'rgba(255,255,255,0.2)'
                  : 'var(--color-border)'),
            borderRadius: 7,
            color: overlay ? '#fff' : 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
      </div>
    )
  }

  if (unitDef.gramsPer === 1) return null

  return (
    <p style={{ fontSize: 11, color: hintColor, margin: '6px 0 0' }}>
      {t.nutrition.unitEquals(singular, unitDef.gramsPer)}
    </p>
  )
}
