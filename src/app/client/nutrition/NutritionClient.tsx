'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Search, Loader2, Check, X, Plus } from 'lucide-react'
import {
  getDayLogs,
  logMealOption,
  removeOptionLog,
  logCustomFood,
  searchFoodsForClient,
  deleteNutritionLog,
  type FullMealPlan,
  type DayLog,
  type Meal,
  type Option,
} from './actions'
import type { FoodSearchResult } from '@/lib/food-search'

const COLOR_PROTEIN = '#3b82f6'
const COLOR_CARBS = '#f97316'
const COLOR_FAT = '#ef4444'

const MEAL_ICONS: Record<string, string> = {
  Breakfast: '☀️',
  Lunch: '🥗',
  Dinner: '🍽️',
  Snack: '🍎',
  'Pre-workout': '⚡',
  'Post-workout': '💪',
}

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
  const [clientId] = useState(initialClientId)
  const [workspaceId] = useState(initialWorkspaceId)
  const [selectedDate, setSelectedDate] = useState<string>(initialDate)
  const [planType, setPlanType] = useState<'training' | 'rest'>(initialPlanType)
  const [planTypeUserSet, setPlanTypeUserSet] = useState(false)
  // Both plans pre-fetched server-side — switch between them instantly
  const [mealPlanTraining] = useState(initialMealPlanTraining)
  const [mealPlanRest] = useState(initialMealPlanRest)
  const mealPlan = planType === 'training' ? mealPlanTraining : mealPlanRest
  const [dayLogs, setDayLogs] = useState<DayLog[]>(initialDayLogs)
  const [loading, setLoading] = useState(false)
  const [activeAddFoodMeal, setActiveAddFoodMeal] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'diary' | 'notes'>('diary')

  const reloadDayLogs = useCallback(async () => {
    if (!clientId) return
    const logs = await getDayLogs(clientId, selectedDate)
    setDayLogs(logs)
    setLoading(false)
  }, [clientId, selectedDate])

  // Skip initial mount — server already provided today's data
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (!clientId) return
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setLoading(true)
    reloadDayLogs()
  }, [clientId, selectedDate, reloadDayLogs])

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
    await logMealOption({
      clientId,
      workspaceId,
      loggedDate: selectedDate,
      mealType: meal.name,
      mealOptionId: option.id,
      foods: option.foods.map((f) => ({
        templateFoodId: f.id,
        foodName: f.foodName,
        quantity: f.quantity,
        unit: f.unit,
        calories: f.calories,
        proteinG: f.proteinG,
        carbsG: f.carbsG,
        fatG: f.fatG,
      })),
    })
    await reloadDayLogs()
  }

  const handleRemoveMeal = async (mealName: string) => {
    if (!clientId) return
    await removeOptionLog(clientId, selectedDate, mealName)
    await reloadDayLogs()
  }

  const handleDeleteCustom = async (logId: string) => {
    await deleteNutritionLog(logId)
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

  void planTypeUserSet

  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      <div style={{ padding: '52px 20px 12px' }}>
        <div className="flex items-center justify-between mb-3">
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            Nutrition
          </h1>
          <PlanTypeToggle value={planType} onChange={handleSetPlanType} />
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
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--color-text-hint)' }}>
              Loading…
            </p>
          ) : !mealPlan ? (
            <NoPlanCard planType={planType} />
          ) : (
            <div className="flex flex-col gap-3">
              {mealPlan.meals.map((meal) => {
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
                    onSelectOption={(optId) =>
                      setSelectedOption((prev) => ({ ...prev, [optKey]: optId }))
                    }
                    onLogMeal={async () => { if (activeOption) await handleLogMeal(meal, activeOption) }}
                    onRemoveMeal={async () => handleRemoveMeal(meal.name)}
                    onDeleteCustom={handleDeleteCustom}
                    addFoodOpen={activeAddFoodMeal === meal.name}
                    onToggleAddFood={() =>
                      setActiveAddFoodMeal(activeAddFoodMeal === meal.name ? null : meal.name)
                    }
                    onAddCustomFood={(p) => handleAddCustomFood(meal.name, p)}
                  />
                )
              })}
            </div>
          )}
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
      {(['training', 'rest'] as const).map((t) => {
        const active = value === t
        const accent = t === 'training' ? '#3b82f6' : '#22c55e'
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className="px-2.5 py-1 text-xs font-semibold"
            style={{
              backgroundColor: active ? accent : 'transparent',
              color: active ? '#fff' : 'var(--color-text-muted)',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t === 'training' ? 'Training' : 'Rest'}
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
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
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
      style={{
        backgroundColor: 'var(--color-surface-1)',
        borderRadius: 16,
        border: '1px solid var(--color-border)',
        padding: 8,
        gap: 4,
      }}
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
              padding: '6px 0 4px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--color-text-hint)', fontWeight: 600 }}>
              {d.label}
            </span>
            <span
              className="flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: active ? '#fff' : 'transparent',
                color: active ? '#000' : 'var(--color-text-primary)',
                fontWeight: 600,
                fontSize: 13,
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
            {(!d.isToday || active) && <span style={{ width: 4, height: 4 }} />}
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
  const remaining = goal ? Math.max(0, goal - current) : null
  const pct = goal ? Math.min(1, current / goal) : 0
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: '14px 16px 16px',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>
          Calories
        </span>
        {remaining !== null && (
          <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>
            {Math.round(remaining)} remaining
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
          {Math.round(current)}
        </span>
        {goal !== null && (
          <span style={{ fontSize: 14, color: 'var(--color-text-hint)' }}>
            / {Math.round(goal)}
          </span>
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
              backgroundColor: '#fff',
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
        <MacroCol label="Protein" current={totals.proteinG} goal={goal?.proteinG ?? null} color={COLOR_PROTEIN} />
        <MacroCol label="Carbs" current={totals.carbsG} goal={goal?.carbsG ?? null} color={COLOR_CARBS} />
        <MacroCol label="Fat" current={totals.fatG} goal={goal?.fatG ?? null} color={COLOR_FAT} />
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
  return (
    <div className="flex items-center gap-2">
      {(['diary', 'notes'] as const).map((t) => {
        const active = tab === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className="px-3 py-1.5 text-sm font-semibold"
            style={{
              backgroundColor: active ? 'var(--color-surface-3)' : 'transparent',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            {t === 'diary' ? 'Diary' : 'Notes'}
          </button>
        )
      })}
    </div>
  )
}

function NoPlanCard({ planType }: { planType: 'training' | 'rest' }) {
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
        No {planType === 'training' ? 'Training' : 'Rest'} day meal plan assigned yet.
      </p>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
        Your coach will assign a meal plan to your profile.
      </p>
    </div>
  )
}

function MealCard({
  meal,
  activeOption,
  isLogged,
  loggedOptionId,
  customLogs,
  onSelectOption,
  onLogMeal,
  onRemoveMeal,
  onDeleteCustom,
  addFoodOpen,
  onToggleAddFood,
  onAddCustomFood,
}: {
  meal: Meal
  activeOption: Option | undefined
  isLogged: boolean
  loggedOptionId: string | null
  customLogs: DayLog[]
  onSelectOption: (id: string) => void
  onLogMeal: () => Promise<void>
  onRemoveMeal: () => Promise<void>
  onDeleteCustom: (logId: string) => void
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
}) {
  const [circleLoading, setCircleLoading] = useState(false)
  const [optimisticLogged, setOptimisticLogged] = useState<boolean | null>(null)
  const [circleError, setCircleError] = useState(false)

  const effectiveLogged = optimisticLogged !== null ? optimisticLogged : isLogged

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
    if (!activeOption) return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    return activeOption.foods.reduce(
      (acc, f) => ({
        calories: round1(acc.calories + f.calories),
        proteinG: round1(acc.proteinG + f.proteinG),
        carbsG: round1(acc.carbsG + f.carbsG),
        fatG: round1(acc.fatG + f.fatG),
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    )
  }, [activeOption])

  const icon = MEAL_ICONS[meal.name] ?? '🍴'
  const canLog = !!activeOption && activeOption.foods.length > 0

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
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
          {meal.name}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {Math.round(totals.calories)} kcal
        </span>
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
                Option {o.label}
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
          {activeOption.foods.map((f) => (
            <FoodRow
              key={f.id}
              name={f.foodName}
              quantity={f.quantity}
              unit={f.unit}
              calories={f.calories}
              p={f.proteinG}
              c={f.carbsG}
              fat={f.fatG}
            />
          ))}
        </div>
      )}

      {customLogs.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          {customLogs.map((l) => (
            <div
              key={l.id}
              className="flex items-center"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                borderRadius: 10,
                padding: '6px 10px',
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
          ))}
        </div>
      )}

      <div
        className="mt-3 pt-2"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>
          Total: {Math.round(totals.calories)}cal · {Math.round(totals.proteinG)}g P ·{' '}
          {Math.round(totals.carbsG)}g C · {Math.round(totals.fatG)}g F
        </span>
      </div>

      <div className="mt-2">
        <button
          type="button"
          onClick={onToggleAddFood}
          className="text-xs"
          style={{
            color: 'var(--color-text-muted)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 0,
          }}
        >
          <Plus size={12} />
          {addFoodOpen ? 'Cancel' : 'Add custom food'}
        </button>
        {addFoodOpen && <AddCustomFood mealName={meal.name} onAdd={onAddCustomFood} />}
      </div>
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
    <div
      className="flex items-center"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: 10,
        padding: '6px 10px',
      }}
    >
      <FoodInner name={name} quantity={quantity} unit={unit} calories={calories} p={p} c={c} fat={fat} />
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
          style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500, margin: 0 }}
        >
          {name}
        </p>
        <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: '1px 0 0' }}>
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
        fontSize: 10,
        fontWeight: 700,
        color,
        backgroundColor: bg,
        padding: '2px 5px',
        borderRadius: 6,
        minWidth: 22,
        textAlign: 'center',
      }}
    >
      {value}
    </span>
  )
}

