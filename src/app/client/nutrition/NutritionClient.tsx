'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Search, Loader2, Check, X, Plus, Pencil, Scan, Camera } from 'lucide-react'
import {
  getDayLogs,
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
} from './actions'
import type { FoodSearchResult } from '@/lib/food-search'
import BarcodeScannerModal from './BarcodeScannerModal'
import FoodScannerModal from './FoodScannerModal'
import { useLanguage, tx } from '@/lib/i18n'
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

// ── Nutritional insight badges ────────────────────────────────────────────────

type InsightTier = 'green' | 'orange' | 'red'

type NutritionInsight = {
  tier: InsightTier
  label: string
}

function getNutritionInsights(
  food: FoodSearchResult,
  quantity: number,
  dailyGoal: { calories: number; fatG: number; proteinG: number } | null
): NutritionInsight[] {
  if (quantity <= 0) return []
  const cal  = (food.caloriesPer100g * quantity) / 100
  const prot = (food.proteinPer100g  * quantity) / 100
  const fat  = (food.fatPer100g      * quantity) / 100

  const insights: NutritionInsight[] = []

  // Green — protein
  if (prot >= 15) {
    insights.push({ tier: 'green', label: `High in protein (${Math.round(prot)}g)` })
  } else if (prot >= 8) {
    insights.push({ tier: 'green', label: `Good protein source (${Math.round(prot)}g)` })
  }

  // Calories vs goal
  if (dailyGoal && dailyGoal.calories > 0) {
    const pct = cal / dailyGoal.calories
    if (pct >= 0.5) {
      insights.push({ tier: 'red', label: `Very high calorie — ${Math.round(pct * 100)}% of daily goal` })
    } else if (pct >= 0.25) {
      insights.push({ tier: 'orange', label: `Covers ${Math.round(pct * 100)}% of your daily calories` })
    }
  } else {
    if (cal >= 600)      insights.push({ tier: 'red',    label: `Very high calorie (${Math.round(cal)} kcal)` })
    else if (cal >= 350) insights.push({ tier: 'orange', label: `High calorie (${Math.round(cal)} kcal)` })
  }

  // Fat vs goal
  if (dailyGoal && dailyGoal.fatG > 0) {
    const pct = fat / dailyGoal.fatG
    if (pct >= 0.5) {
      insights.push({ tier: 'red',    label: `Very high in fat — ${Math.round(pct * 100)}% of daily fat goal` })
    } else if (pct >= 0.25) {
      insights.push({ tier: 'orange', label: `High in fat — ${Math.round(pct * 100)}% of daily fat goal` })
    }
  } else {
    if (fat >= 25)      insights.push({ tier: 'red',    label: `Very high in fat (${Math.round(fat)}g)` })
    else if (fat >= 15) insights.push({ tier: 'orange', label: `High in fat (${Math.round(fat)}g)` })
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
  const [planTypeUserSet, setPlanTypeUserSet] = useState(false)
  const [mealPlanTraining] = useState(initialMealPlanTraining)
  const [mealPlanRest] = useState(initialMealPlanRest)
  const mealPlan = planType === 'training' ? mealPlanTraining : mealPlanRest
  // Hide the toggle when both slots resolve to the same plan (overall-only clients).
  // Switching would show identical content, so the toggle is meaningless.
  const showPlanTypeToggle = initialMealPlanTraining?.id !== initialMealPlanRest?.id
  const [dayLogs, setDayLogs] = useState<DayLog[]>(initialDayLogs)
  const [loading, setLoading] = useState(false)
  const [activeAddFoodMeal, setActiveAddFoodMeal] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'diary' | 'notes'>('diary')
  const [portionOverrides, setPortionOverrides] = useState<Record<string, number>>({})
  const [deletedFoodIds, setDeletedFoodIds] = useState<Record<string, boolean>>({})
  const [deletionHistory, setDeletionHistory] = useState<string[]>([])

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
    setLoading(false)
  }, [clientId, selectedDate])

  const isInitialMount = useRef(true)
  useEffect(() => {
    if (!clientId) return
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setLoading(true)
    setCustomMealNames([])
    setPortionOverrides({})
    // Load persisted food exclusions for this client+date from localStorage
    try {
      const stored = localStorage.getItem(`excl_${clientId}_${selectedDate}`)
      const ids: string[] = stored ? JSON.parse(stored) : []
      setDeletedFoodIds(Object.fromEntries(ids.map(id => [id, true as const])))
      setDeletionHistory(ids)
    } catch {
      setDeletedFoodIds({})
      setDeletionHistory([])
    }
    reloadDayLogs()
  }, [clientId, selectedDate, reloadDayLogs])

  // Persist food exclusions to localStorage whenever they change
  useEffect(() => {
    if (!clientId) return
    const ids = Object.keys(deletedFoodIds).filter(id => deletedFoodIds[id])
    const key = `excl_${clientId}_${selectedDate}`
    if (ids.length > 0) {
      localStorage.setItem(key, JSON.stringify(ids))
    } else {
      localStorage.removeItem(key)
    }
  }, [deletedFoodIds, clientId, selectedDate])

  useEffect(() => {
    const overrides: Record<string, number> = {}
    for (const log of dayLogs) {
      if (log.templateFoodId) {
        overrides[log.templateFoodId] = log.quantity
      }
    }
    setPortionOverrides(overrides)
  }, [dayLogs])

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
    setPlanTypeUserSet(true)
    setPlanType(t)
  }

  const handleLogMeal = async (meal: Meal, option: Option) => {
    if (!clientId || !workspaceId) return
    const activeFoods = option.foods.filter((f) => !deletedFoodIds[f.id])
    await logMealOption({
      clientId,
      workspaceId,
      loggedDate: selectedDate,
      mealType: meal.name,
      mealOptionId: option.id,
      foods: activeFoods.map((f) => {
        const qty = portionOverrides[f.id] ?? f.quantity
        const ratio = qty / f.quantity
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
    await reloadDayLogs()
  }

  const handleRemoveMeal = async (mealName: string) => {
    if (!clientId) return
    await removeOptionLog(clientId, selectedDate, mealName)
    await reloadDayLogs()
  }

  const handleDeleteFood = async (foodId: string, loggedFoodId?: string | null) => {
    setDeletedFoodIds(prev => ({ ...prev, [foodId]: true }))
    setDeletionHistory(prev => [...prev, foodId])
    if (loggedFoodId) {
      await deleteNutritionLog(loggedFoodId)
      await reloadDayLogs()
    }
  }

  const handleUndoDelete = (mealFoodIds: Set<string>) => {
    // Walk history newest-first and restore the last deleted food from this meal
    for (let i = deletionHistory.length - 1; i >= 0; i--) {
      const foodId = deletionHistory[i]
      if (mealFoodIds.has(foodId) && deletedFoodIds[foodId]) {
        const newDeleted = { ...deletedFoodIds }
        delete newDeleted[foodId]
        setDeletedFoodIds(newDeleted)
        setDeletionHistory(prev => [...prev.slice(0, i), ...prev.slice(i + 1)])
        return
      }
    }
  }

  const handleDeleteCustom = async (logId: string) => {
    await deleteNutritionLog(logId)
    await reloadDayLogs()
  }

  const handleUpdateCustomQty = async (logId: string, newQty: number) => {
    // Macros are recomputed server-side from the stored row, so only the new
    // quantity needs to be sent.
    await updateNutritionLogQuantity(logId, newQty)
    await reloadDayLogs()
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
    await logCustomFood({
      clientId,
      workspaceId,
      loggedDate: selectedDate,
      mealType: mealName,
      ...payload,
    })
    await reloadDayLogs()
    setActiveAddFoodMeal(null)
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

  const handleRenameCustomMeal = async (oldName: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    const hasLogs = (logsByMealType.get(oldName) ?? []).length > 0
    if (hasLogs && clientId) {
      await renameCustomMealLogs(clientId, selectedDate, oldName, trimmed)
      await reloadDayLogs()
    }
    setCustomMealNames((prev) => prev.map((n) => (n === oldName ? trimmed : n)))
  }

  const handleRemoveCustomMeal = async (mealName: string) => {
    if (clientId) {
      // A custom meal is entirely client-added, so clear all of its logs.
      await removeOptionLog(clientId, selectedDate, mealName, false)
      await reloadDayLogs()
    }
    setCustomMealNames((prev) => prev.filter((n) => n !== mealName))
  }

  void planTypeUserSet

  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      <div style={{ padding: '52px 20px 10px' }}>
        <div className="flex items-start justify-between">
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-hint)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
            </p>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '1px 0 0', lineHeight: 1.1 }}>
              {t.nutrition.title}
            </h1>
          </div>
          {showPlanTypeToggle && (
            <PlanTypeToggle value={planType} onChange={handleSetPlanType} />
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <WeekStrip selectedDate={selectedDate} onSelect={setSelectedDate} todayISO={initialDate} />
      </div>

      <div style={{ padding: '0 16px 10px' }}>
        <CaloriesCard current={totals.calories} goal={goal?.calories ?? null} />
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <MacrosCard totals={totals} goal={goal} />
      </div>

      <div style={{ padding: '0 16px 12px' }}>
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
              const isLogged = planLogs.length > 0
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
                  isLogged={isLogged}
                  loggedOptionId={loggedOptionId}
                  customLogs={customLogs}
                  planLogs={planLogs}
                  portionOverrides={portionOverrides}
                  deletedFoodIds={deletedFoodIds}
                  onSelectOption={(optId) =>
                    setSelectedOption((prev) => ({ ...prev, [optKey]: optId }))
                  }
                  onLogMeal={async () => { if (activeOption) await handleLogMeal(meal, activeOption) }}
                  onRemoveMeal={async () => handleRemoveMeal(meal.name)}
                  onDeleteCustom={handleDeleteCustom}
                  onUpdateCustomQty={handleUpdateCustomQty}
                  onPortionOverride={(foodId, qty) =>
                    setPortionOverrides((prev) => ({ ...prev, [foodId]: qty }))
                  }
                  onDeleteFood={handleDeleteFood}
                  onUndoDelete={handleUndoDelete}
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
              style={{
                width: '100%',
                color: 'var(--color-text-muted)',
                backgroundColor: 'transparent',
                border: '1px dashed var(--color-border)',
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
  return (
    <div
      className="flex p-0.5"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 999,
        display: 'inline-flex',
      }}
    >
      {(['training', 'rest'] as const).map((planKey) => {
        const active = value === planKey
        const accent = planKey === 'training' ? '#3b82f6' : '#22c55e'
        return (
          <button
            key={planKey}
            type="button"
            onClick={() => onChange(planKey)}
            className="px-2.5 py-1 text-xs font-semibold"
            style={{
              backgroundColor: active ? accent : 'transparent',
              color: active ? '#fff' : 'var(--color-text-muted)',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
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
            className="flex flex-col items-center justify-center"
            style={{
              flex: 1,
              padding: '10px 4px',
              backgroundColor: active ? 'var(--color-accent)' : 'var(--color-surface-1)',
              border: '1px solid ' + (active ? 'var(--color-accent)' : 'var(--color-border)'),
              borderRadius: 14,
              cursor: 'pointer',
              gap: 5,
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.8)' : 'var(--color-text-hint)', fontWeight: 700, letterSpacing: '0.04em' }}>
              {d.label}
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
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
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: '16px 18px 18px',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-hint)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t.nutrition.calories}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
              {Math.round(current)}
            </span>
            {goal !== null && (
              <span style={{ fontSize: 14, color: 'var(--color-text-hint)' }}>
                / {Math.round(goal)}
              </span>
            )}
          </div>
        </div>
        {remaining !== null && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-hint)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t.nutrition.remaining}
            </p>
            <span style={{ fontSize: 25, fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1 }}>
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
            style={{
              height: '100%',
              width: `${pct * 100}%`,
              backgroundColor: 'var(--color-accent)',
              transition: 'width 0.2s ease',
            }}
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
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: '14px 16px',
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
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 4 }}>
        {label}
      </span>
      <div className="flex items-baseline gap-1 mb-1.5">
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {Math.round(current)}g
        </span>
        {goal !== null && (
          <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>/ {Math.round(goal)}g</span>
        )}
      </div>
      <div
        style={{
          height: 4,
          backgroundColor: 'var(--color-surface-3)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct * 100}%`,
            backgroundColor: color,
            transition: 'width 0.2s ease',
          }}
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
    <div className="flex items-center gap-2">
      {(['diary', 'notes'] as const).map((tab2) => {
        const active = tab === tab2
        return (
          <button
            key={tab2}
            type="button"
            onClick={() => onChange(tab2)}
            className="px-3 py-1.5 text-sm font-semibold"
            style={{
              backgroundColor: active ? 'var(--color-surface-3)' : 'transparent',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
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
        border: '1px dashed var(--color-border)',
        borderRadius: 16,
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
  }) => void
  onDeleteCustom: (logId: string) => void
  onUpdateCustomQty: (
    logId: string,
    newQty: number,
    origQty: number,
    origCal: number,
    origP: number,
    origC: number,
    origF: number
  ) => Promise<void>
  onRename: (newName: string) => void
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

  const handleConfirmRename = () => {
    setEditingName(false)
    onRename(nameInput)
  }

  const handleConfirmCustomEdit = async (log: DayLog) => {
    const qty = parseFloat(customEditQty)
    if (qty > 0) {
      await onUpdateCustomQty(log.id, qty, log.quantity, log.calories, log.proteinG, log.carbsG, log.fatG)
    }
    setEditingCustomId(null)
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
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
                title="Rename"
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
            onClick={onRemove}
            title={t.common.delete}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, flexShrink: 0 }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {logs.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          {logs.map((l) => {
            if (editingCustomId === l.id) {
              const qty = parseFloat(customEditQty) || 0
              const ratio = l.quantity > 0 ? qty / l.quantity : 0
              return (
                <div
                  key={l.id}
                  style={{ backgroundColor: 'var(--color-surface-2)', borderRadius: 10, padding: '6px 10px' }}
                >
                  <p className="truncate" style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500, margin: '0 0 4px' }}>
                    {l.foodName}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <input
                      type="number"
                      value={customEditQty}
                      onChange={(e) => setCustomEditQty(normalizeDecimalInput(e.target.value))}
                      autoFocus
                      style={{ width: 60, padding: '3px 6px', fontSize: 12, backgroundColor: 'var(--color-surface-3)', border: '1px solid var(--color-accent)', borderRadius: 6, color: 'var(--color-text-primary)', outline: 'none' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{l.unit}</span>
                    <button type="button" onClick={() => handleConfirmCustomEdit(l)} style={{ width: 22, height: 22, background: 'transparent', border: 'none', cursor: 'pointer', color: '#22c55e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={13} strokeWidth={3} />
                    </button>
                    <button type="button" onClick={() => setEditingCustomId(null)} style={{ width: 22, height: 22, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={13} />
                    </button>
                    <Pill value={Math.round(l.calories * ratio)} color="var(--color-text-primary)" bg="var(--color-surface-3)" />
                    <Pill value={Math.round(l.proteinG * ratio)} color={COLOR_PROTEIN} bg="rgba(59,130,246,0.12)" />
                    <Pill value={Math.round(l.carbsG * ratio)} color={COLOR_CARBS} bg="rgba(249,115,22,0.12)" />
                    <Pill value={Math.round(l.fatG * ratio)} color={COLOR_FAT} bg="rgba(239,68,68,0.12)" />
                  </div>
                </div>
              )
            }
            return (
              <div
                key={l.id}
                className="flex items-center"
                style={{ backgroundColor: 'var(--color-surface-2)', borderRadius: 10, padding: '10px 12px' }}
              >
                <FoodInner name={l.foodName} quantity={l.quantity} unit={l.unit} calories={l.calories} p={l.proteinG} c={l.carbsG} fat={l.fatG} />
                <button
                  type="button"
                  onClick={() => { setEditingCustomId(l.id); setCustomEditQty(String(l.quantity)) }}
                  title={t.common.edit}
                  style={{ width: 22, height: 22, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCustom(l.id)}
                  title="Remove"
                  className="ml-1 inline-flex items-center justify-center"
                  style={{ width: 22, height: 22, color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <X size={13} />
                </button>
              </div>
            )
          })}
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
  isLogged,
  loggedOptionId,
  customLogs,
  planLogs,
  portionOverrides,
  deletedFoodIds,
  onSelectOption,
  onLogMeal,
  onRemoveMeal,
  onDeleteCustom,
  onUpdateCustomQty,
  onPortionOverride,
  onDeleteFood,
  onUndoDelete,
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
  isLogged: boolean
  loggedOptionId: string | null
  customLogs: DayLog[]
  planLogs: DayLog[]
  portionOverrides: Record<string, number>
  deletedFoodIds: Record<string, boolean>
  onSelectOption: (id: string) => void
  onLogMeal: () => Promise<void>
  onRemoveMeal: () => Promise<void>
  onDeleteCustom: (logId: string) => void
  onUpdateCustomQty: (
    logId: string,
    newQty: number,
    origQty: number,
    origCal: number,
    origP: number,
    origC: number,
    origF: number
  ) => Promise<void>
  onPortionOverride: (foodId: string, qty: number) => void
  onDeleteFood: (foodId: string, loggedFoodId?: string | null) => Promise<void>
  onUndoDelete: (mealFoodIds: Set<string>) => void
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
  }) => void
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
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null)
  const [customEditQty, setCustomEditQty] = useState('')

  const effectiveLogged = optimisticLogged !== null ? optimisticLogged : isLogged

  const mealFoodIds = useMemo(
    () => new Set((activeOption?.foods ?? []).map(f => f.id)),
    [activeOption]
  )
  const hasDeletions = (activeOption?.foods ?? []).some(f => deletedFoodIds[f.id])

  const handleCircleTap = async () => {
    if (circleLoading) return
    const next = !effectiveLogged
    setOptimisticLogged(next)
    setCircleLoading(true)
    setCircleError(false)
    try {
      if (next) {
        await onLogMeal()
      } else {
        await onRemoveMeal()
      }
    } catch {
      setOptimisticLogged(!next)
      setCircleError(true)
      setTimeout(() => setCircleError(false), 2000)
    } finally {
      setCircleLoading(false)
      setOptimisticLogged(null)
    }
  }

  const totals = useMemo(() => {
    const base = !activeOption
      ? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      : activeOption.foods.reduce(
          (acc, f) => {
            const isDeleted = isLogged
              ? planLogs.every((l) => l.templateFoodId !== f.id)
              : !!deletedFoodIds[f.id]
            if (isDeleted) return acc

            const qty = portionOverrides[f.id] ?? f.quantity
            const ratio = qty / f.quantity
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
  }, [activeOption, portionOverrides, customLogs, planLogs, isLogged, deletedFoodIds])

  const handleConfirmCustomEdit = async (log: DayLog) => {
    const qty = parseFloat(customEditQty)
    if (qty > 0) {
      await onUpdateCustomQty(log.id, qty, log.quantity, log.calories, log.proteinG, log.carbsG, log.fatG)
    }
    setEditingCustomId(null)
  }

  // The circle logs/unlogs the plan meal. Allow logging only when at least one
  // plan food is still active (not removed); always allow unlogging when logged.
  const hasActivePlanFood = !!activeOption && activeOption.foods.some((f) => !deletedFoodIds[f.id])
  const canLog = isLogged || hasActivePlanFood

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: circleError ? '1px solid #ef4444' : '1px solid var(--color-border)',
        borderRadius: 16,
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
        {hasDeletions && (
          <button
            type="button"
            onClick={() => onUndoDelete(mealFoodIds)}
            title="Undo last removal"
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: '2px solid var(--color-text-hint)',
              color: 'var(--color-text-hint)',
              cursor: 'pointer',
              touchAction: 'manipulation',
              flexShrink: 0,
              padding: 0,
            }}
          >
            {/* Undo / rotate-back arrows */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={handleCircleTap}
          disabled={!canLog}
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
        <div className="flex items-center gap-1 mb-2">
          {meal.options.map((o) => {
            const active = activeOption?.id === o.id
            const wasLogged = o.id === loggedOptionId
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onSelectOption(o.id)}
                className="px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: active ? '#fff' : 'var(--color-surface-2)',
                  color: active ? '#000' : 'var(--color-text-muted)',
                  border: 'none',
                  borderRadius: 999,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {t.nutrition.option} {o.label}
                {wasLogged && (
                  <Check size={10} strokeWidth={3} color={active ? '#22c55e' : '#22c55e'} />
                )}
              </button>
            )
          })}
        </div>
      )}

      {activeOption && (
        <div className="flex flex-col gap-1.5 mb-2">
          {activeOption.foods
            .filter((f) => {
              const isDeleted = isLogged
                ? planLogs.every((l) => l.templateFoodId !== f.id)
                : !!deletedFoodIds[f.id]
              return !isDeleted
            })
            .map((f) => {
              const matchingLog = planLogs.find((l) => l.templateFoodId === f.id)
              return (
                <FoodRow
                  key={f.id}
                  foodId={f.id}
                  name={tx(t.foods as Record<string, string>, f.foodName)}
                  quantity={f.quantity}
                  unit={f.unit}
                  calories={f.calories}
                  p={f.proteinG}
                  c={f.carbsG}
                  fat={f.fatG}
                  portionOverride={portionOverrides[f.id]}
                  onPortionOverride={(qty) => onPortionOverride(f.id, qty)}
                  onDelete={() => onDeleteFood(f.id, matchingLog?.id)}
                />
              )
            })}
        </div>
      )}

      {customLogs.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          {customLogs.map((l) => {
            if (editingCustomId === l.id) {
              const qty = parseFloat(customEditQty) || 0
              const ratio = l.quantity > 0 ? qty / l.quantity : 0
              return (
                <div
                  key={l.id}
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
                    {l.foodName}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <input
                      type="number"
                      value={customEditQty}
                      onChange={(e) => setCustomEditQty(normalizeDecimalInput(e.target.value))}
                      autoFocus
                      style={{
                        width: 60,
                        padding: '3px 6px',
                        fontSize: 12,
                        backgroundColor: 'var(--color-surface-3)',
                        border: '1px solid var(--color-accent)',
                        borderRadius: 6,
                        color: 'var(--color-text-primary)',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{l.unit}</span>
                    <button
                      type="button"
                      onClick={() => handleConfirmCustomEdit(l)}
                      style={{
                        width: 22,
                        height: 22,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
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
                      onClick={() => setEditingCustomId(null)}
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
                    <Pill value={Math.round(l.calories * ratio)} color="var(--color-text-primary)" bg="var(--color-surface-3)" />
                    <Pill value={Math.round(l.proteinG * ratio)} color={COLOR_PROTEIN} bg="rgba(59,130,246,0.12)" />
                    <Pill value={Math.round(l.carbsG * ratio)} color={COLOR_CARBS} bg="rgba(249,115,22,0.12)" />
                    <Pill value={Math.round(l.fatG * ratio)} color={COLOR_FAT} bg="rgba(239,68,68,0.12)" />
                  </div>
                </div>
              )
            }

            return (
              <div
                key={l.id}
                className="flex items-center"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                <FoodInner
                  name={l.foodName}
                  quantity={l.quantity}
                  unit={l.unit}
                  calories={l.calories}
                  p={l.proteinG}
                  c={l.carbsG}
                  fat={l.fatG}
                />
                <button
                  type="button"
                  onClick={() => {
                    setEditingCustomId(l.id)
                    setCustomEditQty(String(l.quantity))
                  }}
                  title={t.common.edit}
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
                  onClick={() => onDeleteCustom(l.id)}
                  title="Remove"
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
              </div>
            )
          })}
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

function FoodRow({
  foodId,
  name,
  quantity,
  unit,
  calories,
  p,
  c,
  fat,
  portionOverride,
  onPortionOverride,
  onDelete,
}: {
  foodId: string
  name: string
  quantity: number
  unit: string
  calories: number
  p: number
  c: number
  fat: number
  portionOverride: number | undefined
  onPortionOverride: (qty: number) => void
  onDelete?: () => void
}) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [editQty, setEditQty] = useState('')

  void foodId

  const displayQty = portionOverride ?? quantity
  const displayRatio = quantity > 0 ? displayQty / quantity : 1

  const editRatio = quantity > 0 ? (parseFloat(editQty) || 0) / quantity : 0

  const handleConfirm = () => {
    const qty = parseFloat(editQty)
    if (qty > 0) onPortionOverride(qty)
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
            type="number"
            value={editQty}
            onChange={(e) => setEditQty(normalizeDecimalInput(e.target.value))}
            autoFocus
            style={{
              width: 60,
              padding: '3px 6px',
              fontSize: 12,
              backgroundColor: 'var(--color-surface-3)',
              border: '1px solid var(--color-accent)',
              borderRadius: 6,
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{unit}</span>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              width: 22,
              height: 22,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
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
          title={t.common.delete}
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
  }) => void
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
  const [selected, setSelected] = useState<FoodSearchResult | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [manualOpen, setManualOpen] = useState(false)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [showFoodScanner, setShowFoodScanner] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchFoodsForClient(query)
        setResults(r)
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleAddFromResult = () => {
    if (!selected) return
    const q = parseFloat(quantity) || 0
    if (q <= 0) return
    onAdd({
      foodName: selected.brand ? `${selected.name} (${selected.brand})` : selected.name,
      quantity: q,
      unit: 'g',
      calories: round1((selected.caloriesPer100g * q) / 100),
      proteinG: round1((selected.proteinPer100g * q) / 100),
      carbsG: round1((selected.carbsPer100g * q) / 100),
      fatG: round1((selected.fatPer100g * q) / 100),
    })
    setQuery('')
    setResults([])
    setSelected(null)
    setQuantity('100')
  }

  const selectedInsights: NutritionInsight[] = selected
    ? getNutritionInsights(selected, parseFloat(quantity) || 0, dailyGoal ?? null)
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
            {searching && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--color-text-hint)' }} />}
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
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(normalizeDecimalInput(e.target.value))}
              style={{
                width: 70,
                padding: '6px 8px',
                fontSize: 13,
                backgroundColor: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                color: 'var(--color-text-primary)',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>g</span>
            <button
              type="button"
              onClick={handleAddFromResult}
              className="px-3 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {t.nutrition.addToMeal}
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs"
              style={{
                color: 'var(--color-text-hint)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
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
        <ManualEntryForm
          mealName={mealName}
          onAdd={onAdd}
          onCancel={() => setManualOpen(false)}
        />
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
  mealName,
  onAdd,
  onCancel,
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
  }) => void
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [cal, setCal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  const [q, setQ] = useState('100')

  const handle = () => {
    if (!name.trim()) return
    onAdd({
      foodName: name.trim(),
      quantity: parseFloat(q) || 0,
      unit: 'g',
      calories: parseFloat(cal) || 0,
      proteinG: parseFloat(p) || 0,
      carbsG: parseFloat(c) || 0,
      fatG: parseFloat(f) || 0,
    })
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
        <input type="number" value={cal} onChange={(e) => setCal(normalizeDecimalInput(e.target.value))} placeholder={t.nutrition.calories} style={inputStyle} />
        <input type="number" value={q} onChange={(e) => setQ(normalizeDecimalInput(e.target.value))} placeholder={`${t.nutrition.quantity} (${t.nutrition.grams})`} style={inputStyle} />
        <input type="number" value={p} onChange={(e) => setP(normalizeDecimalInput(e.target.value))} placeholder={`${t.nutrition.protein} (${t.nutrition.grams})`} style={inputStyle} />
        <input type="number" value={c} onChange={(e) => setC(normalizeDecimalInput(e.target.value))} placeholder={`${t.nutrition.carbs} (${t.nutrition.grams})`} style={inputStyle} />
        <input type="number" value={f} onChange={(e) => setF(normalizeDecimalInput(e.target.value))} placeholder={`${t.nutrition.fat} (${t.nutrition.grams})`} style={inputStyle} />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handle}
          className="px-3 py-1.5 text-xs font-semibold"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          {t.nutrition.addToMeal}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs"
          style={{
            color: 'var(--color-text-hint)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
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
          border: '1px dashed var(--color-border)',
          borderRadius: 16,
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
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
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
