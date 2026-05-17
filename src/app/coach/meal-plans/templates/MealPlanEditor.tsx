'use client'

import { useState, useTransition, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronUp, ChevronDown, Trash2, Plus, Search, Loader2, Sparkles } from 'lucide-react'
import {
  upsertMealPlanTemplate,
  searchFoods,
  upsertFood,
  type FullTemplate,
  type PlanType,
} from '../actions'
import type { FoodSearchResult } from '@/lib/food-search'

const MEAL_PRESETS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-workout', 'Post-workout', 'Other']
const UNITS = ['g', 'ml', 'kg', 'L', 'oz', 'tbsp', 'tsp', 'cup', 'piece', 'serving']

const GRAM_EQUIVALENT: Record<string, number> = {
  g: 1,
  ml: 1,
  kg: 1000,
  L: 1000,
  oz: 28.35,
  tbsp: 15,
  tsp: 5,
  cup: 240,
  piece: 50,
  serving: 100,
}

const COLOR_PROTEIN = '#3b82f6'
const COLOR_CARBS = '#f97316'
const COLOR_FAT = '#ef4444'

type FoodEntry = {
  tempId: string
  foodId: string | null
  foodName: string
  quantity: number
  unit: string
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  sortOrder: number
}

type OptionEntry = {
  tempId: string
  label: string
  sortOrder: number
  foods: FoodEntry[]
  activeOption?: boolean
}

type MealEntry = {
  tempId: string
  name: string
  sortOrder: number
  options: OptionEntry[]
  activeOptionTempId: string
}

type SearchState = {
  query: string
  results: FoodSearchResult[]
  loading: boolean
  open: boolean
  manualOpen: boolean
}

const newId = () => Math.random().toString(36).slice(2, 11)

// ── AI plan types & converter ─────────────────────────────────────────────────