function AddCustomFood({
  mealName,
  onAdd,
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
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<FoodSearchResult | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [manualOpen, setManualOpen] = useState(false)
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
              placeholder="Search food..."
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
            Enter manually
          </button>
        </>
      )}

      {selected && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600, margin: '0 0 6px' }}>
            {selected.name}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
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
              Add to {mealName}
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
              Cancel
            </button>
          </div>
        </div>
      )}

      {manualOpen && (
        <ManualEntryForm
          mealName={mealName}
          onAdd={onAdd}
          onCancel={() => setManualOpen(false)}
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
        placeholder="Food name"
        style={{ ...inputStyle, marginBottom: 6 }}
      />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input type="number" value={cal} onChange={(e) => setCal(e.target.value)} placeholder="Calories" style={inputStyle} />
        <input type="number" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Quantity (g)" style={inputStyle} />
        <input type="number" value={p} onChange={(e) => setP(e.target.value)} placeholder="Protein (g)" style={inputStyle} />
        <input type="number" value={c} onChange={(e) => setC(e.target.value)} placeholder="Carbs (g)" style={inputStyle} />
        <input type="number" value={f} onChange={(e) => setF(e.target.value)} placeholder="Fat (g)" style={inputStyle} />
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
          Add to {mealName}
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
          Cancel
        </button>
      </div>
    </div>
  )
}

function NotesCard({ plan }: { plan: FullMealPlan | null }) {
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
          No meal plan assigned yet.
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
          From your coach
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
          Notes
        </p>
        {plan.notes ? (
          <p style={{ fontSize: 14, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {plan.notes}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-text-hint)', fontStyle: 'italic', margin: 0 }}>
            No notes yet.
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
          Recommendations
        </p>
        {plan.recommendations ? (
          <p style={{ fontSize: 14, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {plan.recommendations}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-text-hint)', fontStyle: 'italic', margin: 0 }}>
            No recommendations yet.
          </p>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: '8px 0 0' }}>
        Last updated {updatedStr}
      </p>
    </div>
  )
}
