'use client'

import { useCallback, useState } from 'react'
import {
  DEFAULT_FOOD_UNIT,
  defaultQuantityFor,
  findFoodUnit,
  toGrams,
  type FoodUnit,
  type FoodUnitId,
} from '@/lib/food-units'
import { normalizeDecimalInput } from '@/lib/numeric-input'

export type FoodAmount = {
  quantity: string
  setQuantity: (raw: string) => void
  unit: FoodUnitId
  setUnit: (unit: FoodUnitId) => void
  /** What one unit weighs, for the units the client defines themselves. */
  gramsPerUnit: string
  setGramsPerUnit: (raw: string) => void
  unitDef: FoodUnit
  /** The typed amount as a number; 0 when the field is empty or nonsense. */
  parsedQuantity: number
  /** The amount in grams, which is what per-100 g macros scale against. */
  grams: number
  valid: boolean
  reset: () => void
}

/**
 * Amount-entry state for logging a food: how much, in which unit, and — for a
 * serving, portion or piece — what one of those weighs. Everything downstream
 * only needs `grams`.
 *
 * Switching units re-seeds the amount (100 g, but 1 cup), because the number
 * that made sense for the old unit almost never makes sense for the new one.
 */
export function useFoodAmount(initialUnit: FoodUnitId = DEFAULT_FOOD_UNIT): FoodAmount {
  const [unit, setUnitState] = useState<FoodUnitId>(initialUnit)
  const [quantity, setQuantityState] = useState(() => defaultQuantityFor(initialUnit))
  const [gramsPerUnit, setGramsPerUnitState] = useState(
    () => String(findFoodUnit(initialUnit)?.gramsPer ?? 100)
  )

  const setQuantity = useCallback((raw: string) => {
    setQuantityState(normalizeDecimalInput(raw))
  }, [])

  const setGramsPerUnit = useCallback((raw: string) => {
    setGramsPerUnitState(normalizeDecimalInput(raw))
  }, [])

  const setUnit = useCallback((next: FoodUnitId) => {
    setUnitState(next)
    setQuantityState(defaultQuantityFor(next))
    setGramsPerUnitState(String(findFoodUnit(next)?.gramsPer ?? 100))
  }, [])

  const reset = useCallback(() => {
    setUnitState(initialUnit)
    setQuantityState(defaultQuantityFor(initialUnit))
    setGramsPerUnitState(String(findFoodUnit(initialUnit)?.gramsPer ?? 100))
  }, [initialUnit])

  const unitDef = findFoodUnit(unit) ?? findFoodUnit(DEFAULT_FOOD_UNIT)!
  const parsedQuantity = parseFloat(quantity) || 0
  const parsedGramsPerUnit = parseFloat(gramsPerUnit) || 0
  const grams = toGrams(parsedQuantity, unit, parsedGramsPerUnit)
  // A customisable unit with no weight behind it would log zero macros, so it
  // counts as incomplete rather than as a valid "0 g" entry.
  const valid = parsedQuantity > 0 && (!unitDef.customizable || parsedGramsPerUnit > 0)

  return {
    quantity,
    setQuantity,
    unit,
    setUnit,
    gramsPerUnit,
    setGramsPerUnit,
    unitDef,
    parsedQuantity,
    grams,
    valid,
    reset,
  }
}
