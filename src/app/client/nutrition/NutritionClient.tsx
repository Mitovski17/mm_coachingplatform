'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Search, Loader2, Check, X, Plus, Pencil, Scan, Camera, RefreshCcw, Undo2, AlertCircle } from 'lucide-react'
import {
  getDayLogs,
  getMealPlansForDate,
  logMealOption,
  removeOptionLog,
  logCustomFood,
  searchFoodsForClient,
  deleteNutritionLog,
  updateNutritionLogQuantity,
  renameCustomMealLogs,
  type FullMealPlan,
  type DayLog,
  type Meal,
  type Option,
  type FoodItem,
} from './actions'
import type { FoodSearchResult } from '@/lib/food-search'
import BarcodeScannerModal from './BarcodeScannerModal'
import FoodScannerModal from './FoodScannerModal'
import { useLanguage, tx, type Translations } from '@/lib/i18n'
import { normalizeDecimalInput } from '@/lib/numeric-input'

const COLOR_PROTEIN = '#3b82f6'
const COLOR_CARBS = '#f97316'
const COLOR_FAT = '#ef4444'

function isoFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  const diff = day === 0 ? -6 : 1 - day
  r.setDate(r.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

/** Scale factor for a plan food shown at `qty` instead of its prescribed amount. */
function portionRatio(baseQuantity: number, qty: number) {
  return baseQuantity > 0 ? qty / baseQuantity : 1
}

function omitKey<T>(obj: Record<string, T>, key: string): Record<string, T> {
  if (!(key in obj)) return obj
  const next = { ...obj }
  delete next[key]
  return next
}

// ── Per-day client-side meal state ────────────────────────────────────────────
// The choices a client makes on top of their plan — which pre-filled foods they
// removed, which portions they resized, and which meals they marked as eaten
// when nothing from the plan is left — are theirs alone and never written to the
// coach's template, so they live in localStorage keyed by client + date.

type DayUiState = {
  /**
   * Template food ids the client removed from their plan for this day, mapped to
   * a 1-based removal sequence. The order is what lets undo put back the last
   * food removed rather than an arbitrary one.
   */
  removed: Record<string, number>
  /** Meal names the client marked as eaten while no plan food remained in them. */
  confirmed: Record<string, boolean>
  /** Template food id → the quantity the client resized it to. */
  portions: Record<string, number>
}

const EMPTY_DAY_UI: DayUiState = { removed: {}, confirmed: {}, portions: {} }

/** Next removal sequence, so the newest removal always sorts highest. */
function nextRemovalSeq(removed: Record<string, number>): number {
  let max = 0
  for (const seq of Object.values(removed)) if (seq > max) max = seq
  return max + 1
}

/** The most recently removed of `ids`, or null if none of them are removed. */
function lastRemovedOf(removed: Record<string, number>, ids: string[]): string | null {
  let best: string | null = null
  let bestSeq = -Infinity
  for (const id of ids) {
    const seq = removed[id]
    if (seq != null && seq > bestSeq) {
      bestSeq = seq
      best = id
    }
  }
  return best
}

/**
 * Earlier builds stored `true` per removed id (and, before that, a plain array of
 * ids). Neither carried an explicit order, so fall back to key order — which is
 * insertion order for these uuid keys — and number them from there.
 */
function normalizeRemoved(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  let fallback = 0
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    fallback++
    out[id] = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
  }
  return out
}

function dayUiKey(clientId: string, date: string) {
  return `nutriDay_${clientId}_${date}`
}

function loadDayUiState(clientId: string, date: string): DayUiState {
  if (typeof window === 'undefined') return EMPTY_DAY_UI
  try {
    const raw = window.localStorage.getItem(dayUiKey(clientId, date))
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DayUiState>
      return {
        removed: normalizeRemoved(parsed.removed),
        confirmed: parsed.confirmed ?? {},
        portions: parsed.portions ?? {},
      }
    }
    // Older builds stored removals alone under `excl_<client>_<date>`; keep them.
    const legacy = window.localStorage.getItem(`excl_${clientId}_${date}`)
    if (legacy) {
      const ids = JSON.parse(legacy) as string[]
      return {
        removed: Object.fromEntries(ids.map((id, i) => [id, i + 1])),
        confirmed: {},
        portions: {},
      }
    }
  } catch {
    // Unreadable or blocked storage — start this day from a clean slate.
  }
  return EMPTY_DAY_UI
}

function saveDayUiState(clientId: string, date: string, state: DayUiState) {
  if (typeof window === 'undefined') return
  try {
    const isEmpty =
      Object.keys(state.removed).length === 0 &&
      Object.keys(state.confirmed).length === 0 &&
      Object.keys(state.portions).length === 0
    if (isEmpty) window.localStorage.removeItem(dayUiKey(clientId, date))
    else window.localStorage.setItem(dayUiKey(clientId, date), JSON.stringify(state))
    window.localStorage.removeItem(`excl_${clientId}_${date}`)
  } catch {
    // Storage full or blocked — the in-memory state still carries this session.
  }
}

// ── Nutritional insight badges ────────────────────────────────────────────────

type InsightTier = 'green' | 'orange' | 'red'

type NutritionInsight = {
  tier: InsightTier
  label: string
}

function getNutritionInsights(
  food: FoodSearchResult,
  quantity: number,
  dailyGoal: { calories: number; fatG: number; proteinG: number } | null,
  copy: Translations['nutrition']['insights']
): NutritionInsight[] {
  if (quantity <= 0) return []
  const cal  = (food.caloriesPer100g * quantity) / 100
  const prot = (food.proteinPer100g  * quantity) / 100
  const fat  = (food.fatPer100g      * quantity) / 100

  const insights: NutritionInsight[] = []

  // Green — protein
  if (prot >= 15) {
    insights.push({ tier: 'green', label: copy.highProtein(Math.round(prot)) })
  } else if (prot >= 8) {
    insights.push({ tier: 'green', label: copy.goodProtein(Math.round(prot)) })
  }

  // Calories vs goal
  if (dailyGoal && dailyGoal.calories > 0) {
    const pct = cal / dailyGoal.calories
    if (pct >= 0.5) {
      insights.push({ tier: 'red', label: copy.veryHighCaloriePct(Math.round(pct * 100)) })
    } else if (pct >= 0.25) {
      insights.push({ tier: 'orange', label: copy.highCaloriePct(Math.round(pct * 100)) })
    }
  } else {
    if (cal >= 600)      insights.push({ tier: 'red',    label: copy.veryHighCalorie(Math.round(cal)) })
    else if (cal >= 350) insights.push({ tier: 'orange', label: copy.highCalorie(Math.round(cal)) })
  }

  // Fat vs goal
  if (dailyGoal && dailyGoal.fatG > 0) {
    const pct = fat / dailyGoal.fatG
    if (pct >= 0.5) {
      insights.push({ tier: 'red',    label: copy.veryHighFatPct(Math.round(pct * 100)) })
    } else if (pct >= 0.25) {
      insights.push({ tier: 'orange', label: copy.highFatPct(Math.round(pct * 100)) })
    }
  } else {
    if (fat >= 25)      insights.push({ tier: 'red',    label: copy.veryHighFat(Math.round(fat)) })
    else if (fat >= 15) insights.push({ tier: 'orange', label: copy.highFat(Math.round(fat)) })
  }

  return insights
}

type Props = {
  initialClientId: string | null
  initialWorkspaceId: string | null
  initialMealPlanTraining: FullMealPlan | null
  initialMealPlanRest: FullMealPlan | null
  initialDayLogs: DayLog[]
  initialPlanType: 'training' | 'rest'
  initialDate: string
}