type AiFood = {
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

type AiOption = {
  label: string
  sort_order: number
  foods: AiFood[]
}

type AiMeal = {
  name: string
  sort_order: number
  options: AiOption[]
}

type AiPlan = {
  name: string
  plan_type: 'training' | 'rest'
  notes?: string
  recommendations?: string
  meals: AiMeal[]
}

function fromAiPlan(plan: AiPlan): { meals: MealEntry[]; name: string; planType: PlanType; notes: string; recommendations: string } {
  const meals: MealEntry[] = plan.meals.map((m) => {
    const options: OptionEntry[] = m.options.map((o) => ({
      tempId: newId(),
      label: o.label,
      sortOrder: o.sort_order,
      foods: o.foods.map((f, fi) => {
        const gramEquiv = GRAM_EQUIVALENT[f.unit] ?? 1
        const grams = f.quantity * gramEquiv
        const caloriesPer100g = grams > 0 ? round1((f.calories / grams) * 100) : 0
        const proteinPer100g  = grams > 0 ? round1((f.protein_g / grams) * 100) : 0
        const carbsPer100g    = grams > 0 ? round1((f.carbs_g / grams) * 100) : 0
        const fatPer100g      = grams > 0 ? round1((f.fat_g / grams) * 100) : 0
        return {
          tempId: newId(),
          foodId: null,
          foodName: f.food_name,
          quantity: f.quantity,
          unit: f.unit,
          caloriesPer100g,
          proteinPer100g,
          carbsPer100g,
          fatPer100g,
          calories: f.calories,
          proteinG: f.protein_g,
          carbsG: f.carbs_g,
          fatG: f.fat_g,
          sortOrder: fi,
        }
      }),
    }))
    if (options.length === 0) options.push(emptyOption('A', 0))
    return {
      tempId: newId(),
      name: m.name,
      sortOrder: m.sort_order,
      options,
      activeOptionTempId: options[0].tempId,
    }
  })
  return {
    meals,
    name: plan.name ?? '',
    planType: plan.plan_type === 'rest' ? 'rest' : 'training',
    notes: plan.notes ?? '',
    recommendations: plan.recommendations ?? '',
  }
}

function computeMacros(food: FoodEntry, quantity: number, unit?: string): FoodEntry {
  const effectiveUnit = unit ?? food.unit
  const grams = quantity * (GRAM_EQUIVALENT[effectiveUnit] ?? 1)
  return {
    ...food,
    quantity,
    unit: effectiveUnit,
    calories: round1((food.caloriesPer100g * grams) / 100),
    proteinG: round1((food.proteinPer100g * grams) / 100),
    carbsG: round1((food.carbsPer100g * grams) / 100),
    fatG: round1((food.fatPer100g * grams) / 100),
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function optionTotals(option: OptionEntry) {
  return option.foods.reduce(
    (acc, f) => ({
      calories: round1(acc.calories + f.calories),
      proteinG: round1(acc.proteinG + f.proteinG),
      carbsG: round1(acc.carbsG + f.carbsG),
      fatG: round1(acc.fatG + f.fatG),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  )
}

function emptyOption(label: string, sortOrder: number): OptionEntry {
  return { tempId: newId(), label, sortOrder, foods: [] }
}

function emptyMeal(sortOrder: number): MealEntry {
  const opt = emptyOption('A', 0)
  return {
    tempId: newId(),
    name: 'Breakfast',
    sortOrder,
    options: [opt],
    activeOptionTempId: opt.tempId,
  }
}

function serializePlan(meals: MealEntry[], name: string, planType: PlanType, notes: string, recommendations: string) {
  return {
    name,
    plan_type: planType,
    notes,
    recommendations,
    meals: meals.map((m) => ({
      name: m.name,
      sort_order: m.sortOrder,
      options: m.options.map((o) => ({
        label: o.label,
        sort_order: o.sortOrder,
        foods: o.foods.map((f) => ({
          food_name: f.foodName,
          quantity: f.quantity,
          unit: f.unit,
          calories: f.calories,
          protein_g: f.proteinG,
          carbs_g: f.carbsG,
          fat_g: f.fatG,
        })),
      })),
    })),
  }
}

function fromInitial(initial: FullTemplate): MealEntry[] {
  return initial.meals.map((m) => {
    const options: OptionEntry[] = m.options.map((o) => ({
      tempId: newId(),
      label: o.label,
      sortOrder: o.sortOrder,
      foods: o.foods.map((f) => {
        const cal100 = f.quantity > 0 ? (f.calories / f.quantity) * 100 : 0
        const p100 = f.quantity > 0 ? (f.proteinG / f.quantity) * 100 : 0
        const c100 = f.quantity > 0 ? (f.carbsG / f.quantity) * 100 : 0
        const ft100 = f.quantity > 0 ? (f.fatG / f.quantity) * 100 : 0
        return {
          tempId: newId(),
          foodId: f.foodId,
          foodName: f.foodName,
          quantity: f.quantity,
          unit: f.unit,
          caloriesPer100g: round1(cal100),
          proteinPer100g: round1(p100),
          carbsPer100g: round1(c100),
          fatPer100g: round1(ft100),
          calories: f.calories,
          proteinG: f.proteinG,
          carbsG: f.carbsG,
          fatG: f.fatG,
          sortOrder: f.sortOrder,
        }
      }),
    }))
    if (options.length === 0) options.push(emptyOption('A', 0))
    return {
      tempId: newId(),
      name: m.name,
      sortOrder: m.sortOrder,
      options,
      activeOptionTempId: options[0].tempId,
    }
  })
}

export default function MealPlanEditor({
  workspaceId,
  initialData,
}: {
  workspaceId: string
  initialData?: FullTemplate
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(initialData?.name ?? '')
  const [planType, setPlanType] = useState<PlanType>(initialData?.planType ?? 'training')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [recommendations, setRecommendations] = useState(initialData?.recommendations ?? '')
  const [meals, setMeals] = useState<MealEntry[]>(
    initialData ? fromInitial(initialData) : [emptyMeal(0)]
  )

  const [searches, setSearches] = useState<Record<string, SearchState>>({})

  const planTotals = useMemo(() => {
    return meals.reduce(
      (acc, meal) => {
        const activeOption = meal.options.find((o) => o.tempId === meal.activeOptionTempId) ?? meal.options[0]
        if (!activeOption) return acc
        const t = optionTotals(activeOption)
        return {
          calories: round1(acc.calories + t.calories),
          proteinG: round1(acc.proteinG + t.proteinG),
          carbsG: round1(acc.carbsG + t.carbsG),
          fatG: round1(acc.fatG + t.fatG),
        }
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    )
  }, [meals])

  // ── AI generation ───────────────────────────────────────────────────────────
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGenerated, setAiGenerated] = useState(false)

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiGenerating) return
    setAiGenerating(true)
    setAiError(null)
    try {
      const res = await fetch('/api/meal-plan/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: aiPrompt.trim(),
          ...(aiGenerated ? { current_plan: serializePlan(meals, name, planType, notes, recommendations) } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const { meals: aiMeals, name: aiName, planType: aiPlanType, notes: aiNotes, recommendations: aiRecs } = fromAiPlan(data as AiPlan)
      setMeals(aiMeals)
      if (aiName) setName(aiName)
      setPlanType(aiPlanType)
      if (aiNotes) setNotes(aiNotes)
      if (aiRecs) setRecommendations(aiRecs)
      setAiGenerated(true)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setAiGenerating(false)
    }
  }

  const updateSearch = (optionTempId: string, patch: Partial<SearchState>) => {
    setSearches((prev) => {
      const existing = prev[optionTempId] ?? {
        query: '',
        results: [],
        loading: false,
        open: false,
        manualOpen: false,
      }
      return {
        ...prev,
        [optionTempId]: { ...existing, ...patch },
      }
    })
  }

  const updateMeal = (mealTempId: string, fn: (m: MealEntry) => MealEntry) => {
    setMeals((prev) => prev.map((m) => (m.tempId === mealTempId ? fn(m) : m)))
  }

  const updateOption = (
    mealTempId: string,
    optionTempId: string,
    fn: (o: OptionEntry) => OptionEntry
  ) => {
    updateMeal(mealTempId, (m) => ({
      ...m,
      options: m.options.map((o) => (o.tempId === optionTempId ? fn(o) : o)),
    }))
  }

  const addMeal = () => {
    setMeals((prev) => [...prev, emptyMeal(prev.length)])
  }

  const removeMeal = (mealTempId: string) => {
    setMeals((prev) =>
      prev
        .filter((m) => m.tempId !== mealTempId)
        .map((m, i) => ({ ...m, sortOrder: i }))
    )
  }

  const moveMeal = (mealTempId: string, dir: -1 | 1) => {
    setMeals((prev) => {
      const idx = prev.findIndex((m) => m.tempId === mealTempId)
      const target = idx + dir
      if (idx < 0 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((m, i) => ({ ...m, sortOrder: i }))
    })
  }

  const addOption = (mealTempId: string) => {
    updateMeal(mealTempId, (m) => {
      if (m.options.length >= 3) return m
      const labels = ['A', 'B', 'C']
      const used = new Set(m.options.map((o) => o.label))
      const nextLabel = labels.find((l) => !used.has(l)) ?? 'C'
      const opt = emptyOption(nextLabel, m.options.length)
      return { ...m, options: [...m.options, opt], activeOptionTempId: opt.tempId }
    })
  }

  const removeOption = (mealTempId: string, optionTempId: string) => {
    updateMeal(mealTempId, (m) => {
      if (m.options.length <= 1) return m
      const remaining = m.options
        .filter((o) => o.tempId !== optionTempId)
        .map((o, i) => ({ ...o, sortOrder: i }))
      return {
        ...m,
        options: remaining,
        activeOptionTempId:
          m.activeOptionTempId === optionTempId ? remaining[0].tempId : m.activeOptionTempId,
      }
    })
  }

  const addFoodFromResult = async (
    mealTempId: string,
    optionTempId: string,
    result: FoodSearchResult
  ) => {
    let foodId: string | null = null
    if (result.source === 'usda') {
      try {
        foodId = await upsertFood(result)
      } catch {
        foodId = null
      }
    }
    const food: FoodEntry = computeMacros(
      {
        tempId: newId(),
        foodId,
        foodName: result.brand ? `${result.name} (${result.brand})` : result.name,
        quantity: 100,
        unit: 'g',
        caloriesPer100g: result.caloriesPer100g,
        proteinPer100g: result.proteinPer100g,
        carbsPer100g: result.carbsPer100g,
        fatPer100g: result.fatPer100g,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        sortOrder: 0,
      },
      100
    )
    updateOption(mealTempId, optionTempId, (o) => ({
      ...o,
      foods: [...o.foods, { ...food, sortOrder: o.foods.length }],
    }))
    updateSearch(optionTempId, { query: '', results: [], open: false, manualOpen: false })
  }

  const addManualFood = (
    mealTempId: string,
    optionTempId: string,
    payload: {
      foodName: string
      caloriesPer100g: number
      proteinPer100g: number
      carbsPer100g: number
      fatPer100g: number
      quantity: number
    }
  ) => {
    const food: FoodEntry = computeMacros(
      {
        tempId: newId(),
        foodId: null,
        foodName: payload.foodName,
        quantity: payload.quantity,
        unit: 'g',
        caloriesPer100g: payload.caloriesPer100g,
        proteinPer100g: payload.proteinPer100g,
        carbsPer100g: payload.carbsPer100g,
        fatPer100g: payload.fatPer100g,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        sortOrder: 0,
      },
      payload.quantity
    )
    updateOption(mealTempId, optionTempId, (o) => ({
      ...o,
      foods: [...o.foods, { ...food, sortOrder: o.foods.length }],
    }))
    updateSearch(optionTempId, { query: '', results: [], open: false, manualOpen: false })
  }

  const updateFoodQuantity = (
    mealTempId: string,
    optionTempId: string,
    foodTempId: string,
    quantity: number
  ) => {
    updateOption(mealTempId, optionTempId, (o) => ({
      ...o,
      foods: o.foods.map((f) =>
        f.tempId === foodTempId ? computeMacros(f, isFinite(quantity) ? quantity : 0) : f
      ),
    }))
  }

  const updateFoodUnit = (
    mealTempId: string,
    optionTempId: string,
    foodTempId: string,
    unit: string
  ) => {
    updateOption(mealTempId, optionTempId, (o) => ({
      ...o,
      foods: o.foods.map((f) =>
        f.tempId === foodTempId ? computeMacros(f, f.quantity, unit) : f
      ),
    }))
  }

  const removeFood = (mealTempId: string, optionTempId: string, foodTempId: string) => {
    updateOption(mealTempId, optionTempId, (o) => ({
      ...o,
      foods: o.foods.filter((f) => f.tempId !== foodTempId).map((f, i) => ({ ...f, sortOrder: i })),
    }))
  }

  const handleSave = () => {
    setError(null)
    if (!name.trim()) {
      setError('Template name is required')
      return
    }
    if (meals.length === 0) {
      setError('Add at least one meal')
      return
    }
    const valid = meals.every(
      (m) => m.options.length > 0 && m.options.every((o) => o.foods.length > 0)
    )
    if (!valid) {
      setError('Every meal needs at least one option, and every option needs at least one food')
      return
    }

    startTransition(async () => {
      try {
        await upsertMealPlanTemplate({
          id: initialData?.id,
          workspaceId,
          name: name.trim(),
          planType,
          notes,
          recommendations,
          meals: meals.map((m, mi) => ({
            name: m.name,
            sortOrder: mi,
            options: m.options.map((o, oi) => ({
              label: o.label,
              sortOrder: oi,
              foods: o.foods.map((f, fi) => ({
                foodId: f.foodId,
                foodName: f.foodName,
                quantity: f.quantity,
                unit: f.unit,
                calories: f.calories,
                proteinG: f.proteinG,
                carbsG: f.carbsG,
                fatG: f.fatG,
                sortOrder: fi,
              })),
            })),
          })),
        })
        router.push('/coach/meal-plans')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save')
      }
    })
  }

  return (
    <div className="px-6 py-8 max-w-4xl">
      <div className="mb-4">
        <Link
          href="/coach/meal-plans"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}
        >
          <ArrowLeft size={14} />
          Back to meal plans
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          {initialData ? name || 'Edit meal plan' : 'New Meal Plan'}
        </h1>
      </div>

      {/* ── AI panel ──────────────────────────────────────────────────────────── */}
      <div
        className="mb-6 p-4"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={15} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {aiGenerated ? 'Edit with AI' : 'Generate with AI'}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-hint)' }}>
            {aiGenerated ? 'Describe what you want to change' : 'Describe the plan and AI will fill in all meals, options, and foods'}
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAiGenerate() }}
            placeholder={aiGenerated ? 'e.g. swap breakfast Option B to eggs and avocado, increase lunch protein to 55g' : 'Describe a plan (e.g. Mediterranean 2000 kcal, 35/35/30) — or paste a meal plan from the assistant to import it'}
            className="flex-1 px-3 py-2 text-sm"
            disabled={aiGenerating}
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              opacity: aiGenerating ? 0.6 : 1,
            }}
          />
          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={aiGenerating || !aiPrompt.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: aiGenerating || !aiPrompt.trim() ? 'var(--color-surface-3)' : 'var(--color-accent)',
              color: aiGenerating || !aiPrompt.trim() ? 'var(--color-text-hint)' : '#fff',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: aiGenerating || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {aiGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {aiGenerated ? 'Apply Edit' : 'Generate'}
              </>
            )}
          </button>
        </div>

        {aiError && (
          <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>
            {aiError}
          </p>
        )}
        {!aiError && !aiGenerating && aiGenerated && (
          <p className="mt-2 text-xs" style={{ color: '#22c55e' }}>
            Plan generated — review below and save when ready.
          </p>
        )}
      </div>

      {/* ── Template fields ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Template name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cutting — Training Day"
            className="w-full px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Plan type
          </label>
          <PlanTypeToggle value={planType} onChange={setPlanType} />
        </div>
      </div>

      {meals.length > 0 && (
        <div className="flex items-center gap-6 px-4 py-3 mb-6" style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Total</span>
          <Stat label="kcal" value={planTotals.calories} color="var(--color-text-primary)" />
          <Stat label="P" value={planTotals.proteinG} suffix="g" color={COLOR_PROTEIN} />
          <Stat label="C" value={planTotals.carbsG} suffix="g" color={COLOR_CARBS} />
          <Stat label="F" value={planTotals.fatG} suffix="g" color={COLOR_FAT} />
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          Meals
        </h2>
        <button
          type="button"
          onClick={addMeal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          Add Meal
        </button>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        {meals.map((meal, mi) => (
          <MealCard
            key={meal.tempId}
            meal={meal}
            index={mi}
            total={meals.length}
            onChangeName={(n) => updateMeal(meal.tempId, (m) => ({ ...m, name: n }))}
            onMove={(dir) => moveMeal(meal.tempId, dir)}
            onRemove={() => removeMeal(meal.tempId)}
            onAddOption={() => addOption(meal.tempId)}
            onSelectOption={(optId) =>
              updateMeal(meal.tempId, (m) => ({ ...m, activeOptionTempId: optId }))
            }
            onRemoveOption={(optId) => removeOption(meal.tempId, optId)}
            search={searches[meal.activeOptionTempId]}
            onSearchChange={(patch) => updateSearch(meal.activeOptionTempId, patch)}
            onAddFromResult={(r) => addFoodFromResult(meal.tempId, meal.activeOptionTempId, r)}
            onAddManual={(p) => addManualFood(meal.tempId, meal.activeOptionTempId, p)}
            onUpdateFoodQuantity={(foodId, q) =>
              updateFoodQuantity(meal.tempId, meal.activeOptionTempId, foodId, q)
            }
            onUpdateFoodUnit={(foodId, u) =>
              updateFoodUnit(meal.tempId, meal.activeOptionTempId, foodId, u)
            }
            onRemoveFood={(foodId) => removeFood(meal.tempId, meal.activeOptionTempId, foodId)}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Notes for client
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              resize: 'vertical',
            }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Recommendations
          </label>
          <textarea
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              resize: 'vertical',
            }}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm mb-3" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? 'Saving…' : 'Save template'}
        </button>
        <Link
          href="/coach/meal-plans"
          className="px-4 py-2 text-sm"
          style={{
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
          }}
        >
          Cancel
        </Link>
      </div>
    </div>
  )
}

function PlanTypeToggle({
  value,
  onChange,
}: {
  value: PlanType
  onChange: (v: PlanType) => void
}) {
  return (
    <div
      className="flex p-1"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        display: 'inline-flex',
      }}
    >
      {(['training', 'rest', 'overall'] as const).map((t) => {
        const active = value === t
        const accent = t === 'training' ? '#3b82f6' : t === 'rest' ? '#22c55e' : '#a855f7'
        const label = t === 'training' ? 'Training Day' : t === 'rest' ? 'Rest Day' : 'Overall'
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className="px-4 py-1.5 text-sm font-medium"
            style={{
              backgroundColor: active ? `${accent}26` : 'transparent',
              color: active ? accent : 'var(--color-text-muted)',
              borderRadius: 'calc(var(--radius-md) - 2px)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function MealCard({
  meal,
  index,
  total,
  onChangeName,
  onMove,
  onRemove,
  onAddOption,
  onSelectOption,
  onRemoveOption,
  search,
  onSearchChange,
  onAddFromResult,
  onAddManual,
  onUpdateFoodQuantity,
  onUpdateFoodUnit,
  onRemoveFood,
}: {
  meal: MealEntry
  index: number
  total: number
  onChangeName: (n: string) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onAddOption: () => void
  onSelectOption: (id: string) => void
  onRemoveOption: (id: string) => void
  search: SearchState | undefined
  onSearchChange: (patch: Partial<SearchState>) => void
  onAddFromResult: (r: FoodSearchResult) => void
  onAddManual: (p: {
    foodName: string
    caloriesPer100g: number
    proteinPer100g: number
    carbsPer100g: number
    fatPer100g: number
    quantity: number
  }) => void
  onUpdateFoodQuantity: (foodId: string, q: number) => void
  onUpdateFoodUnit: (foodId: string, u: string) => void
  onRemoveFood: (foodId: string) => void
}) {
  const isPreset = MEAL_PRESETS.includes(meal.name)
  const activeOption = meal.options.find((o) => o.tempId === meal.activeOptionTempId) ?? meal.options[0]

  return (
    <div
      className="px-5 py-4"
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-2xl, 1rem)',
      }}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <select
          value={isPreset ? meal.name : 'Other'}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'Other') onChangeName(meal.name && !MEAL_PRESETS.includes(meal.name) ? meal.name : '')
            else onChangeName(v)
          }}
          className="px-2 py-1.5 text-sm"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
          }}
        >
          {MEAL_PRESETS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {!isPreset && (
          <input
            type="text"
            value={meal.name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Custom meal name"
            className="px-2 py-1.5 text-sm"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              flex: 1,
              minWidth: 160,
            }}
          />
        )}

        <div className="flex items-center gap-1 ml-auto">
          <IconBtn title="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
            <ChevronUp size={14} />
          </IconBtn>
          <IconBtn title="Move down" disabled={index === total - 1} onClick={() => onMove(1)}>
            <ChevronDown size={14} />
          </IconBtn>
          {meal.options.length < 3 && (
            <button
              type="button"
              onClick={onAddOption}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs"
              style={{
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <Plus size={12} />
              Option
            </button>
          )}
          <IconBtn title="Delete meal" danger onClick={onRemove}>
            <Trash2 size={14} />
          </IconBtn>
        </div>
      </div>

      {meal.options.length > 1 && (
        <div className="flex items-center gap-1 mb-3">
          {meal.options.map((o) => {
            const active = o.tempId === meal.activeOptionTempId
            return (
              <div key={o.tempId} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onSelectOption(o.tempId)}
                  className="px-3 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: active ? 'var(--color-accent-dim)' : 'var(--color-surface-2)',
                    color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                  }}
                >
                  Option {o.label}
                </button>
                {active && meal.options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveOption(o.tempId)}
                    title="Remove option"
                    className="ml-1 inline-flex items-center justify-center"
                    style={{
                      width: 22,
                      height: 22,
                      color: '#ef4444',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeOption && (
        <OptionContent
          option={activeOption}
          search={search}
          onSearchChange={onSearchChange}
          onAddFromResult={onAddFromResult}
          onAddManual={onAddManual}
          onUpdateFoodQuantity={onUpdateFoodQuantity}
          onUpdateFoodUnit={onUpdateFoodUnit}
          onRemoveFood={onRemoveFood}
        />
      )}
    </div>
  )
}

function OptionContent({
  option,
  search,
  onSearchChange,
  onAddFromResult,
  onAddManual,
  onUpdateFoodQuantity,
  onUpdateFoodUnit,
  onRemoveFood,
}: {
  option: OptionEntry
  search: SearchState | undefined
  onSearchChange: (patch: Partial<SearchState>) => void
  onAddFromResult: (r: FoodSearchResult) => void
  onAddManual: (p: {
    foodName: string
    caloriesPer100g: number
    proteinPer100g: number
    carbsPer100g: number
    fatPer100g: number
    quantity: number
  }) => void
  onUpdateFoodQuantity: (foodId: string, q: number) => void
  onUpdateFoodUnit: (foodId: string, u: string) => void
  onRemoveFood: (foodId: string) => void
}) {
  const totals = useMemo(() => optionTotals(option), [option])

  const query = search?.query ?? ''
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query.trim().length < 2) {
      onSearchChange({ results: [], loading: false })
      return
    }
    onSearchChange({ loading: true, open: true })
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchFoods(query)
        onSearchChange({ results, loading: false, open: true })
      } catch {
        onSearchChange({ results: [], loading: false })
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <div>
      {/* Macro totals bar */}
      <div
        className="flex items-center gap-4 px-3 py-2 mb-3 text-xs"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <Stat label="kcal" value={totals.calories} color="var(--color-text-primary)" />
        <Stat label="P" value={totals.proteinG} suffix="g" color={COLOR_PROTEIN} />
        <Stat label="C" value={totals.carbsG} suffix="g" color={COLOR_CARBS} />
        <Stat label="F" value={totals.fatG} suffix="g" color={COLOR_FAT} />
      </div>

      {/* Food rows */}
      <div className="flex flex-col gap-2 mb-3">
        {option.foods.map((f) => (
          <div
            key={f.tempId}
            className="flex items-center gap-2 px-3 py-2 flex-wrap"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <span
              className="text-sm font-medium flex-1 min-w-0"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {f.foodName}
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={f.quantity}
              onChange={(e) => onUpdateFoodQuantity(f.tempId, parseFloat(e.target.value))}
              className="px-2 py-1 text-sm"
              style={{
                width: 70,
                backgroundColor: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            />
            <select
              value={f.unit}
              onChange={(e) => onUpdateFoodUnit(f.tempId, e.target.value)}
              className="px-1.5 py-1 text-xs"
              style={{
                backgroundColor: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <MacroPill label="kcal" value={f.calories} color="var(--color-text-primary)" />
            <MacroPill label="P" value={f.proteinG} suffix="g" color={COLOR_PROTEIN} />
            <MacroPill label="C" value={f.carbsG} suffix="g" color={COLOR_CARBS} />
            <MacroPill label="F" value={f.fatG} suffix="g" color={COLOR_FAT} />
            <button
              type="button"
              onClick={() => onRemoveFood(f.tempId)}
              title="Remove"
              className="inline-flex items-center justify-center"
              style={{
                width: 26,
                height: 26,
                color: '#ef4444',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {option.foods.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--color-text-hint)' }}>
            No foods yet. Search below to add.
          </p>
        )}
      </div>

      {/* Search */}
      <FoodSearchBox
        search={search}
        onChange={onSearchChange}
        onAddFromResult={onAddFromResult}
        onAddManual={onAddManual}
      />
    </div>
  )
}

function FoodSearchBox({
  search,
  onChange,
  onAddFromResult,
  onAddManual,
}: {
  search: SearchState | undefined
  onChange: (patch: Partial<SearchState>) => void
  onAddFromResult: (r: FoodSearchResult) => void
  onAddManual: (p: {
    foodName: string
    caloriesPer100g: number
    proteinPer100g: number
    carbsPer100g: number
    fatPer100g: number
    quantity: number
  }) => void
}) {
  const s = search ?? { query: '', results: [], loading: false, open: false, manualOpen: false }

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <Search size={14} style={{ color: 'var(--color-text-hint)' }} />
        <input
          type="text"
          value={s.query}
          onChange={(e) => onChange({ query: e.target.value, open: true })}
          onFocus={() => onChange({ open: true })}
          placeholder="Search food..."
          className="flex-1 text-sm"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text-primary)',
          }}
        />
        {s.loading && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-text-hint)' }} />}
      </div>

      {s.open && (
        <div
          className="mt-1 overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {s.results.length > 0 && (
            <div className="flex flex-col">
              {s.results.map((r, i) => (
                <button
                  key={(r.externalId ?? r.name) + i}
                  type="button"
                  onClick={() => onAddFromResult(r)}
                  className="text-left px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <div className="flex items-baseline gap-2">
                    <span style={{ fontWeight: 500 }}>{r.name}</span>
                    {r.brand && (
                      <span className="text-xs" style={{ color: 'var(--color-text-hint)' }}>
                        {r.brand}
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {Math.round(r.caloriesPer100g)} kcal · P {Math.round(r.proteinPer100g)}g · C{' '}
                    {Math.round(r.carbsPer100g)}g · F {Math.round(r.fatPer100g)}g · per 100g
                  </div>
                </button>
              ))}
            </div>
          )}
          {!s.loading && s.query.trim().length >= 2 && s.results.length === 0 && (
            <p className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-hint)' }}>
              No results
            </p>
          )}
          <button
            type="button"
            onClick={() => onChange({ manualOpen: !s.manualOpen })}
            className="w-full text-left px-3 py-2 text-xs"
            style={{
              backgroundColor: 'var(--color-surface-3)',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
            }}
          >
            + Add manually
          </button>
          {s.manualOpen && (
            <ManualEntry onAdd={onAddManual} onClose={() => onChange({ manualOpen: false })} />
          )}
        </div>
      )}
    </div>
  )
}

function ManualEntry({
  onAdd,
  onClose,
}: {
  onAdd: (p: {
    foodName: string
    caloriesPer100g: number
    proteinPer100g: number
    carbsPer100g: number
    fatPer100g: number
    quantity: number
  }) => void
  onClose: () => void
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
      caloriesPer100g: parseFloat(cal) || 0,
      proteinPer100g: parseFloat(p) || 0,
      carbsPer100g: parseFloat(c) || 0,
      fatPer100g: parseFloat(f) || 0,
      quantity: parseFloat(q) || 100,
    })
    setName('')
    setCal('')
    setP('')
    setC('')
    setF('')
    setQ('100')
    onClose()
  }

  return (
    <div className="px-3 py-3" style={{ backgroundColor: 'var(--color-surface-1)' }}>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Field label="Food name" colSpan={2}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1 text-sm"
            style={fieldStyle()}
          />
        </Field>
        <Field label="kcal / 100g">
          <input type="number" value={cal} onChange={(e) => setCal(e.target.value)} className="w-full px-2 py-1 text-sm" style={fieldStyle()} />
        </Field>
        <Field label="Protein / 100g">
          <input type="number" value={p} onChange={(e) => setP(e.target.value)} className="w-full px-2 py-1 text-sm" style={fieldStyle()} />
        </Field>
        <Field label="Carbs / 100g">
          <input type="number" value={c} onChange={(e) => setC(e.target.value)} className="w-full px-2 py-1 text-sm" style={fieldStyle()} />
        </Field>
        <Field label="Fat / 100g">
          <input type="number" value={f} onChange={(e) => setF(e.target.value)} className="w-full px-2 py-1 text-sm" style={fieldStyle()} />
        </Field>
        <Field label="Quantity (g)" colSpan={2}>
          <input type="number" value={q} onChange={(e) => setQ(e.target.value)} className="w-full px-2 py-1 text-sm" style={fieldStyle()} />
        </Field>
      </div>
      <button
        type="button"
        onClick={handle}
        className="px-3 py-1.5 text-xs font-medium"
        style={{
          backgroundColor: 'var(--color-accent)',
          color: '#fff',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Add food
      </button>
    </div>
  )
}

function fieldStyle(): React.CSSProperties {
  return {
    backgroundColor: 'var(--color-surface-3)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text-primary)',
  }
}

function Field({
  label,
  children,
  colSpan,
}: {
  label: string
  children: React.ReactNode
  colSpan?: number
}) {
  return (
    <div style={{ gridColumn: colSpan ? `span ${colSpan} / span ${colSpan}` : undefined }}>
      <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Stat({
  label,
  value,
  suffix,
  color,
}: {
  label: string
  value: number
  suffix?: string
  color: string
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span style={{ color, fontWeight: 600 }}>
        {Math.round(value * 10) / 10}
        {suffix ?? ''}
      </span>
      <span style={{ color: 'var(--color-text-hint)', fontSize: 11 }}>{label}</span>
    </span>
  )
}

function MacroPill({
  label,
  value,
  suffix,
  color,
}: {
  label: string
  value: number
  suffix?: string
  color: string
}) {
  return (
    <span
      className="inline-flex items-baseline gap-1 px-1.5 py-0.5 text-xs"
      style={{
        backgroundColor: 'var(--color-surface-3)',
        borderRadius: 'var(--radius-sm)',
        color,
        fontWeight: 600,
      }}
    >
      {Math.round(value * 10) / 10}
      {suffix ?? ''}
      <span style={{ color: 'var(--color-text-hint)', fontWeight: 400 }}>{label}</span>
    </span>
  )
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center"
      style={{
        width: 28,
        height: 28,
        color: danger ? '#ef4444' : 'var(--color-text-muted)',
        backgroundColor: 'transparent',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}
