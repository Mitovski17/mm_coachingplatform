/**
 * Measuring units a client can log a food in.
 *
 * Nutrition data everywhere in the app is per 100 g, so every unit needs a gram
 * weight to scale macros with. Mass and volume units convert exactly (liquids
 * are treated as water, which is what food labels assume); a serving, portion
 * or piece has no universal weight, so the client sets it and we only supply a
 * sensible starting point.
 *
 * Only `quantity` and `unit` are stored on a log — the macros written alongside
 * them are already absolute, so resizing an entry later scales correctly without
 * needing to remember which gram weight produced it.
 */

export type FoodUnitId = 'g' | 'ml' | 'l' | 'cup' | 'serving' | 'portion' | 'piece'

export type FoodUnit = {
  id: FoodUnitId
  /** Grams one of this unit weighs. For customisable units this is the default. */
  gramsPer: number
  /** True when the gram weight is a convention rather than a fact, so the client can change it. */
  customizable: boolean
  /** Whether "2" reads as "2g" (false) or "2 cups" (true). */
  spaced: boolean
  /** Whether fractional amounts are worth showing (0.5 cup, but not 0.5 g). */
  fractional: boolean
}

export const FOOD_UNITS: FoodUnit[] = [
  { id: 'g',       gramsPer: 1,    customizable: false, spaced: false, fractional: false },
  { id: 'ml',      gramsPer: 1,    customizable: false, spaced: false, fractional: false },
  { id: 'l',       gramsPer: 1000, customizable: false, spaced: true,  fractional: true  },
  { id: 'cup',     gramsPer: 240,  customizable: false, spaced: true,  fractional: true  },
  { id: 'serving', gramsPer: 100,  customizable: true,  spaced: true,  fractional: true  },
  { id: 'portion', gramsPer: 100,  customizable: true,  spaced: true,  fractional: true  },
  { id: 'piece',   gramsPer: 100,  customizable: true,  spaced: true,  fractional: true  },
]

export const DEFAULT_FOOD_UNIT: FoodUnitId = 'g'

const BY_ID = new Map<string, FoodUnit>(FOOD_UNITS.map((u) => [u.id, u]))

/** The unit definition for `id`, or undefined for a unit we don't manage (e.g. a coach's own label). */
export function findFoodUnit(id: string): FoodUnit | undefined {
  return BY_ID.get(id)
}

/**
 * Grams `quantity` of `unit` comes to. `gramsPerUnit` overrides the default for
 * the units whose weight the client sets themselves.
 */
export function toGrams(quantity: number, unit: FoodUnitId, gramsPerUnit?: number): number {
  const def = BY_ID.get(unit)
  if (!def) return quantity
  const per = def.customizable && gramsPerUnit && gramsPerUnit > 0 ? gramsPerUnit : def.gramsPer
  return quantity * per
}

/**
 * What to pre-fill the amount with when this unit is picked. 100 g is the
 * portion people think in for mass and volume; anything counted starts at one.
 */
export function defaultQuantityFor(unit: FoodUnitId): string {
  return unit === 'g' || unit === 'ml' ? '100' : '1'
}

/** Labels for one unit, singular and plural, in the active language. */
export type FoodUnitLabels = { one: string; many: string }

/** The unit's own word, pluralised for `quantity`. Falls back to the raw stored label. */
export function foodUnitLabel(
  unit: string,
  labels: Record<string, FoodUnitLabels> | undefined,
  quantity = 2
): string {
  const label = labels?.[unit]
  if (!label) return unit
  return quantity === 1 ? label.one : label.many
}

/**
 * Renders an amount the way it should read in a food row: "150g", "1 cup",
 * "2 servings". Units we don't manage fall back to the stored label so a coach's
 * template keeps rendering as it always did.
 */
export function formatFoodQuantity(
  quantity: number,
  unit: string,
  labels: Record<string, FoodUnitLabels> | undefined
): string {
  const def = BY_ID.get(unit)
  const label = labels?.[unit]
  if (!def || !label) return `${Math.round(quantity)}${unit}`
  const rounded = def.fractional ? Math.round(quantity * 10) / 10 : Math.round(quantity)
  const word = rounded === 1 ? label.one : label.many
  return def.spaced ? `${rounded} ${word}` : `${rounded}${word}`
}