export default function NutritionClient({
  initialClientId,
  initialWorkspaceId,
  initialMealPlanTraining,
  initialMealPlanRest,
  initialDayLogs,
  initialPlanType,
  initialDate,
}: Props) {
  const { t } = useLanguage()
  const [clientId] = useState(initialClientId)
  const [workspaceId] = useState(initialWorkspaceId)
  const [selectedDate, setSelectedDate] = useState<string>(initialDate)
  const [planType, setPlanType] = useState<'training' | 'rest'>(initialPlanType)
  const [mealPlanTraining, setMealPlanTraining] = useState(initialMealPlanTraining)
  const [mealPlanRest, setMealPlanRest] = useState(initialMealPlanRest)
  const mealPlan = planType === 'training' ? mealPlanTraining : mealPlanRest
  // Hide the toggle when both slots resolve to the same plan (overall-only clients).
  // Switching would show identical content, so the toggle is meaningless.
  const showPlanTypeToggle = mealPlanTraining?.id !== mealPlanRest?.id
  const [dayLogs, setDayLogs] = useState<DayLog[]>(initialDayLogs)
  const [loading, setLoading] = useState(false)
  const [activeAddFoodMeal, setActiveAddFoodMeal] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'diary' | 'notes'>('diary')
  const [errKey, setErrKey] = useState<'save' | 'load' | 'nameTaken' | null>(null)

  // Day state is stamped with the date it belongs to so a pending save can never
  // land under the wrong day while the client is flicking through the week.
  const [dayUi, setDayUi] = useState<{ date: string; state: DayUiState }>({
    date: initialDate,
    state: EMPTY_DAY_UI,
  })
  const [hydrated, setHydrated] = useState(false)
  const removedFoodIds = dayUi.state.removed
  const confirmedMeals = dayUi.state.confirmed
  const portionOverrides = dayUi.state.portions

  const [customMealNames, setCustomMealNames] = useState<string[]>([])

  const templateMealNames = useMemo(
    () => new Set(mealPlan?.meals.map((m) => m.name) ?? []),
    [mealPlan]
  )

  const loggedCustomMealNames = useMemo(
    () => [...new Set(dayLogs.map((l) => l.mealType).filter((t) => !templateMealNames.has(t)))],
    [dayLogs, templateMealNames]
  )

  const allCustomMealNames = useMemo(() => {
    const combined = [...loggedCustomMealNames]
    for (const n of customMealNames) {
      if (!combined.includes(n)) combined.push(n)
    }
    return combined
  }, [loggedCustomMealNames, customMealNames])

  const reloadDayLogs = useCallback(async () => {
    if (!clientId) return
    const logs = await getDayLogs(clientId, selectedDate)
    setDayLogs(logs)
  }, [clientId, selectedDate])

  const updateUi = useCallback((fn: (s: DayUiState) => DayUiState) => {
    setDayUi((prev) => {
      const next = fn(prev.state)
      return next === prev.state ? prev : { date: prev.date, state: next }
    })
  }, [])

  // Restore this client's saved choices for the initial day. Storage is
  // browser-only, so it can't be read during the server render — and the read
  // must land before the first save effect, or an empty state would overwrite
  // what was stored.
  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setDayUi((prev) =>
        prev.date === initialDate && prev.state === EMPTY_DAY_UI
          ? { date: initialDate, state: loadDayUiState(clientId, initialDate) }
          : prev
      )
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [clientId, initialDate])

  useEffect(() => {
    if (!clientId || !hydrated) return
    saveDayUiState(clientId, dayUi.date, dayUi.state)
  }, [clientId, hydrated, dayUi])

  // Moving to another day reloads that day's logs *and* its plan: a date override
  // or a carb-cycle day can put an entirely different plan on that date, and the
  // server render only ever resolved today's.
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (!clientId) return
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    let cancelled = false
    setLoading(true)
    setCustomMealNames([])
    setActiveAddFoodMeal(null)
    setErrKey(null)
    ;(async () => {
      try {
        const [plans, logs] = await Promise.all([
          getMealPlansForDate(selectedDate),
          getDayLogs(clientId, selectedDate),
        ])
        if (cancelled) return
        setMealPlanTraining(plans.training)
        setMealPlanRest(plans.rest)
        setDayLogs(logs)
      } catch {
        if (!cancelled) setErrKey('load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientId, selectedDate])

  const handleSelectDate = useCallback(
    (d: string) => {
      if (d === selectedDate) return
      // Swap in that day's saved choices synchronously so removed foods don't
      // flash back into view for a frame before storage is read.
      if (clientId) setDayUi({ date: d, state: loadDayUiState(clientId, d) })
      else setDayUi({ date: d, state: EMPTY_DAY_UI })
      setSelectedDate(d)
    },
    [clientId, selectedDate]
  )

  const logsByMealType = useMemo(() => {
    const m = new Map<string, DayLog[]>()
    for (const l of dayLogs) {
      const list = m.get(l.mealType) ?? []
      list.push(l)
      m.set(l.mealType, list)
    }
    return m
  }, [dayLogs])

  const goal = useMemo(() => {
    if (!mealPlan) return null
    let cal = 0
    let p = 0
    let c = 0
    let f = 0
    for (const meal of mealPlan.meals) {
      const optA = meal.options.find((o) => o.label === 'A') ?? meal.options[0]
      if (!optA) continue
      for (const food of optA.foods) {
        cal += food.calories
        p += food.proteinG
        c += food.carbsG
        f += food.fatG
      }
    }
    return { calories: round1(cal), proteinG: round1(p), carbsG: round1(c), fatG: round1(f) }
  }, [mealPlan])

  const totals = useMemo(() => {
    let cal = 0
    let p = 0
    let c = 0
    let f = 0
    for (const l of dayLogs) {
      cal += l.calories
      p += l.proteinG
      c += l.carbsG
      f += l.fatG
    }
    return { calories: round1(cal), proteinG: round1(p), carbsG: round1(c), fatG: round1(f) }
  }, [dayLogs])

  const handleSetPlanType = (t: 'training' | 'rest') => {
    setPlanType(t)
  }

  /**
   * The amount of a plan food that should be treated as eaten: an explicit resize
   * by the client wins, then whatever is already logged, then the plan's own
   * portion. Deriving it per food (rather than rebuilding one map from the logs)
   * is what keeps an unsaved portion edit alive while other meals are saved.
   */
  const resolveQty = useCallback(
    (mealName: string, food: FoodItem) => {
      const override = portionOverrides[food.id]
      if (override != null && override > 0) return override
      const log = (logsByMealType.get(mealName) ?? []).find((l) => l.templateFoodId === food.id)
      return log?.quantity ?? food.quantity
    },
    [portionOverrides, logsByMealType]
  )

  const logMealFoods = useCallback(
    async (meal: Meal, option: Option, foods: FoodItem[]) => {
      if (!clientId || !workspaceId || foods.length === 0) return
      await logMealOption({
        clientId,
        workspaceId,
        loggedDate: selectedDate,
        mealType: meal.name,
        mealOptionId: option.id,
        foods: foods.map((f) => {
          const qty = resolveQty(meal.name, f)
          const ratio = portionRatio(f.quantity, qty)
          return {
            templateFoodId: f.id,
            foodName: f.foodName,
            quantity: qty,
            unit: f.unit,
            calories: round1(f.calories * ratio),
            proteinG: round1(f.proteinG * ratio),
            carbsG: round1(f.carbsG * ratio),
            fatG: round1(f.fatG * ratio),
          }
        }),
      })
      // Real plan logs now carry this meal, so the custom-only marker is spent.
      updateUi((s) => ({ ...s, confirmed: omitKey(s.confirmed, meal.name) }))
      await reloadDayLogs()
    },
    [clientId, workspaceId, selectedDate, resolveQty, updateUi, reloadDayLogs]
  )

  const handleLogMeal = async (meal: Meal, option: Option) => {
    setErrKey(null)
    try {
      await logMealFoods(meal, option, option.foods.filter((f) => removedFoodIds[f.id] == null))
    } catch {
      setErrKey('save')
      throw new Error('log-failed')
    }
  }

  /**
   * Unchecking a meal only ever clears the foods that came from the plan. Foods
   * the client added themselves stay put — they disappear only when the client
   * removes them by hand.
   */
  const handleUnlogMeal = async (mealName: string, hadPlanLogs: boolean) => {
    setErrKey(null)
    updateUi((s) => ({ ...s, confirmed: omitKey(s.confirmed, mealName) }))
    if (!clientId || !hadPlanLogs) return
    try {
      await removeOptionLog(clientId, selectedDate, mealName)
      await reloadDayLogs()
    } catch {
      setErrKey('save')
      throw new Error('unlog-failed')
    }
  }

  /** Marks a meal as eaten when nothing from the plan is left in it. */
  const handleConfirmMeal = (mealName: string, value: boolean) => {
    updateUi((s) => ({
      ...s,
      confirmed: value ? { ...s.confirmed, [mealName]: true } : omitKey(s.confirmed, mealName),
    }))
  }

  const handleDeleteFood = async (
    mealName: string,
    foodId: string,
    loggedFoodId?: string | null
  ) => {
    setErrKey(null)
    const logs = logsByMealType.get(mealName) ?? []
    const planLogsLeft = logs.filter((l) => l.templateFoodId !== null && l.id !== loggedFoodId)
    const hasCustomLogs = logs.some((l) => l.templateFoodId === null)
    updateUi((s) => ({
      ...s,
      removed: { ...s.removed, [foodId]: nextRemovalSeq(s.removed) },
      // Removing the last logged plan food would otherwise silently uncheck a
      // meal the client already marked as eaten; the custom foods still standing
      // in for it keep it checked.
      confirmed:
        loggedFoodId && planLogsLeft.length === 0 && hasCustomLogs
          ? { ...s.confirmed, [mealName]: true }
          : s.confirmed,
    }))
    if (!loggedFoodId) return
    try {
      await deleteNutritionLog(loggedFoodId)
      await reloadDayLogs()
    } catch {
      setErrKey('save')
    }
  }

  /**
   * Brings back every pre-filled food the client removed from this option. Foods
   * they added themselves are untouched — restoring the plan is additive, it
   * never clears their own entries.
   */
  const handleRestorePlanFoods = async (meal: Meal, option: Option, relog: boolean) => {
    setErrKey(null)
    updateUi((s) => {
      const removed = { ...s.removed }
      let changed = false
      for (const f of option.foods) {
        if (removed[f.id] != null) {
          delete removed[f.id]
          changed = true
        }
      }
      if (!changed) return s
      return { ...s, removed, confirmed: omitKey(s.confirmed, meal.name) }
    })
    // A meal that is already checked has to stay accurate: the foods coming back
    // belong in its log too. A meal that was only marked eaten through custom
    // foods stays unchecked, so the client submits the restored plan themselves.
    if (!relog) return
    try {
      await logMealFoods(meal, option, option.foods)
    } catch {
      setErrKey('save')
    }
  }

  /**
   * Puts back only the food removed most recently from this option — the
   * step-by-step counterpart to restoring the whole option at once.
   */
  const handleUndoRemoval = async (meal: Meal, option: Option, relog: boolean) => {
    setErrKey(null)
    const target = lastRemovedOf(removedFoodIds, option.foods.map((f) => f.id))
    if (!target) return
    updateUi((s) => ({
      ...s,
      removed: omitKey(s.removed, target),
      confirmed: omitKey(s.confirmed, meal.name),
    }))
    if (!relog) return
    try {
      await logMealFoods(
        meal,
        option,
        option.foods.filter((f) => f.id === target || removedFoodIds[f.id] == null)
      )
    } catch {
      setErrKey('save')
    }
  }

  const handleDeleteCustom = async (logId: string) => {
    setErrKey(null)
    try {
      await deleteNutritionLog(logId)
      await reloadDayLogs()
    } catch {
      setErrKey('save')
    }
  }

  const handleUpdateCustomQty = async (logId: string, newQty: number) => {
    if (!(newQty > 0)) return
    setErrKey(null)
    try {
      // Macros are recomputed server-side from the stored row, so only the new
      // quantity needs to be sent.
      await updateNutritionLogQuantity(logId, newQty)
      await reloadDayLogs()
    } catch {
      setErrKey('save')
    }
  }

  /**
   * Resizing a plan portion. When the meal is already logged the change is
   * pushed to that log immediately, so the day's totals match what the card
   * shows instead of drifting until the client happens to re-submit.
   */
  const handlePortionOverride = async (mealName: string, foodId: string, qty: number) => {
    if (!(qty > 0)) return
    setErrKey(null)
    updateUi((s) => ({ ...s, portions: { ...s.portions, [foodId]: qty } }))
    const log = (logsByMealType.get(mealName) ?? []).find((l) => l.templateFoodId === foodId)
    if (!log) return
    try {
      await updateNutritionLogQuantity(log.id, qty)
      await reloadDayLogs()
    } catch {
      setErrKey('save')
    }
  }

  const handleAddCustomFood = async (
    mealName: string,
    payload: {
      foodName: string
      quantity: number
      unit: string
      calories: number
      proteinG: number
      carbsG: number
      fatG: number
    }
  ) => {
    if (!clientId || !workspaceId) return
    setErrKey(null)
    try {
      await logCustomFood({
        clientId,
        workspaceId,
        loggedDate: selectedDate,
        mealType: mealName,
        ...payload,
      })
      await reloadDayLogs()
      setActiveAddFoodMeal(null)
    } catch {
      // Leave the panel open so the entry isn't lost and can be retried.
      setErrKey('save')
    }
  }

  const handleAddCustomMeal = () => {
    const total = allCustomMealNames.length
    let candidate = total === 0 ? 'Custom Meal' : `Custom Meal ${total + 1}`
    let i = total + 1
    while (allCustomMealNames.includes(candidate) || templateMealNames.has(candidate)) {
      i++
      candidate = `Custom Meal ${i}`
    }
    setCustomMealNames((prev) => [...prev, candidate])
  }

  const handleRenameCustomMeal = async (oldName: string, newName: string): Promise<boolean> => {
    const trimmed = newName.trim()
    if (!trimmed) return false
    if (trimmed === oldName) return true
    // Reusing a plan meal's name would silently merge these foods into it.
    if (templateMealNames.has(trimmed) || allCustomMealNames.includes(trimmed)) {
      setErrKey('nameTaken')
      return false
    }
    setErrKey(null)
    const hasLogs = (logsByMealType.get(oldName) ?? []).length > 0
    if (hasLogs && clientId) {
      try {
        await renameCustomMealLogs(clientId, selectedDate, oldName, trimmed)
        await reloadDayLogs()
      } catch {
        setErrKey('save')
        return false
      }
    }
    setCustomMealNames((prev) => prev.map((n) => (n === oldName ? trimmed : n)))
    return true
  }

  const handleRemoveCustomMeal = async (mealName: string) => {
    setErrKey(null)
    if (clientId) {
      try {
        // A custom meal is entirely client-added, so clear all of its logs.
        await removeOptionLog(clientId, selectedDate, mealName, false)
        await reloadDayLogs()
      } catch {
        setErrKey('save')
        return
      }
    }
    updateUi((s) => ({ ...s, confirmed: omitKey(s.confirmed, mealName) }))
    setCustomMealNames((prev) => prev.filter((n) => n !== mealName))
  }

  const errorText =
    errKey === 'nameTaken'
      ? t.nutrition.nameTaken
      : errKey
        ? t.nutrition.saveFailed
        : null

  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      <div className="cx-in" style={{ padding: '52px 20px 10px' }}>
        <div className="flex items-start justify-between">
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-hint)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
            </p>
            <h1 className="cx-display cx-display-lg" style={{ fontSize: '30px', fontWeight: 800, color: 'var(--color-text-primary)', margin: '2px 0 0', lineHeight: 1.1 }}>
              {t.nutrition.title}
            </h1>
          </div>
          {showPlanTypeToggle && (
            <PlanTypeToggle value={planType} onChange={handleSetPlanType} />
          )}
        </div>
      </div>

      <div className="cx-in" style={{ '--cx-i': 1, padding: '0 16px 12px' } as React.CSSProperties}>
        <WeekStrip selectedDate={selectedDate} onSelect={handleSelectDate} todayISO={initialDate} />
      </div>

      {errorText && (
        <div style={{ padding: '0 16px 10px' }}>
          <div
            className="flex items-center gap-2"
            role="status"
            style={{
              backgroundColor: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 12,
              padding: '9px 12px',
            }}
          >
            <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: '#ef4444', fontWeight: 500, flex: 1 }}>
              {errorText}
            </span>
            <button
              type="button"
              onClick={() => setErrKey(null)}
              aria-label={t.common.close}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#ef4444',
                display: 'inline-flex',
                padding: 0,
              }}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="cx-in" style={{ '--cx-i': 2, padding: '0 16px 10px' } as React.CSSProperties}>
        <CaloriesCard current={totals.calories} goal={goal?.calories ?? null} />
      </div>

      <div className="cx-in" style={{ '--cx-i': 3, padding: '0 16px 16px' } as React.CSSProperties}>
        <MacrosCard totals={totals} goal={goal} />
      </div>

      <div className="cx-in" style={{ '--cx-i': 4, padding: '0 16px 12px' } as React.CSSProperties}>
        <DiaryNotesTabs tab={tab} onChange={setTab} />
      </div>

      {tab === 'diary' ? (
        <div style={{ padding: '0 16px 16px' }}>
          <div
            className="flex flex-col gap-3"
            style={{
              opacity: loading ? 0.4 : 1,
              transition: 'opacity 0.15s ease',
              pointerEvents: loading ? 'none' : 'auto',
            }}
          >
            {!mealPlan && allCustomMealNames.length === 0 && (
              <NoPlanCard planType={planType} />
            )}
            {mealPlan && mealPlan.meals.map((meal) => {
              const logs = logsByMealType.get(meal.name) ?? []
              const planLogs = logs.filter((l) => l.templateFoodId !== null)
              const customLogs = logs.filter((l) => l.templateFoodId === null)
              const loggedOptionId = planLogs[0]?.mealOptionId ?? null
              const optKey = meal.id
              const userSelectedOption =
                selectedOption[optKey] ??
                loggedOptionId ??
                (meal.options[0]?.id ?? '')
              const activeOption =
                meal.options.find((o) => o.id === userSelectedOption) ?? meal.options[0]
              return (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  activeOption={activeOption}
                  customLogs={customLogs}
                  planLogs={planLogs}
                  portionOverrides={portionOverrides}
                  removedFoodIds={removedFoodIds}
                  confirmed={!!confirmedMeals[meal.name]}
                  onSelectOption={(optId) =>
                    setSelectedOption((prev) => ({ ...prev, [optKey]: optId }))
                  }
                  onLogMeal={async () => { if (activeOption) await handleLogMeal(meal, activeOption) }}
                  onUnlogMeal={(hadPlanLogs) => handleUnlogMeal(meal.name, hadPlanLogs)}
                  onConfirmMeal={(v) => handleConfirmMeal(meal.name, v)}
                  onRestorePlanFoods={async (relog) => {
                    if (activeOption) await handleRestorePlanFoods(meal, activeOption, relog)
                  }}
                  onUndoRemoval={async (relog) => {
                    if (activeOption) await handleUndoRemoval(meal, activeOption, relog)
                  }}
                  onDeleteCustom={handleDeleteCustom}
                  onUpdateCustomQty={handleUpdateCustomQty}
                  onPortionOverride={(foodId, qty) =>
                    handlePortionOverride(meal.name, foodId, qty)
                  }
                  onDeleteFood={(foodId, loggedFoodId) =>
                    handleDeleteFood(meal.name, foodId, loggedFoodId)
                  }
                  addFoodOpen={activeAddFoodMeal === meal.name}
                  onToggleAddFood={() =>
                    setActiveAddFoodMeal(activeAddFoodMeal === meal.name ? null : meal.name)
                  }
                  onAddCustomFood={(p) => handleAddCustomFood(meal.name, p)}
                  clientId={clientId}
                  workspaceId={workspaceId}
                  logDate={selectedDate}
                  onLogged={reloadDayLogs}
                  dailyGoal={goal}
                />
              )
            })}
            {allCustomMealNames.map((mealName) => (
              <CustomMealCard
                key={mealName}
                mealName={mealName}
                logs={logsByMealType.get(mealName) ?? []}
                addFoodOpen={activeAddFoodMeal === mealName}
                onToggleAddFood={() =>
                  setActiveAddFoodMeal(activeAddFoodMeal === mealName ? null : mealName)
                }
                onAddCustomFood={(p) => handleAddCustomFood(mealName, p)}
                onDeleteCustom={handleDeleteCustom}
                onUpdateCustomQty={handleUpdateCustomQty}
                onRename={(newName) => handleRenameCustomMeal(mealName, newName)}
                onRemove={() => handleRemoveCustomMeal(mealName)}
                clientId={clientId}
                workspaceId={workspaceId}
                logDate={selectedDate}
                onLogged={reloadDayLogs}
                dailyGoal={goal}
              />
            ))}
            <button
              type="button"
              onClick={handleAddCustomMeal}
              className="cx-press cx-tint"
              style={{
                width: '100%',
                color: 'var(--color-text-muted)',
                backgroundColor: 'transparent',
                border: '1px dashed var(--color-border-strong)',
                borderRadius: 'var(--cx-r-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '13px 0',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <Plus size={15} />
              {t.nutrition.addFood}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 16px 16px' }}>
          <NotesCard plan={mealPlan} />
        </div>
      )}
    </div>
  )
}

function PlanTypeToggle({
  value,
  onChange,
}: {
  value: 'training' | 'rest'
  onChange: (v: 'training' | 'rest') => void
}) {
  const { t } = useLanguage()
  const activeIdx = value === 'training' ? 0 : 1
  const accent = value === 'training' ? '#3b82f6' : '#22c55e'
  return (
    <div
      className="cx-seg"
      role="group"
      style={{
        display: 'inline-flex',
        '--cx-seg-n': 2,
        '--cx-seg-i': activeIdx,
      } as React.CSSProperties}
    >
      {/* Thumb carries the state colour, so switching plan types slides
          rather than repainting two separate buttons. */}
      <div className="cx-seg-thumb" aria-hidden="true" style={{ backgroundColor: accent }} />
      {(['training', 'rest'] as const).map((planKey) => {
        const active = value === planKey
        return (
          <button
            key={planKey}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(planKey)}
            className="cx-seg-btn"
            style={{
              padding: '5px 11px',
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              color: active ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {planKey === 'training' ? t.nutrition.planTraining : t.nutrition.planRest}
          </button>
        )
      })}
    </div>
  )
}

function WeekStrip({
  selectedDate,
  onSelect,
  todayISO,
}: {
  selectedDate: string
  onSelect: (d: string) => void
  todayISO: string
}) {
  const days = useMemo(() => {
    const start = startOfWeek(new Date(selectedDate + 'T00:00:00'))
    const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    const arr: { iso: string; label: string; num: number; isToday: boolean }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const iso = isoFromDate(d)
      arr.push({ iso, label: labels[i], num: d.getDate(), isToday: iso === todayISO })
    }
    return arr
  }, [selectedDate, todayISO])

  return (
    <div
      className="flex items-center justify-between"
      style={{ gap: 6 }}
    >
      {days.map((d) => {
        const active = d.iso === selectedDate
        return (
          <button
            key={d.iso}
            type="button"
            onClick={() => onSelect(d.iso)}
            aria-pressed={active}
            className="cx-press cx-tint flex flex-col items-center justify-center"
            style={{
              flex: 1,
              padding: '10px 4px',
              backgroundColor: active ? 'var(--color-accent)' : 'var(--color-surface-1)',
              border: '1px solid ' + (active ? 'var(--color-accent)' : 'var(--color-border)'),
              borderRadius: 'var(--cx-r-md)',
              cursor: 'pointer',
              gap: 5,
              position: 'relative',
              // Only the selected day lifts off the page
              boxShadow: active ? 'var(--cx-shadow-cta)' : 'var(--cx-shadow-sm)',
            }}
          >
            <span style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.85)' : 'var(--color-text-hint)', fontWeight: 700, letterSpacing: '0.04em' }}>
              {d.label}
            </span>
            <span
              className="cx-num"
              style={{
                fontSize: 15.5,
                fontWeight: 800,
                color: active ? '#fff' : 'var(--color-text-primary)',
                lineHeight: 1,
              }}
            >
              {d.num}
            </span>
            {d.isToday && !active && (
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent)',
                  display: 'block',
                }}
              />
            )}
            {(!d.isToday || active) && <span style={{ width: 4, height: 4, display: 'block' }} />}
          </button>
        )
      })}
    </div>
  )
}

