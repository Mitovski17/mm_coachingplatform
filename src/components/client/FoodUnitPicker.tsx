'use client'

import { FOOD_UNITS, foodUnitLabel, type FoodUnitId } from '@/lib/food-units'
import { useLanguage } from '@/lib/i18n'

/**
 * The measuring unit a client logs a food in. Rendered as a native `<select>`
 * so the phone's own wheel picker does the work — the add-food row is already
 * cramped and a custom dropdown would overflow it on small screens.
 *
 * `variant` covers the two surfaces this appears on: the nutrition page's
 * themed panels, and the barcode scanner's full-screen dark overlay, which
 * sits above the theme and so needs its own light-on-black colours.
 */
export default function FoodUnitPicker({
  value,
  onChange,
  variant = 'panel',
  disabled,
}: {
  value: FoodUnitId
  onChange: (unit: FoodUnitId) => void
  variant?: 'panel' | 'overlay'
  disabled?: boolean
}) {
  const { t } = useLanguage()
  const labels = t.nutrition.units
  const overlay = variant === 'overlay'

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as FoodUnitId)}
      disabled={disabled}
      aria-label={t.nutrition.unit}
      style={{
        padding: overlay ? '8px 10px' : '6px 8px',
        fontSize: overlay ? 14 : 13,
        fontWeight: overlay ? 600 : 500,
        backgroundColor: overlay ? 'rgba(255,255,255,0.1)' : 'var(--color-surface-3)',
        border: '1px solid ' + (overlay ? 'rgba(255,255,255,0.2)' : 'var(--color-border)'),
        borderRadius: overlay ? 10 : 8,
        color: overlay ? '#fff' : 'var(--color-text-primary)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        outline: 'none',
        maxWidth: 130,
      }}
    >
      {FOOD_UNITS.map((u) => (
        <option
          key={u.id}
          value={u.id}
          // Native options don't inherit the overlay's colours on every browser,
          // so give them a readable pair of their own.
          style={overlay ? { backgroundColor: '#18181b', color: '#fff' } : undefined}
        >
          {foodUnitLabel(u.id, labels)}
        </option>
      ))}
    </select>
  )
}