function CaloriesCard({
  current,
  goal,
}: {
  current: number
  goal: number | null
}) {
  const { t } = useLanguage()
  const remaining = goal ? Math.max(0, goal - current) : null
  const pct = goal ? Math.min(1, current / goal) : 0
  return (
    <div
      className="cx-card"
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--cx-r-lg)',
        padding: '16px 18px 18px',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-hint)', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t.nutrition.calories}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="cx-num" style={{ fontSize: 38, fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>
              {Math.round(current)}
            </span>
            {goal !== null && (
              <span className="cx-num" style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-hint)' }}>
                / {Math.round(goal)}
              </span>
            )}
          </div>
        </div>
        {remaining !== null && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-hint)', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t.nutrition.remaining}
            </p>
            <span className="cx-num" style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-accent)', lineHeight: 1 }}>
              {Math.round(remaining)}
            </span>
          </div>
        )}
      </div>
      {goal !== null && (
        <div
          style={{
            height: 6,
            backgroundColor: 'var(--color-surface-3)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            className="cx-bar-fill"
            style={{
              '--cx-p': pct,
              height: '100%',
              backgroundColor: 'var(--color-accent)',
            } as React.CSSProperties}
          />
        </div>
      )}
    </div>
  )
}

function MacrosCard({
  totals,
  goal,
}: {
  totals: { proteinG: number; carbsG: number; fatG: number }
  goal: { proteinG: number; carbsG: number; fatG: number } | null
}) {
  const { t } = useLanguage()
  return (
    <div
      className="cx-card"
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--cx-r-lg)',
        padding: '15px 16px',
      }}
    >
      <div className="grid grid-cols-3 gap-3">
        <MacroCol label={t.nutrition.protein} current={totals.proteinG} goal={goal?.proteinG ?? null} color={COLOR_PROTEIN} />
        <MacroCol label={t.nutrition.carbs}   current={totals.carbsG}   goal={goal?.carbsG ?? null}   color={COLOR_CARBS} />
        <MacroCol label={t.nutrition.fat}     current={totals.fatG}     goal={goal?.fatG ?? null}     color={COLOR_FAT} />
      </div>
    </div>
  )
}

function MacroCol({
  label,
  current,
  goal,
  color,
}: {
  label: string
  current: number
  goal: number | null
  color: string
}) {
  const pct = goal ? Math.min(1, current / goal) : 0
  return (
    <div className="flex flex-col">
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 5 }}>
        {label}
      </span>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="cx-num" style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text-primary)' }}>
          {Math.round(current)}g
        </span>
        {goal !== null && (
          <span className="cx-num" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-hint)' }}>/ {Math.round(goal)}g</span>
        )}
      </div>
      <div
        style={{
          height: 5,
          backgroundColor: 'var(--color-surface-3)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          className="cx-bar-fill"
          style={{
            '--cx-p': pct,
            height: '100%',
            backgroundColor: color,
          } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

function DiaryNotesTabs({
  tab,
  onChange,
}: {
  tab: 'diary' | 'notes'
  onChange: (t: 'diary' | 'notes') => void
}) {
  const { t: tr } = useLanguage()
  return (
    <div
      className="cx-seg"
      role="tablist"
      style={{
        display: 'inline-flex',
        '--cx-seg-n': 2,
        '--cx-seg-i': tab === 'diary' ? 0 : 1,
      } as React.CSSProperties}
    >
      <div className="cx-seg-thumb" aria-hidden="true" />
      {(['diary', 'notes'] as const).map((tab2) => {
        const active = tab === tab2
        return (
          <button
            key={tab2}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab2)}
            className="cx-seg-btn"
            style={{
              padding: '8px 18px',
              fontSize: 13.5,
              fontWeight: active ? 700 : 600,
              whiteSpace: 'nowrap',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            }}
          >
            {tab2 === 'diary' ? tr.nutrition.title : tr.workouts.notes}
          </button>
        )
      })}
    </div>
  )
}

function NoPlanCard({ planType }: { planType: 'training' | 'rest' }) {
  const { t } = useLanguage()
  void planType
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px dashed var(--color-border-strong)',
        borderRadius: 'var(--cx-r-lg)',
        padding: '24px 16px',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
        {t.nutrition.emptyMeal}
      </p>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
        {t.workouts.coachWillAdd}
      </p>
    </div>
  )
}

function CustomMealCard({
  mealName,
  logs,
  addFoodOpen,
  onToggleAddFood,
  onAddCustomFood,
  onDeleteCustom,
  onUpdateCustomQty,
  onRename,
  onRemove,
  clientId,
  workspaceId,
  logDate,
  onLogged,
  dailyGoal,
}: {
  mealName: string
  logs: DayLog[]
  addFoodOpen: boolean
  onToggleAddFood: () => void
  onAddCustomFood: (p: {
    foodName: string
    quantity: number
    unit: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }) => Promise<void> | void
  onDeleteCustom: (logId: string) => void
  onUpdateCustomQty: (logId: string, newQty: number) => Promise<void>
  onRename: (newName: string) => Promise<boolean>
  onRemove: () => void
  clientId?: string | null
  workspaceId?: string | null
  logDate?: string
  onLogged?: () => void
  dailyGoal?: { calories: number; fatG: number; proteinG: number } | null
}) {
  const { t } = useLanguage()
  const cancelLabel = t.common.cancel
  const addFoodLabel = t.nutrition.addFood
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(mealName)
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null)
  const [customEditQty, setCustomEditQty] = useState('')
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, l) => ({
          calories: round1(acc.calories + l.calories),
          proteinG: round1(acc.proteinG + l.proteinG),
          carbsG: round1(acc.carbsG + l.carbsG),
          fatG: round1(acc.fatG + l.fatG),
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      ),
    [logs]
  )

  const handleConfirmRename = async () => {
    // Keep the field open on a rejected name (blank or already taken) so the
    // client can correct it instead of silently losing what they typed.
    const ok = await onRename(nameInput)
    if (ok) setEditingName(false)
  }

  const handleConfirmCustomEdit = async (log: DayLog) => {
    const qty = parseFloat(customEditQty)
    if (qty > 0) await onUpdateCustomQty(log.id, qty)
    setEditingCustomId(null)
  }

  // Deleting a custom meal throws away every food in it, so it takes two taps.
  const handleRemoveTap = () => {
    if (logs.length === 0 || confirmingRemove) {
      onRemove()
      setConfirmingRemove(false)
      return
    }
    setConfirmingRemove(true)
    setTimeout(() => setConfirmingRemove(false), 3000)
  }

  return (
    <div
      className="cx-card"
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--cx-r-lg)',
        padding: '14px 16px',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
          {editingName ? (
            <div className="flex items-center gap-1.5" style={{ flex: 1, minWidth: 0 }}>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmRename()
                  if (e.key === 'Escape') { setEditingName(false); setNameInput(mealName) }
                }}
                autoFocus
                style={{
                  flex: 1,
                  padding: '3px 8px',
                  fontSize: 17,
                  fontWeight: 700,
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-accent)',
                  borderRadius: 8,
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  minWidth: 0,
                }}
              />
              <button
                type="button"
                onClick={handleConfirmRename}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#22c55e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}
              >
                <Check size={14} strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={() => { setEditingName(false); setNameInput(mealName) }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>
                {mealName}
              </span>
              <button
                type="button"
                onClick={() => { setEditingName(true); setNameInput(mealName) }}
                title={t.common.edit}
                aria-label={t.common.edit}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, flexShrink: 0 }}
              >
                <Pencil size={12} />
              </button>
              {logs.length > 0 && (
                <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                  <Pill value={Math.round(totals.calories)} color="var(--color-text-primary)" bg="var(--color-surface-3)" />
                  <Pill value={Math.round(totals.proteinG)} color={COLOR_PROTEIN} bg="rgba(59,130,246,0.12)" />
                  <Pill value={Math.round(totals.carbsG)} color={COLOR_CARBS} bg="rgba(249,115,22,0.12)" />
                  <Pill value={Math.round(totals.fatG)} color={COLOR_FAT} bg="rgba(239,68,68,0.12)" />
                </div>
              )}
            </>
          )}
        </div>
        {!editingName && (
          <button
            type="button"
            onClick={handleRemoveTap}
            title={confirmingRemove ? t.nutrition.confirmRemoveMeal : t.nutrition.removeMeal}
            aria-label={confirmingRemove ? t.nutrition.confirmRemoveMeal : t.nutrition.removeMeal}
            className="flex items-center justify-center"
            style={{
              background: confirmingRemove ? 'rgba(239,68,68,0.12)' : 'transparent',
              border: confirmingRemove ? '1px solid rgba(239,68,68,0.4)' : 'none',
              borderRadius: 999,
              cursor: 'pointer',
              color: confirmingRemove ? '#ef4444' : 'var(--color-text-hint)',
              padding: confirmingRemove ? '3px 9px' : 0,
              width: confirmingRemove ? 'auto' : 24,
              height: 24,
              fontSize: 11,
              fontWeight: 700,
              gap: 4,
              flexShrink: 0,
            }}
          >
            <X size={15} />
            {confirmingRemove && <span>{t.common.confirm}</span>}
          </button>
        )}
      </div>

      {logs.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          {logs.map((l) => (
            <CustomFoodRow
              key={l.id}
              log={l}
              editing={editingCustomId === l.id}
              editQty={customEditQty}
              onEditQtyChange={setCustomEditQty}
              onStartEdit={() => {
                setEditingCustomId(l.id)
                setCustomEditQty(String(l.quantity))
              }}
              onCancelEdit={() => setEditingCustomId(null)}
              onConfirmEdit={() => handleConfirmCustomEdit(l)}
              onDelete={() => onDeleteCustom(l.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={onToggleAddFood}
          style={{
            width: '100%',
            color: addFoodOpen ? 'var(--color-text-muted)' : 'var(--color-accent)',
            backgroundColor: 'transparent',
            border: '1px solid ' + (addFoodOpen ? 'var(--color-border)' : 'rgba(249,115,22,0.3)'),
            borderRadius: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '11px 0',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <Plus size={15} />
          {addFoodOpen ? cancelLabel : addFoodLabel}
        </button>
        {addFoodOpen && (
          <AddCustomFood
            mealName={mealName}
            onAdd={onAddCustomFood}
            clientId={clientId}
            workspaceId={workspaceId}
            logDate={logDate}
            onLogged={onLogged}
            dailyGoal={dailyGoal}
          />
        )}
      </div>
    </div>
  )
}

function MealCard({
  meal,
  activeOption,
  customLogs,
  planLogs,
  portionOverrides,
  removedFoodIds,
  confirmed,
  onSelectOption,
  onLogMeal,
  onUnlogMeal,
  onConfirmMeal,
  onRestorePlanFoods,
  onUndoRemoval,
  onDeleteCustom,
  onUpdateCustomQty,
  onPortionOverride,
  onDeleteFood,
  addFoodOpen,
  onToggleAddFood,
  onAddCustomFood,
  clientId,
  workspaceId,
  logDate,
  onLogged,
  dailyGoal,
}: {
  meal: Meal
  activeOption: Option | undefined
  customLogs: DayLog[]
  planLogs: DayLog[]
  portionOverrides: Record<string, number>
  removedFoodIds: Record<string, number>
  confirmed: boolean
  onSelectOption: (id: string) => void
  onLogMeal: () => Promise<void>
  onUnlogMeal: (hadPlanLogs: boolean) => Promise<void>
  onConfirmMeal: (value: boolean) => void
  onRestorePlanFoods: (relog: boolean) => Promise<void>
  onUndoRemoval: (relog: boolean) => Promise<void>
  onDeleteCustom: (logId: string) => void
  onUpdateCustomQty: (logId: string, newQty: number) => Promise<void>
  onPortionOverride: (foodId: string, qty: number) => void
  onDeleteFood: (foodId: string, loggedFoodId?: string | null) => Promise<void>
  addFoodOpen: boolean
  onToggleAddFood: () => void
  onAddCustomFood: (p: {
    foodName: string
    quantity: number
    unit: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }) => Promise<void> | void
  clientId?: string | null
  workspaceId?: string | null
  logDate?: string
  onLogged?: () => void
  dailyGoal?: { calories: number; fatG: number; proteinG: number } | null
}) {
  const { t } = useLanguage()
  const cancelLabel = t.common.cancel
  const addFoodLabel = t.nutrition.addFood
  const [circleLoading, setCircleLoading] = useState(false)
  const [optimisticLogged, setOptimisticLogged] = useState<boolean | null>(null)
  const [circleError, setCircleError] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null)
  const [customEditQty, setCustomEditQty] = useState('')

  const hasPlanLogs = planLogs.length > 0

  // Which option the logs belong to matters: while previewing a different option
  // the card must show that option's foods, not hide them because *some* other
  // option happens to be logged. Matching on the logged foods rather than on
  // meal_option_id also survives a coach edit that clears that column.
  const loggedFoodIds = useMemo(
    () => new Set(planLogs.map((l) => l.templateFoodId).filter((id): id is string => !!id)),
    [planLogs]
  )
  const optionIsLogged = useCallback(
    (o: Option) => o.foods.some((f) => loggedFoodIds.has(f.id)),
    [loggedFoodIds]
  )
  const activeOptionIsLogged = !!activeOption && optionIsLogged(activeOption)

  // A plan food is out of this meal if the client removed it here, or — once the
  // option is logged — if it simply isn't in the log. The second case covers a
  // removal made on another device, where only the log tells the story, and
  // keeps the card's numbers equal to the day's totals.
  const visibleFoods = useMemo(
    () =>
      (activeOption?.foods ?? []).filter(
        (f) => removedFoodIds[f.id] == null && (!activeOptionIsLogged || loggedFoodIds.has(f.id))
      ),
    [activeOption, removedFoodIds, activeOptionIsLogged, loggedFoodIds]
  )
  const removedCount = (activeOption?.foods ?? []).length - visibleFoods.length

  // Undo steps back through this option's own removals. A food hidden only
  // because it isn't in the log has no removal to step back through, so undo
  // stays out of the way there and the restore button covers it.
  const canUndo = (activeOption?.foods ?? []).some((f) => removedFoodIds[f.id] != null)
  const hasCustomLogs = customLogs.length > 0

  // The circle is the client's own statement that they ate this meal — adding or
  // removing foods never ticks it on their behalf. It is on when the option in
  // view is logged, or when they confirmed a meal that has no plan foods left.
  const baseLogged = activeOptionIsLogged || confirmed
  const effectiveLogged = optimisticLogged !== null ? optimisticLogged : baseLogged

  // Enable the circle whenever there is something to record or undo.
  const canLog = visibleFoods.length > 0 || hasCustomLogs || baseLogged

  const resolveQty = useCallback(
    (f: FoodItem) => {
      const override = portionOverrides[f.id]
      if (override != null && override > 0) return override
      const log = planLogs.find((l) => l.templateFoodId === f.id)
      return log?.quantity ?? f.quantity
    },
    [portionOverrides, planLogs]
  )

  const handleCircleTap = async () => {
    if (circleLoading || !canLog) return
    const next = !effectiveLogged
    setOptimisticLogged(next)
    setCircleLoading(true)
    setCircleError(false)
    try {
      if (next) {
        if (visibleFoods.length > 0) await onLogMeal()
        // Nothing from the plan is left, so there is nothing to write: the meal
        // is carried by the client's own foods, which are already saved.
        else onConfirmMeal(true)
      } else {
        await onUnlogMeal(hasPlanLogs)
      }
    } catch {
      setOptimisticLogged(!next)
      setCircleError(true)
      setTimeout(() => setCircleError(false), 2000)
      return
    } finally {
      setCircleLoading(false)
    }
    setOptimisticLogged(null)
  }

  const handleRestore = async () => {
    if (restoring || undoing) return
    setRestoring(true)
    try {
      await onRestorePlanFoods(activeOptionIsLogged)
    } finally {
      setRestoring(false)
    }
  }

  const handleUndo = async () => {
    if (undoing || restoring) return
    setUndoing(true)
    try {
      await onUndoRemoval(activeOptionIsLogged)
    } finally {
      setUndoing(false)
    }
  }

  const totals = useMemo(() => {
    const base = visibleFoods.reduce(
      (acc, f) => {
        const ratio = portionRatio(f.quantity, resolveQty(f))
        return {
          calories: round1(acc.calories + f.calories * ratio),
          proteinG: round1(acc.proteinG + f.proteinG * ratio),
          carbsG: round1(acc.carbsG + f.carbsG * ratio),
          fatG: round1(acc.fatG + f.fatG * ratio),
        }
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    )

    return customLogs.reduce(
      (acc, l) => ({
        calories: round1(acc.calories + l.calories),
        proteinG: round1(acc.proteinG + l.proteinG),
        carbsG: round1(acc.carbsG + l.carbsG),
        fatG: round1(acc.fatG + l.fatG),
      }),
      base
    )
  }, [visibleFoods, resolveQty, customLogs])

  const handleConfirmCustomEdit = async (log: DayLog) => {
    const qty = parseFloat(customEditQty)
    if (qty > 0) await onUpdateCustomQty(log.id, qty)
    setEditingCustomId(null)
  }

  return (
    <div
      className="cx-card"
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: circleError ? '1px solid #ef4444' : '1px solid var(--color-border)',
        borderRadius: 'var(--cx-r-lg)',
        padding: '14px 16px',
        transition: 'border-color 0.2s',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>
            {tx(
              {
                Breakfast: t.nutrition.breakfast,
                Lunch: t.nutrition.lunch,
                Dinner: t.nutrition.dinner,
                Snack: t.nutrition.snacks,
                Snacks: t.nutrition.snacks,
                'Pre-workout': t.nutrition.preWorkout,
                'Post-workout': t.nutrition.postWorkout,
              },
              meal.name
            )}
          </span>
          <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
            <Pill value={Math.round(totals.calories)} color="var(--color-text-primary)" bg="var(--color-surface-3)" />
            <Pill value={Math.round(totals.proteinG)} color={COLOR_PROTEIN} bg="rgba(59,130,246,0.12)" />
            <Pill value={Math.round(totals.carbsG)} color={COLOR_CARBS} bg="rgba(249,115,22,0.12)" />
            <Pill value={Math.round(totals.fatG)} color={COLOR_FAT} bg="rgba(239,68,68,0.12)" />
          </div>
        </div>
        {canUndo && (
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoing || restoring}
            title={t.nutrition.undoRemoval}
            aria-label={t.nutrition.undoRemoval}
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: '2px solid var(--color-text-hint)',
              color: 'var(--color-text-hint)',
              cursor: undoing || restoring ? 'default' : 'pointer',
              opacity: undoing || restoring ? 0.5 : 1,
              touchAction: 'manipulation',
              flexShrink: 0,
              padding: 0,
            }}
          >
            {undoing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Undo2 size={14} strokeWidth={2.5} />
            )}
          </button>
        )}
        {removedCount > 0 && (
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring || undoing}
            title={t.nutrition.restorePlanFoods}
            aria-label={t.nutrition.restorePlanFoods}
            className="flex items-center justify-center"
            style={{
              position: 'relative',
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: '2px solid var(--color-accent)',
              color: 'var(--color-accent)',
              cursor: restoring ? 'default' : 'pointer',
              opacity: restoring ? 0.5 : 1,
              touchAction: 'manipulation',
              flexShrink: 0,
              padding: 0,
            }}
          >
            {restoring || undoing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCcw size={13} strokeWidth={2.5} />
            )}
            {!restoring && !undoing && (
              <span
                style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  minWidth: 14,
                  height: 14,
                  borderRadius: 999,
                  backgroundColor: 'var(--color-accent)',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  lineHeight: '14px',
                  textAlign: 'center',
                  padding: '0 3px',
                }}
              >
                {removedCount}
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={handleCircleTap}
          disabled={!canLog}
          title={effectiveLogged ? t.nutrition.markNotEaten : t.nutrition.markEaten}
          aria-label={effectiveLogged ? t.nutrition.markNotEaten : t.nutrition.markEaten}
          aria-pressed={effectiveLogged}
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: effectiveLogged ? '#22c55e' : 'transparent',
            border: effectiveLogged ? 'none' : '2px solid var(--color-text-hint)',
            color: '#fff',
            cursor: canLog ? 'pointer' : 'default',
            opacity: !canLog ? 0.3 : 1,
            touchAction: 'manipulation',
            flexShrink: 0,
            padding: 0,
          }}
        >
          {circleLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : effectiveLogged ? (
            <Check size={16} strokeWidth={3} />
          ) : null}
        </button>
      </div>

      {meal.options.length > 1 && (
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          {meal.options.map((o) => {
            const active = activeOption?.id === o.id
            const wasLogged = optionIsLogged(o)
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onSelectOption(o.id)}
                aria-pressed={active}
                className="px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: active ? 'var(--color-accent)' : 'var(--color-surface-2)',
                  color: active ? '#fff' : 'var(--color-text-muted)',
                  border: 'none',
                  borderRadius: 999,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {t.nutrition.option} {o.label}
                {wasLogged && <Check size={10} strokeWidth={3} color={active ? '#fff' : '#22c55e'} />}
              </button>
            )
          })}
        </div>
      )}

      {/* Every pre-filled food in this option was removed — say so, rather than
          leaving a blank card that looks broken. */}
      {activeOption && visibleFoods.length === 0 && removedCount > 0 && (
        <div
          className="flex items-center gap-2 mb-2"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px dashed var(--color-border)',
            borderRadius: 10,
            padding: '9px 11px',
          }}
        >
          <RefreshCcw size={13} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.35 }}>
            {t.nutrition.restorePlanFoods}
          </span>
        </div>
      )}

      {visibleFoods.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          {visibleFoods.map((f) => {
            const matchingLog = planLogs.find((l) => l.templateFoodId === f.id)
            return (
              <FoodRow
                key={f.id}
                name={tx(t.foods as Record<string, string>, f.foodName)}
                quantity={f.quantity}
                unit={f.unit}
                calories={f.calories}
                p={f.proteinG}
                c={f.carbsG}
                fat={f.fatG}
                displayQuantity={resolveQty(f)}
                onPortionOverride={(qty) => onPortionOverride(f.id, qty)}
                onDelete={() => onDeleteFood(f.id, matchingLog?.id)}
              />
            )
          })}
        </div>
      )}

      {customLogs.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-text-hint)',
              margin: 0,
            }}
          >
            {t.nutrition.yourFoods}
          </p>
          {customLogs.map((l) => (
            <CustomFoodRow
              key={l.id}
              log={l}
              editing={editingCustomId === l.id}
              editQty={customEditQty}
              onEditQtyChange={setCustomEditQty}
              onStartEdit={() => {
                setEditingCustomId(l.id)
                setCustomEditQty(String(l.quantity))
              }}
              onCancelEdit={() => setEditingCustomId(null)}
              onConfirmEdit={() => handleConfirmCustomEdit(l)}
              onDelete={() => onDeleteCustom(l.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={onToggleAddFood}
          style={{
            width: '100%',
            color: addFoodOpen ? 'var(--color-text-muted)' : 'var(--color-accent)',
            backgroundColor: 'transparent',
            border: '1px solid ' + (addFoodOpen ? 'var(--color-border)' : 'rgba(249,115,22,0.3)'),
            borderRadius: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '11px 0',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <Plus size={15} />
          {addFoodOpen ? cancelLabel : addFoodLabel}
        </button>
        {addFoodOpen && (
          <AddCustomFood
            mealName={meal.name}
            onAdd={onAddCustomFood}
            clientId={clientId}
            workspaceId={workspaceId}
            logDate={logDate}
            onLogged={onLogged}
            dailyGoal={dailyGoal}
          />
        )}
      </div>
    </div>
  )
}

/**
 * One food the client logged themselves — searched, scanned or typed in. Shared
 * by plan meals and custom meals so both behave identically.
 */
function CustomFoodRow({
  log,
  editing,
  editQty,
  onEditQtyChange,
  onStartEdit,
  onCancelEdit,
  onConfirmEdit,
  onDelete,
}: {
  log: DayLog
  editing: boolean
  editQty: string
  onEditQtyChange: (v: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onConfirmEdit: () => void
  onDelete: () => void
}) {
  const { t } = useLanguage()
  const name = tx(t.foods as Record<string, string>, log.foodName)

  if (editing) {
    const qty = parseFloat(editQty) || 0
    const ratio = portionRatio(log.quantity, qty) * (log.quantity > 0 ? 1 : 0)
    const valid = qty > 0
    return (
      <div style={{ backgroundColor: 'var(--color-surface-2)', borderRadius: 10, padding: '6px 10px' }}>
        <p
          className="truncate"
          style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500, margin: '0 0 4px' }}
        >
          {name}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="text"
            inputMode="decimal"
            value={editQty}
            onChange={(e) => onEditQtyChange(normalizeDecimalInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) onConfirmEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
            autoFocus
            aria-label={t.nutrition.quantity}
            style={{
              width: 60,
              padding: '3px 6px',
              fontSize: 12,
              backgroundColor: 'var(--color-surface-3)',
              border: '1px solid ' + (valid ? 'var(--color-accent)' : 'rgba(239,68,68,0.6)'),
              borderRadius: 6,
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{log.unit}</span>
          <button
            type="button"
            onClick={onConfirmEdit}
            disabled={!valid}
            aria-label={t.common.confirm}
            style={{
              width: 22,
              height: 22,
              background: 'transparent',
              border: 'none',
              cursor: valid ? 'pointer' : 'default',
              opacity: valid ? 1 : 0.35,
              color: '#22c55e',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={13} strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            aria-label={t.common.cancel}
            style={{
              width: 22,
              height: 22,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-hint)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={13} />
          </button>
          <Pill value={Math.round(log.calories * ratio)} color="var(--color-text-primary)" bg="var(--color-surface-3)" />
          <Pill value={Math.round(log.proteinG * ratio)} color={COLOR_PROTEIN} bg="rgba(59,130,246,0.12)" />
          <Pill value={Math.round(log.carbsG * ratio)} color={COLOR_CARBS} bg="rgba(249,115,22,0.12)" />
          <Pill value={Math.round(log.fatG * ratio)} color={COLOR_FAT} bg="rgba(239,68,68,0.12)" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center"
      style={{ backgroundColor: 'var(--color-surface-2)', borderRadius: 10, padding: '10px 12px' }}
    >
      <FoodInner
        name={name}
        quantity={log.quantity}
        unit={log.unit}
        calories={log.calories}
        p={log.proteinG}
        c={log.carbsG}
        fat={log.fatG}
      />
      <button
        type="button"
        onClick={onStartEdit}
        title={t.common.edit}
        aria-label={t.common.edit}
        style={{
          width: 22,
          height: 22,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-hint)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        title={t.common.delete}
        aria-label={t.common.delete}
        className="ml-1 inline-flex items-center justify-center"
        style={{ width: 22, height: 22, color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

function FoodRow({
  name,
  quantity,
  unit,
  calories,
  p,
  c,
  fat,
  displayQuantity,
  onPortionOverride,
  onDelete,
}: {
  name: string
  quantity: number
  unit: string
  calories: number
  p: number
  c: number
  fat: number
  /** What the client is actually eating: their own resize, or what's logged. */
  displayQuantity: number
  onPortionOverride: (qty: number) => void
  onDelete?: () => void
}) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [editQty, setEditQty] = useState('')

  const displayQty = displayQuantity
  const displayRatio = portionRatio(quantity, displayQty)

  const parsedEditQty = parseFloat(editQty) || 0
  const editValid = parsedEditQty > 0
  const editRatio = quantity > 0 ? parsedEditQty / quantity : 0

  const handleConfirm = () => {
    if (!editValid) return
    onPortionOverride(parsedEditQty)
    setEditing(false)
  }

  const handleEdit = () => {
    setEditQty(String(displayQty))
    setEditing(true)
  }

  if (editing) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-surface-2)',
          borderRadius: 10,
          padding: '6px 10px',
        }}
      >
        <p
          className="truncate"
          style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500, margin: '0 0 4px' }}
        >
          {name}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="text"
            inputMode="decimal"
            value={editQty}
            onChange={(e) => setEditQty(normalizeDecimalInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm()
              if (e.key === 'Escape') setEditing(false)
            }}
            autoFocus
            aria-label={t.nutrition.quantity}
            style={{
              width: 60,
              padding: '3px 6px',
              fontSize: 12,
              backgroundColor: 'var(--color-surface-3)',
              border: '1px solid ' + (editValid ? 'var(--color-accent)' : 'rgba(239,68,68,0.6)'),
              borderRadius: 6,
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{unit}</span>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!editValid}
            aria-label={t.common.confirm}
            style={{
              width: 22,
              height: 22,
              background: 'transparent',
              border: 'none',
              cursor: editValid ? 'pointer' : 'default',
              opacity: editValid ? 1 : 0.35,
              color: '#22c55e',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={13} strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label={t.common.cancel}
            style={{
              width: 22,
              height: 22,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-hint)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={13} />
          </button>
          <Pill value={Math.round(calories * editRatio)} color="var(--color-text-primary)" bg="var(--color-surface-3)" />
          <Pill value={Math.round(p * editRatio)} color={COLOR_PROTEIN} bg="rgba(59,130,246,0.12)" />
          <Pill value={Math.round(c * editRatio)} color={COLOR_CARBS} bg="rgba(249,115,22,0.12)" />
          <Pill value={Math.round(fat * editRatio)} color={COLOR_FAT} bg="rgba(239,68,68,0.12)" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: 10,
        padding: '6px 10px',
      }}
    >
      <FoodInner
        name={name}
        quantity={displayQty}
        unit={unit}
        calories={round1(calories * displayRatio)}
        p={round1(p * displayRatio)}
        c={round1(c * displayRatio)}
        fat={round1(fat * displayRatio)}
      />
      <button
        type="button"
        onClick={handleEdit}
        title={t.common.edit}
        aria-label={t.common.edit}
        style={{
          width: 22,
          height: 22,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-hint)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Pencil size={12} />
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title={t.nutrition.removeFood}
          aria-label={t.nutrition.removeFood}
          className="ml-1 inline-flex items-center justify-center"
          style={{
            width: 22,
            height: 22,
            color: '#ef4444',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

function FoodInner({
  name,
  quantity,
  unit,
  calories,
  p,
  c,
  fat,
}: {
  name: string
  quantity: number
  unit: string
  calories: number
  p: number
  c: number
  fat: number
}) {
  return (
    <>
      <div className="flex-1 min-w-0">
        <p
          className="truncate"
          style={{ fontSize: 15, color: 'var(--color-text-primary)', fontWeight: 600, margin: 0 }}
        >
          {name}
        </p>
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', margin: '2px 0 0' }}>
          {Math.round(quantity)}{unit}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Pill value={Math.round(calories)} color="var(--color-text-primary)" bg="var(--color-surface-3)" />
        <Pill value={Math.round(p)} color={COLOR_PROTEIN} bg="rgba(59,130,246,0.12)" />
        <Pill value={Math.round(c)} color={COLOR_CARBS} bg="rgba(249,115,22,0.12)" />
        <Pill value={Math.round(fat)} color={COLOR_FAT} bg="rgba(239,68,68,0.12)" />
      </div>
    </>
  )
}

function Pill({ value, color, bg }: { value: number; color: string; bg: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        color,
        backgroundColor: bg,
        padding: '3px 7px',
        borderRadius: 6,
        minWidth: 26,
        textAlign: 'center',
      }}
    >
      {value}
    </span>
  )
}

function InsightBadge({ tier, label }: { tier: InsightTier; label: string }) {
  const colors = {
    green:  { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)',  text: '#16a34a' },
    orange: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)',  text: '#ea580c' },
    red:    { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  text: '#dc2626' },
  }
  const c = colors[tier]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11,
        fontWeight: 600,
        color: c.text,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 999,
        padding: '3px 9px',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function AddCustomFood({
  mealName,
  onAdd,
  clientId,
  workspaceId,
  logDate,
  onLogged,
  dailyGoal,
}: {
  mealName: string
  onAdd: (p: {
    foodName: string
    quantity: number
    unit: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }) => Promise<void> | void
  clientId?: string | null
  workspaceId?: string | null
  logDate?: string
  onLogged?: () => void
  dailyGoal?: { calories: number; fatG: number; proteinG: number } | null
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  /** The last query that actually reached the server, so "no results" is only
   *  shown once a search for what's typed has finished. */
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null)
  const [selected, setSelected] = useState<FoodSearchResult | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [manualOpen, setManualOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [showFoodScanner, setShowFoodScanner] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  // Only the newest search may write results; a slow earlier request that lands
  // afterwards would otherwise overwrite them with stale matches.
  const searchSeqRef = useRef(0)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    const seq = ++searchSeqRef.current
    debounceRef.current = setTimeout(async () => {
      if (trimmed.length < 2) {
        if (seq === searchSeqRef.current) {
          setResults([])
          setSearching(false)
          setSearchedQuery(null)
        }
        return
      }
      setSearching(true)
      try {
        const r = await searchFoodsForClient(trimmed)
        if (seq !== searchSeqRef.current) return
        setResults(r)
      } catch {
        if (seq === searchSeqRef.current) setResults([])
      } finally {
        if (seq === searchSeqRef.current) {
          setSearching(false)
          setSearchedQuery(trimmed)
        }
      }
    }, trimmed.length < 2 ? 0 : 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const trimmedQuery = query.trim()
  // Typing counts as "in progress" until the search for exactly this text lands,
  // so the spinner appears immediately rather than after the debounce.
  const searchPending = trimmedQuery.length >= 2 && (searching || searchedQuery !== trimmedQuery)

  const parsedQty = parseFloat(quantity) || 0
  const qtyValid = parsedQty > 0

  const handleAddFromResult = async () => {
    if (!selected || !qtyValid || submitting) return
    setSubmitting(true)
    try {
      await onAdd({
        foodName: selected.brand ? `${selected.name} (${selected.brand})` : selected.name,
        quantity: parsedQty,
        unit: 'g',
        calories: round1((selected.caloriesPer100g * parsedQty) / 100),
        proteinG: round1((selected.proteinPer100g * parsedQty) / 100),
        carbsG: round1((selected.carbsPer100g * parsedQty) / 100),
        fatG: round1((selected.fatPer100g * parsedQty) / 100),
      })
    } finally {
      setSubmitting(false)
    }
    setQuery('')
    setResults([])
    setSelected(null)
    setQuantity('100')
  }

  const selectedInsights: NutritionInsight[] = selected
    ? getNutritionInsights(selected, parsedQty, dailyGoal ?? null, t.nutrition.insights)
    : []

  return (
    <div
      className="mt-2"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 8,
      }}
    >
      {!selected && !manualOpen && (
        <>
          <div
            className="flex items-center gap-1.5 px-2 py-1.5"
            style={{
              backgroundColor: 'var(--color-surface-3)',
              borderRadius: 8,
            }}
          >
            <Search size={13} style={{ color: 'var(--color-text-hint)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.nutrition.searchFoods + '…'}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text-primary)',
                fontSize: 13,
              }}
            />
            {searchPending && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--color-text-hint)' }} />}
            {clientId && workspaceId && logDate && (
              <>
                <button
                  type="button"
                  onClick={() => setShowBarcodeScanner(true)}
                  title={t.nutrition.scanBarcode}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-hint)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    marginLeft: 2,
                    flexShrink: 0,
                  }}
                >
                  <Scan size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowFoodScanner(true)}
                  title={t.nutrition.scanMeal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-accent)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    marginLeft: 2,
                    flexShrink: 0,
                  }}
                >
                  <Camera size={14} />
                </button>
              </>
            )}
          </div>

          {!searchPending && results.length === 0 && searchedQuery === trimmedQuery && trimmedQuery.length >= 2 && (
            <p
              style={{
                fontSize: 12,
                color: 'var(--color-text-hint)',
                margin: '8px 2px 0',
              }}
            >
              {t.nutrition.noFoodsFound}
            </p>
          )}

          {results.length > 0 && (
            <div className="flex flex-col mt-2">
              {results.map((r, i) => (
                <button
                  key={(r.externalId ?? '') + i}
                  type="button"
                  onClick={() => setSelected(r)}
                  className="text-left px-2 py-1.5"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {r.name}
                    </span>
                    {r.brand && (
                      <span style={{ fontSize: 10, color: 'var(--color-text-hint)' }}>{r.brand}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '1px 0 0' }}>
                    {Math.round(r.caloriesPer100g)} kcal · P {Math.round(r.proteinPer100g)}g · C{' '}
                    {Math.round(r.carbsPer100g)}g · F {Math.round(r.fatPer100g)}g per 100g
                  </p>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="mt-2 text-xs"
            style={{
              color: 'var(--color-text-muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {t.nutrition.addCustom}
          </button>
        </>
      )}

      {selected && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600, margin: '0 0 6px' }}>
            {selected.name}
            {selected.brand && (
              <span style={{ fontSize: 11, color: 'var(--color-text-hint)', fontWeight: 400, marginLeft: 5 }}>
                {selected.brand}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(normalizeDecimalInput(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFromResult()
                if (e.key === 'Escape') setSelected(null)
              }}
              autoFocus
              aria-label={t.nutrition.quantity}
              style={{
                width: 70,
                padding: '6px 8px',
                fontSize: 13,
                backgroundColor: 'var(--color-surface-3)',
                border: '1px solid ' + (qtyValid ? 'var(--color-border)' : 'rgba(239,68,68,0.6)'),
                borderRadius: 8,
                color: 'var(--color-text-primary)',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>g</span>
            <button
              type="button"
              onClick={handleAddFromResult}
              disabled={!qtyValid || submitting}
              className="px-3 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: !qtyValid || submitting ? 'default' : 'pointer',
                opacity: !qtyValid || submitting ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              {submitting ? t.nutrition.adding : t.nutrition.addToMeal}
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              disabled={submitting}
              className="text-xs"
              style={{
                color: 'var(--color-text-hint)',
                background: 'transparent',
                border: 'none',
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.5 : 1,
              }}
            >
              {t.common.cancel}
            </button>
          </div>
          {selectedInsights.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 5,
                marginTop: 2,
              }}
            >
              {selectedInsights.map((ins, i) => (
                <InsightBadge key={i} tier={ins.tier} label={ins.label} />
              ))}
            </div>
          )}
        </div>
      )}

      {manualOpen && (
        <ManualEntryForm onAdd={onAdd} onCancel={() => setManualOpen(false)} />
      )}

      {showBarcodeScanner && clientId && workspaceId && logDate && (
        <BarcodeScannerModal
          clientId={clientId}
          workspaceId={workspaceId}
          mealName={mealName}
          logDate={logDate}
          onClose={() => setShowBarcodeScanner(false)}
          onLogged={() => {
            setShowBarcodeScanner(false)
            onLogged?.()
          }}
        />
      )}

      {showFoodScanner && clientId && workspaceId && logDate && (
        <FoodScannerModal
          clientId={clientId}
          workspaceId={workspaceId}
          mealName={mealName}
          logDate={logDate}
          onClose={() => setShowFoodScanner(false)}
          onLogged={() => {
            setShowFoodScanner(false)
            onLogged?.()
          }}
        />
      )}
    </div>
  )
}

function ManualEntryForm({
  onAdd,
  onCancel,
}: {
  onAdd: (p: {
    foodName: string
    quantity: number
    unit: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }) => Promise<void> | void
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [cal, setCal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  const [q, setQ] = useState('100')
  const [submitting, setSubmitting] = useState(false)

  const parsedQ = parseFloat(q) || 0
  // A zero quantity makes the entry impossible to resize later (every macro
  // would scale from nothing), so require a real amount up front.
  const canSubmit = name.trim().length > 0 && parsedQ > 0 && !submitting

  const handle = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onAdd({
        foodName: name.trim(),
        quantity: parsedQ,
        unit: 'g',
        calories: parseFloat(cal) || 0,
        proteinG: parseFloat(p) || 0,
        carbsG: parseFloat(c) || 0,
        fatG: parseFloat(f) || 0,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface-3)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    padding: '6px 8px',
    fontSize: 13,
    width: '100%',
  }

  return (
    <div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.nutrition.foodName}
        style={{ ...inputStyle, marginBottom: 6 }}
      />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input type="text" inputMode="decimal" value={cal} onChange={(e) => setCal(normalizeDecimalInput(e.target.value))} placeholder={t.nutrition.calories} style={inputStyle} />
        <input type="text" inputMode="decimal" value={q} onChange={(e) => setQ(normalizeDecimalInput(e.target.value))} placeholder={`${t.nutrition.quantity} (${t.nutrition.grams})`} style={inputStyle} />
        <input type="text" inputMode="decimal" value={p} onChange={(e) => setP(normalizeDecimalInput(e.target.value))} placeholder={`${t.nutrition.protein} (${t.nutrition.grams})`} style={inputStyle} />
        <input type="text" inputMode="decimal" value={c} onChange={(e) => setC(normalizeDecimalInput(e.target.value))} placeholder={`${t.nutrition.carbs} (${t.nutrition.grams})`} style={inputStyle} />
        <input type="text" inputMode="decimal" value={f} onChange={(e) => setF(normalizeDecimalInput(e.target.value))} placeholder={`${t.nutrition.fat} (${t.nutrition.grams})`} style={inputStyle} />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handle}
          disabled={!canSubmit}
          className="px-3 py-1.5 text-xs font-semibold"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: canSubmit ? 'pointer' : 'default',
            opacity: canSubmit ? 1 : 0.5,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {submitting && <Loader2 size={12} className="animate-spin" />}
          {submitting ? t.nutrition.adding : t.nutrition.addToMeal}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="text-xs"
          style={{
            color: 'var(--color-text-hint)',
            background: 'transparent',
            border: 'none',
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.5 : 1,
          }}
        >
          {t.common.cancel}
        </button>
      </div>
    </div>
  )
}
function NotesCard({ plan }: { plan: FullMealPlan | null }) {
  const { t } = useLanguage()
  if (!plan) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px dashed var(--color-border-strong)',
          borderRadius: 'var(--cx-r-lg)',
          padding: '24px 16px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
          {t.nutrition.emptyMeal}
        </p>
      </div>
    )
  }

  const updated = new Date(plan.updatedAt)
  const updatedStr = updated.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      className="cx-card"
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--cx-r-lg)',
        padding: '16px',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: 'var(--color-accent-dim)',
            color: 'var(--color-accent)',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          MC
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {t.home.coach}
        </span>
      </div>

      <div className="mb-4">
        <p
          style={{
            fontSize: 10,
            color: 'var(--color-text-hint)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            margin: '0 0 4px',
            textTransform: 'uppercase',
          }}
        >
          {t.workouts.notes}
        </p>
        {plan.notes ? (
          <p style={{ fontSize: 14, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {plan.notes}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-text-hint)', fontStyle: 'italic', margin: 0 }}>
            {t.nutrition.emptyMeal}
          </p>
        )}
      </div>

      <div
        className="pt-3 mb-2"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <p
          style={{
            fontSize: 10,
            color: 'var(--color-text-hint)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            margin: '0 0 4px',
            textTransform: 'uppercase',
          }}
        >
          {t.nutrition.recommendations}
        </p>
        {plan.recommendations ? (
          <p style={{ fontSize: 14, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {plan.recommendations}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-text-hint)', fontStyle: 'italic', margin: 0 }}>
            {t.nutrition.emptyMeal}
          </p>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: 0 }}>
        {t.nutrition.lastUpdated} {updatedStr}
      </p>
    </div>
  )
}
