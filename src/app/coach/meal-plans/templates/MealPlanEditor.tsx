'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronUp, ChevronDown, Trash2, Plus, Search, Loader2, Sparkles, X } from 'lucide-react'
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
  g: 1, ml: 1, kg: 1000, L: 1000, oz: 28.35, tbsp: 15, tsp: 5, cup: 240, piece: 50, serving: 100,
}

const COLOR_PROTEIN = '#22c55e'
const COLOR_CARBS = '#60a5fa'
const COLOR_FAT = '#f59e0b'

// Grid template shared between header and rows
const FOOD_COLS = '1fr 150px 64px 72px 72px 72px 36px'

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

type AiFood = { food_name: string; quantity: number; unit: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }
type AiOption = { label: string; sort_order: number; foods: AiFood[] }
type AiMeal = { name: string; sort_order: number; options: AiOption[] }
type AiPlan = { name: string; plan_type: 'training' | 'rest' | 'overall'; notes?: string; recommendations?: string; meals: AiMeal[] }

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
          tempId: newId(), foodId: null, foodName: f.food_name,
          quantity: f.quantity, unit: f.unit,
          caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g,
          calories: f.calories, proteinG: f.protein_g, carbsG: f.carbs_g, fatG: f.fat_g,
          sortOrder: fi,
        }
      }),
    }))
    if (options.length === 0) options.push(emptyOption('A', 0))
    return { tempId: newId(), name: m.name, sortOrder: m.sort_order, options, activeOptionTempId: options[0].tempId }
  })
  const planType: PlanType = plan.plan_type === 'rest' ? 'rest' : plan.plan_type === 'overall' ? 'overall' : 'training'
  return { meals, name: plan.name ?? '', planType, notes: plan.notes ?? '', recommendations: plan.recommendations ?? '' }
}

function computeMacros(food: FoodEntry, quantity: number, unit?: string): FoodEntry {
  const effectiveUnit = unit ?? food.unit
  const grams = quantity * (GRAM_EQUIVALENT[effectiveUnit] ?? 1)
  return {
    ...food, quantity, unit: effectiveUnit,
    calories: round1((food.caloriesPer100g * grams) / 100),
    proteinG: round1((food.proteinPer100g * grams) / 100),
    carbsG:   round1((food.carbsPer100g * grams) / 100),
    fatG:     round1((food.fatPer100g * grams) / 100),
  }
}

function round1(n: number) { return Math.round(n * 10) / 10 }

function optionTotals(option: OptionEntry) {
  return option.foods.reduce(
    (acc, f) => ({ calories: round1(acc.calories + f.calories), proteinG: round1(acc.proteinG + f.proteinG), carbsG: round1(acc.carbsG + f.carbsG), fatG: round1(acc.fatG + f.fatG) }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  )
}

function emptyOption(label: string, sortOrder: number): OptionEntry {
  return { tempId: newId(), label, sortOrder, foods: [] }
}

function emptyMeal(sortOrder: number): MealEntry {
  const opt = emptyOption('A', 0)
  return { tempId: newId(), name: 'Breakfast', sortOrder, options: [opt], activeOptionTempId: opt.tempId }
}

function serializePlan(meals: MealEntry[], name: string, planType: PlanType, notes: string, recommendations: string) {
  return {
    name, plan_type: planType, notes, recommendations,
    meals: meals.map((m) => ({
      name: m.name, sort_order: m.sortOrder,
      options: m.options.map((o) => ({
        label: o.label, sort_order: o.sortOrder,
        foods: o.foods.map((f) => ({ food_name: f.foodName, quantity: f.quantity, unit: f.unit, calories: f.calories, protein_g: f.proteinG, carbs_g: f.carbsG, fat_g: f.fatG })),
      })),
    })),
  }
}

function serializeInitialMealPlan(initial: FullTemplate): string {
  return JSON.stringify({
    name: initial.name,
    plan_type: initial.planType,
    notes: initial.notes ?? '',
    recommendations: initial.recommendations ?? '',
    meals: initial.meals.map((m) => ({
      name: m.name, sort_order: m.sortOrder,
      options: m.options.map((o) => ({
        label: o.label, sort_order: o.sortOrder,
        foods: o.foods.map((f) => ({ food_name: f.foodName, quantity: f.quantity, unit: f.unit, calories: f.calories, protein_g: f.proteinG, carbs_g: f.carbsG, fat_g: f.fatG })),
      })),
    })),
  })
}

function fromInitial(initial: FullTemplate): MealEntry[] {
  return initial.meals.map((m) => {
    const options: OptionEntry[] = m.options.map((o) => ({
      tempId: newId(), label: o.label, sortOrder: o.sortOrder,
      foods: o.foods.map((f) => {
        const cal100 = f.quantity > 0 ? (f.calories / f.quantity) * 100 : 0
        const p100   = f.quantity > 0 ? (f.proteinG / f.quantity) * 100 : 0
        const c100   = f.quantity > 0 ? (f.carbsG / f.quantity) * 100 : 0
        const ft100  = f.quantity > 0 ? (f.fatG / f.quantity) * 100 : 0
        return {
          tempId: newId(), foodId: f.foodId, foodName: f.foodName,
          quantity: f.quantity, unit: f.unit,
          caloriesPer100g: round1(cal100), proteinPer100g: round1(p100), carbsPer100g: round1(c100), fatPer100g: round1(ft100),
          calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, sortOrder: f.sortOrder,
        }
      }),
    }))
    if (options.length === 0) options.push(emptyOption('A', 0))
    return { tempId: newId(), name: m.name, sortOrder: m.sortOrder, options, activeOptionTempId: options[0].tempId }
  })
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MealPlanEditor({ workspaceId, initialData }: { workspaceId: string; initialData?: FullTemplate }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(initialData?.name ?? '')
  const [planType, setPlanType] = useState<PlanType>(initialData?.planType ?? 'training')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [recommendations, setRecommendations] = useState(initialData?.recommendations ?? '')
  const [meals, setMeals] = useState<MealEntry[]>(initialData ? fromInitial(initialData) : [emptyMeal(0)])

  const savedStateRef = useRef<string | null>(initialData ? serializeInitialMealPlan(initialData) : null)
  const isDirty = useMemo(
    () => savedStateRef.current === null || JSON.stringify(serializePlan(meals, name, planType, notes, recommendations)) !== savedStateRef.current,
    [meals, name, planType, notes, recommendations],
  )
  const [searches, setSearches] = useState<Record<string, SearchState>>({})

  const planTotals = useMemo(() => {
    return meals.reduce(
      (acc, meal) => {
        const activeOption = meal.options.find((o) => o.tempId === meal.activeOptionTempId) ?? meal.options[0]
        if (!activeOption) return acc
        const t = optionTotals(activeOption)
        return { calories: round1(acc.calories + t.calories), proteinG: round1(acc.proteinG + t.proteinG), carbsG: round1(acc.carbsG + t.carbsG), fatG: round1(acc.fatG + t.fatG) }
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    )
  }, [meals])

  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGenerated, setAiGenerated] = useState(!!initialData)
  const [aiEditModalOpen, setAiEditModalOpen] = useState(false)

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiGenerating) return
    setAiGenerating(true)
    setAiError(null)
    try {
      const res = await fetch('/api/meal-plan/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiPrompt.trim(), ...(aiGenerated ? { current_plan: serializePlan(meals, name, planType, notes, recommendations) } : {}) }),
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
      setAiPrompt('')
      setAiEditModalOpen(false)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setAiGenerating(false)
    }
  }

  const updateSearch = (optionTempId: string, patch: Partial<SearchState>) => {
    setSearches((prev) => {
      const existing = prev[optionTempId] ?? { query: '', results: [], loading: false, open: false, manualOpen: false }
      return { ...prev, [optionTempId]: { ...existing, ...patch } }
    })
  }

  const updateMeal = (mealTempId: string, fn: (m: MealEntry) => MealEntry) => {
    setMeals((prev) => prev.map((m) => (m.tempId === mealTempId ? fn(m) : m)))
  }

  const updateOption = (mealTempId: string, optionTempId: string, fn: (o: OptionEntry) => OptionEntry) => {
    updateMeal(mealTempId, (m) => ({ ...m, options: m.options.map((o) => (o.tempId === optionTempId ? fn(o) : o)) }))
  }

  const addMeal = () => setMeals((prev) => [...prev, emptyMeal(prev.length)])

  const removeMeal = (mealTempId: string) => {
    setMeals((prev) => prev.filter((m) => m.tempId !== mealTempId).map((m, i) => ({ ...m, sortOrder: i })))
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
      const remaining = m.options.filter((o) => o.tempId !== optionTempId).map((o, i) => ({ ...o, sortOrder: i }))
      return { ...m, options: remaining, activeOptionTempId: m.activeOptionTempId === optionTempId ? remaining[0].tempId : m.activeOptionTempId }
    })
  }

  const addFoodFromResult = async (mealTempId: string, optionTempId: string, result: FoodSearchResult) => {
    let foodId: string | null = null
    if (result.source === 'usda') {
      try { foodId = await upsertFood(result) } catch { foodId = null }
    }
    const food: FoodEntry = computeMacros({
      tempId: newId(), foodId,
      foodName: result.brand ? `${result.name} (${result.brand})` : result.name,
      quantity: 100, unit: 'g',
      caloriesPer100g: result.caloriesPer100g, proteinPer100g: result.proteinPer100g,
      carbsPer100g: result.carbsPer100g, fatPer100g: result.fatPer100g,
      calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sortOrder: 0,
    }, 100)
    updateOption(mealTempId, optionTempId, (o) => ({ ...o, foods: [...o.foods, { ...food, sortOrder: o.foods.length }] }))
    updateSearch(optionTempId, { query: '', results: [], open: false, manualOpen: false })
  }

  const addManualFood = async (mealTempId: string, optionTempId: string, payload: { foodName: string; caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; quantity: number; unit: string }) => {
    let foodId: string | null = null
    try {
      foodId = await upsertFood({
        externalId: null,
        name: payload.foodName,
        brand: null,
        caloriesPer100g: payload.caloriesPer100g,
        proteinPer100g: payload.proteinPer100g,
        carbsPer100g: payload.carbsPer100g,
        fatPer100g: payload.fatPer100g,
        source: 'custom',
      })
    } catch { foodId = null }
    const food: FoodEntry = computeMacros({
      tempId: newId(), foodId, foodName: payload.foodName,
      quantity: payload.quantity, unit: payload.unit,
      caloriesPer100g: payload.caloriesPer100g, proteinPer100g: payload.proteinPer100g,
      carbsPer100g: payload.carbsPer100g, fatPer100g: payload.fatPer100g,
      calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sortOrder: 0,
    }, payload.quantity)
    updateOption(mealTempId, optionTempId, (o) => ({ ...o, foods: [...o.foods, { ...food, sortOrder: o.foods.length }] }))
    updateSearch(optionTempId, { query: '', results: [], open: false, manualOpen: false })
  }

  const updateFoodQuantity = (mealTempId: string, optionTempId: string, foodTempId: string, quantity: number) => {
    updateOption(mealTempId, optionTempId, (o) => ({
      ...o,
      foods: o.foods.map((f) => f.tempId === foodTempId ? computeMacros(f, isFinite(quantity) ? quantity : 0) : f),
    }))
  }

  const updateFoodUnit = (mealTempId: string, optionTempId: string, foodTempId: string, unit: string) => {
    updateOption(mealTempId, optionTempId, (o) => ({
      ...o,
      foods: o.foods.map((f) => f.tempId === foodTempId ? computeMacros(f, f.quantity, unit) : f),
    }))
  }

  const removeFood = (mealTempId: string, optionTempId: string, foodTempId: string) => {
    updateOption(mealTempId, optionTempId, (o) => ({
      ...o,
      foods: o.foods.filter((f) => f.tempId !== foodTempId).map((f, i) => ({ ...f, sortOrder: i })),
    }))
  }

  const handleSave = async () => {
    setError(null)
    if (!name.trim()) { setError('Template name is required'); return }
    if (meals.length === 0) { setError('Add at least one meal'); return }
    const valid = meals.every((m) => m.options.length > 0 && m.options.every((o) => o.foods.length > 0))
    if (!valid) { setError('Every meal needs at least one option, and every option needs at least one food'); return }

    setSaving(true)
    try {
      await upsertMealPlanTemplate({
        id: initialData?.id, workspaceId, name: name.trim(), planType, notes, recommendations,
        meals: meals.map((m, mi) => ({
          name: m.name, sortOrder: mi,
          options: m.options.map((o, oi) => ({
            label: o.label, sortOrder: oi,
            foods: o.foods.map((f, fi) => ({ foodId: f.foodId, foodName: f.foodName, quantity: f.quantity, unit: f.unit, calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, sortOrder: fi })),
          })),
        })),
      })
      setSaving(false)
      savedStateRef.current = JSON.stringify(serializePlan(meals, name, planType, notes, recommendations))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 920, padding: '0 24px 48px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 28, paddingBottom: 20, borderBottom: '1px solid #1e1e1e', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Link
              href="/coach/meal-plans"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#555', textDecoration: 'none', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}
            >
              <ArrowLeft size={11} />
              Meal Plans
            </Link>
            {name && (
              <>
                <span style={{ color: '#2e2e2e', fontSize: 11 }}>›</span>
                <span style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{name}</span>
              </>
            )}
          </div>
          <h1 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: 0, lineHeight: 1.2 }}>
            {name || (initialData ? 'Edit meal plan' : 'New Meal Plan')}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexShrink: 0 }}>
          <Link
            href="/coach/meal-plans"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid #2a2a2a', color: '#888', textDecoration: 'none' }}
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, backgroundColor: '#f97316', color: '#fff', border: 'none', cursor: saving || !isDirty ? 'not-allowed' : 'pointer', opacity: saving || !isDirty ? 0.5 : 1, transition: 'opacity 0.15s' }}
          >
            {saving ? 'Saving…' : 'Save template'}
          </button>
        </div>
      </div>

      {/* ── AI Panel ── */}
      {!aiGenerated ? (
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Sparkles size={14} style={{ color: '#f97316', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: '0.02em' }}>AI Assist</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiGenerate() } }}
              placeholder="Describe a plan (e.g. Mediterranean 2000 kcal, 35/35/30) — or paste a meal plan from the assistant"
              disabled={aiGenerating}
              rows={3}
              style={{ flex: 1, padding: '8px 12px', fontSize: 13, background: '#1a1a1a', border: '1px solid #272727', borderRadius: 8, color: '#fff', outline: 'none', opacity: aiGenerating ? 0.6 : 1, resize: 'none', lineHeight: 1.5, fontFamily: 'inherit' }}
            />
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiGenerating || !aiPrompt.trim()}
              onMouseEnter={(e) => { if (!aiGenerating && aiPrompt.trim()) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ea6c0a' }}
              onMouseLeave={(e) => { if (!aiGenerating && aiPrompt.trim()) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f97316' }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, backgroundColor: aiGenerating || !aiPrompt.trim() ? '#1e1e1e' : '#f97316', color: aiGenerating || !aiPrompt.trim() ? '#555' : '#fff', border: 'none', cursor: aiGenerating || !aiPrompt.trim() ? 'not-allowed' : 'pointer', flexShrink: 0, alignSelf: 'stretch', transition: 'background-color 0.15s ease' }}
            >
              {aiGenerating ? <><Loader2 size={13} className="animate-spin" /> Generating…</> : <><Sparkles size={13} /> Generate</>}
            </button>
          </div>
          {aiError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8, marginBottom: 0 }}>{aiError}</p>}
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => { setAiError(null); setAiEditModalOpen(true) }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f97316'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#f97316'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#111'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a'; (e.currentTarget as HTMLButtonElement).style.color = '#ccc' }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, backgroundColor: '#111', color: '#ccc', border: '1px solid #2a2a2a', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease' }}
          >
            <Sparkles size={13} style={{ color: '#f97316' }} />
            Edit with AI
          </button>
        </div>
      )}

      {/* Edit with AI modal */}
      {aiEditModalOpen && (
        <div
          onClick={() => setAiEditModalOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 480, background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, padding: 24 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Sparkles size={15} style={{ color: '#f97316' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Edit with AI</span>
              </div>
              <button type="button" onClick={() => setAiEditModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4, fontSize: 16, lineHeight: 1 }}>✕</button>
            </div>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiGenerate() } }}
              placeholder="e.g. swap breakfast to eggs and avocado, increase lunch protein…"
              disabled={aiGenerating}
              rows={4}
              autoFocus
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: '#1a1a1a', border: '1px solid #272727', borderRadius: 8, color: '#fff', outline: 'none', opacity: aiGenerating ? 0.6 : 1, resize: 'none', lineHeight: 1.5, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }}
            />
            {aiError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{aiError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setAiEditModalOpen(false)}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, background: '#1a1a1a', color: '#888', border: '1px solid #2a2a2a', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={aiGenerating || !aiPrompt.trim()}
                onMouseEnter={(e) => { if (!aiGenerating && aiPrompt.trim()) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ea6c0a' }}
                onMouseLeave={(e) => { if (!aiGenerating && aiPrompt.trim()) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f97316' }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, backgroundColor: aiGenerating || !aiPrompt.trim() ? '#1e1e1e' : '#f97316', color: aiGenerating || !aiPrompt.trim() ? '#555' : '#fff', border: 'none', borderRadius: 8, cursor: aiGenerating || !aiPrompt.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background-color 0.15s ease' }}
              >
                {aiGenerating ? <><Loader2 size={13} className="animate-spin" /> Applying…</> : <><Sparkles size={13} /> Apply Edit</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Template name + Plan type ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end', marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#555', marginBottom: 6, fontWeight: 600 }}>
            Template name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cutting — Training Day"
            style={{ width: '100%', padding: '9px 12px', fontSize: 14, background: '#111', border: '1px solid #222', borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#555', marginBottom: 6, fontWeight: 600 }}>
            Plan type
          </label>
          <PlanTypeToggle value={planType} onChange={setPlanType} />
        </div>
      </div>

      {/* ── Macro stat cards ── */}
      {meals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
          <MacroStatCard label="CALORIES" value={planTotals.calories} unit="kcal" color="#fff" dot="#fff" />
          <MacroStatCard label="PROTEIN" value={planTotals.proteinG} unit="g" color={COLOR_PROTEIN} dot={COLOR_PROTEIN} />
          <MacroStatCard label="CARBS" value={planTotals.carbsG} unit="g" color={COLOR_CARBS} dot={COLOR_CARBS} />
          <MacroStatCard label="FAT" value={planTotals.fatG} unit="g" color={COLOR_FAT} dot={COLOR_FAT} />
        </div>
      )}

      {/* ── Meals header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Meals</h2>
        <button
          type="button"
          onClick={addMeal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, backgroundColor: '#f97316', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          <Plus size={14} />
          Add Meal
        </button>
      </div>

      {/* ── Meal cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
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
            onSelectOption={(optId) => updateMeal(meal.tempId, (m) => ({ ...m, activeOptionTempId: optId }))}
            onRemoveOption={(optId) => removeOption(meal.tempId, optId)}
            search={searches[meal.activeOptionTempId]}
            onSearchChange={(patch) => updateSearch(meal.activeOptionTempId, patch)}
            onAddFromResult={(r) => addFoodFromResult(meal.tempId, meal.activeOptionTempId, r)}
            onAddManual={(p) => addManualFood(meal.tempId, meal.activeOptionTempId, p)}
            onUpdateFoodQuantity={(foodId, q) => updateFoodQuantity(meal.tempId, meal.activeOptionTempId, foodId, q)}
            onUpdateFoodUnit={(foodId, u) => updateFoodUnit(meal.tempId, meal.activeOptionTempId, foodId, u)}
            onRemoveFood={(foodId) => removeFood(meal.tempId, meal.activeOptionTempId, foodId)}
          />
        ))}
      </div>

      {/* ── Notes & Recommendations ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#555', marginBottom: 6, fontWeight: 600 }}>
            Notes for client
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, background: '#111', border: '1px solid #222', borderRadius: 8, color: '#fff', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#555', marginBottom: 6, fontWeight: 600 }}>
            Recommendations
          </label>
          <textarea
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            rows={4}
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, background: '#111', border: '1px solid #222', borderRadius: 8, color: '#fff', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      </div>

      {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 14 }}>{error}</p>}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MacroStatCard({ label, value, unit, color, dot }: { label: string; value: number; unit: string; color: string; dot: string }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', color: '#555', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>
        {Math.round(value * 10) / 10}
        <span style={{ fontSize: 13, fontWeight: 400, color: '#444', marginLeft: 5 }}>{unit}</span>
      </div>
    </div>
  )
}

function PlanTypeToggle({ value, onChange }: { value: PlanType; onChange: (v: PlanType) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: '#0d0d0d', border: '1px solid #222', borderRadius: 9, padding: 3 }}>
      {(['training', 'rest', 'overall'] as const).map((t) => {
        const active = value === t
        const label = t === 'training' ? 'Training Day' : t === 'rest' ? 'Rest Day' : 'Overall'
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            style={{ padding: '6px 14px', fontSize: 13, fontWeight: 500, borderRadius: 7, border: 'none', cursor: 'pointer', background: active ? '#1e1e1e' : 'transparent', color: active ? '#fff' : '#555', transition: 'background 0.12s, color 0.12s', whiteSpace: 'nowrap' }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function MealCard({
  meal, index, total,
  onChangeName, onMove, onRemove, onAddOption, onSelectOption, onRemoveOption,
  search, onSearchChange, onAddFromResult, onAddManual,
  onUpdateFoodQuantity, onUpdateFoodUnit, onRemoveFood,
}: {
  meal: MealEntry; index: number; total: number
  onChangeName: (n: string) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void
  onAddOption: () => void; onSelectOption: (id: string) => void; onRemoveOption: (id: string) => void
  search: SearchState | undefined; onSearchChange: (patch: Partial<SearchState>) => void
  onAddFromResult: (r: FoodSearchResult) => void
  onAddManual: (p: { foodName: string; caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; quantity: number; unit: string }) => void
  onUpdateFoodQuantity: (foodId: string, q: number) => void; onUpdateFoodUnit: (foodId: string, u: string) => void; onRemoveFood: (foodId: string) => void
}) {
  const isPreset = MEAL_PRESETS.includes(meal.name)
  const activeOption = meal.options.find((o) => o.tempId === meal.activeOptionTempId) ?? meal.options[0]
  const totals = activeOption ? optionTotals(activeOption) : { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }

  const iconBtn = (disabled?: boolean): React.CSSProperties => ({
    width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: '1px solid #222', borderRadius: 6,
    color: disabled ? '#2e2e2e' : '#666', cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>

      {/* Meal header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <select
            value={isPreset ? meal.name : 'Other'}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'Other') onChangeName(meal.name && !MEAL_PRESETS.includes(meal.name) ? meal.name : '')
              else onChangeName(v)
            }}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', outline: 'none', padding: 0 }}
          >
            {MEAL_PRESETS.map((p) => <option key={p} value={p} style={{ background: '#111' }}>{p}</option>)}
          </select>
          {!isPreset && (
            <input
              type="text"
              value={meal.name}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="Custom meal name"
              style={{ background: '#1a1a1a', border: '1px solid #272727', borderRadius: 6, color: '#fff', fontSize: 13, padding: '4px 8px', outline: 'none', minWidth: 140 }}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
              {Math.round(totals.calories)} <span style={{ fontSize: 10, fontWeight: 500, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>kcal</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLOR_PROTEIN }}>P {Math.round(totals.proteinG)}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLOR_CARBS }}>C {Math.round(totals.carbsG)}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLOR_FAT }}>F {Math.round(totals.fatG)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button type="button" title="Move up" disabled={index === 0} onClick={() => onMove(-1)} style={iconBtn(index === 0)}><ChevronUp size={13} /></button>
          <button type="button" title="Move down" disabled={index === total - 1} onClick={() => onMove(1)} style={iconBtn(index === total - 1)}><ChevronDown size={13} /></button>
          {meal.options.length < 3 && (
            <button
              type="button"
              onClick={onAddOption}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 10px', height: 28, fontSize: 12, fontWeight: 500, background: 'transparent', border: '1px solid #222', borderRadius: 6, color: '#888', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <Plus size={12} /> Option
            </button>
          )}
          <button type="button" title="Delete meal" onClick={onRemove} style={{ ...iconBtn(), color: '#ef4444', border: '1px solid #222' }}><Trash2 size={13} /></button>
        </div>
      </div>

      {/* Option tabs */}
      {meal.options.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}>
          {meal.options.map((o) => {
            const active = o.tempId === meal.activeOptionTempId
            return (
              <div key={o.tempId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => onSelectOption(o.tempId)}
                  style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: active ? '1px solid rgba(249,115,22,0.4)' : '1px solid #222', background: active ? 'rgba(249,115,22,0.08)' : 'transparent', color: active ? '#f97316' : '#555', cursor: 'pointer' }}
                >
                  Option {o.label}
                </button>
                {active && meal.options.length > 1 && (
                  <button type="button" onClick={() => onRemoveOption(o.tempId)} title="Remove option" style={{ width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}>
                    <X size={11} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Food table */}
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
  option, search, onSearchChange, onAddFromResult, onAddManual,
  onUpdateFoodQuantity, onUpdateFoodUnit, onRemoveFood,
}: {
  option: OptionEntry
  search: SearchState | undefined
  onSearchChange: (patch: Partial<SearchState>) => void
  onAddFromResult: (r: FoodSearchResult) => void
  onAddManual: (p: { foodName: string; caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; quantity: number; unit: string }) => void
  onUpdateFoodQuantity: (foodId: string, q: number) => void
  onUpdateFoodUnit: (foodId: string, u: string) => void
  onRemoveFood: (foodId: string) => void
}) {
  const query = search?.query ?? ''
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query.trim().length < 2) { onSearchChange({ results: [], loading: false }); return }
    onSearchChange({ loading: true, open: true })
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchFoods(query)
        onSearchChange({ results, loading: false, open: true })
      } catch {
        onSearchChange({ results: [], loading: false })
      }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const colHdr: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#444', textTransform: 'uppercase' }

  return (
    <div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: FOOD_COLS, padding: '7px 18px', background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', gap: 4 }}>
        <span style={colHdr}>Food</span>
        <span style={colHdr}>Quantity</span>
        <span style={{ ...colHdr, textAlign: 'center' }}>Cal</span>
        <span style={{ ...colHdr, color: COLOR_PROTEIN, textAlign: 'center' }}>Protein</span>
        <span style={{ ...colHdr, color: COLOR_CARBS, textAlign: 'center' }}>Carbs</span>
        <span style={{ ...colHdr, color: COLOR_FAT, textAlign: 'center' }}>Fat</span>
        <span />
      </div>

      {/* Food rows */}
      {option.foods.map((f) => (
        <div
          key={f.tempId}
          style={{ display: 'grid', gridTemplateColumns: FOOD_COLS, padding: '9px 18px', borderBottom: '1px solid #161616', alignItems: 'center', gap: 4 }}
        >
          <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.foodName}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number"
              min={0}
              step="any"
              value={f.quantity}
              onChange={(e) => onUpdateFoodQuantity(f.tempId, parseFloat(e.target.value))}
              style={{ width: 60, padding: '4px 6px', fontSize: 13, background: '#1a1a1a', border: '1px solid #222', borderRadius: 6, color: '#fff', outline: 'none' }}
            />
            <select
              value={f.unit}
              onChange={(e) => onUpdateFoodUnit(f.tempId, e.target.value)}
              style={{ padding: '4px 3px', fontSize: 11, background: '#1a1a1a', border: '1px solid #222', borderRadius: 6, color: '#888', outline: 'none' }}
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <span style={{ fontSize: 13, color: '#aaa', textAlign: 'center' }}>{Math.round(f.calories)}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLOR_PROTEIN, textAlign: 'center' }}>{round1(f.proteinG)}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLOR_CARBS, textAlign: 'center' }}>{round1(f.carbsG)}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLOR_FAT, textAlign: 'center' }}>{round1(f.fatG)}</span>
          <button
            type="button"
            onClick={() => onRemoveFood(f.tempId)}
            style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#3a3a3a', cursor: 'pointer', borderRadius: 4, marginLeft: 'auto' }}
          >
            <X size={13} />
          </button>
        </div>
      ))}

      {option.foods.length === 0 && (
        <div style={{ padding: '14px 18px', color: '#3a3a3a', fontSize: 13 }}>No foods yet — add below.</div>
      )}

      {/* Food search */}
      <FoodSearchBox search={search} onChange={onSearchChange} onAddFromResult={onAddFromResult} onAddManual={onAddManual} />
    </div>
  )
}

function FoodSearchBox({
  search, onChange, onAddFromResult, onAddManual,
}: {
  search: SearchState | undefined
  onChange: (patch: Partial<SearchState>) => void
  onAddFromResult: (r: FoodSearchResult) => void
  onAddManual: (p: { foodName: string; caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; quantity: number; unit: string }) => void
}) {
  const s = search ?? { query: '', results: [], loading: false, open: false, manualOpen: false }

  if (!s.open && !s.query) {
    return (
      <button
        type="button"
        onClick={() => onChange({ open: true })}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '11px 18px', background: 'transparent', border: 'none', borderTop: '1px dashed #222', color: '#444', fontSize: 13, cursor: 'pointer' }}
      >
        <Plus size={13} style={{ color: '#555' }} />
        Add food
      </button>
    )
  }

  return (
    <div style={{ borderTop: '1px solid #1a1a1a', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}>
        <Search size={13} style={{ color: '#555', flexShrink: 0 }} />
        <input
          type="text"
          autoFocus
          value={s.query}
          onChange={(e) => onChange({ query: e.target.value, open: true })}
          onKeyDown={(e) => { if (e.key === 'Escape') onChange({ open: false, query: '' }) }}
          placeholder="Search food..."
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#e0e0e0' }}
        />
        {s.loading && <Loader2 size={13} className="animate-spin" style={{ color: '#555' }} />}
        <button type="button" onClick={() => onChange({ open: false, query: '' })} style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
          <X size={13} />
        </button>
      </div>

      {(s.results.length > 0 || (s.query.trim().length >= 2 && !s.loading) || s.manualOpen) && (
        <div style={{ borderTop: '1px solid #1a1a1a' }}>
          {s.results.map((r, i) => (
            <button
              key={(r.externalId ?? r.name) + i}
              type="button"
              onClick={() => onAddFromResult(r)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 18px', background: 'transparent', border: 'none', borderBottom: '1px solid #161616', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{r.name}</span>
                {r.brand && <span style={{ fontSize: 11, color: '#555' }}>{r.brand}</span>}
              </div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                {Math.round(r.caloriesPer100g)} kcal · P {Math.round(r.proteinPer100g)}g · C {Math.round(r.carbsPer100g)}g · F {Math.round(r.fatPer100g)}g · per 100g
              </div>
            </button>
          ))}
          {!s.loading && s.query.trim().length >= 2 && s.results.length === 0 && (
            <p style={{ padding: '8px 18px', fontSize: 12, color: '#555', margin: 0 }}>No results found</p>
          )}
          <button
            type="button"
            onClick={() => onChange({ manualOpen: !s.manualOpen })}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 18px', fontSize: 12, color: '#666', background: '#0d0d0d', border: 'none', cursor: 'pointer', borderTop: '1px solid #1a1a1a' }}
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

// Units where the user enters macros per 100 of that unit (g, kg → per 100g; ml, L → per 100ml)
const PER_100_UNITS = new Set(['g', 'kg', 'ml', 'L'])

function macroLabel(unit: string): string {
  if (unit === 'g' || unit === 'kg') return 'per 100g'
  if (unit === 'ml' || unit === 'L') return 'per 100ml'
  return `per ${unit}`
}

// Convert a "per-unit" macro value into the internal per-100g-equivalent
function toPer100g(valuePerUnit: number, unit: string): number {
  if (PER_100_UNITS.has(unit)) return valuePerUnit
  return (valuePerUnit * 100) / (GRAM_EQUIVALENT[unit] ?? 1)
}

function ManualEntry({ onAdd, onClose }: { onAdd: (p: { foodName: string; caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; quantity: number; unit: string }) => void; onClose: () => void }) {
  const [fname, setFname] = useState('')
  const [unit, setUnit] = useState('g')
  const [cal, setCal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  const [q, setQ] = useState('100')

  const per100 = PER_100_UNITS.has(unit)
  const suffix = macroLabel(unit)

  const handleUnitChange = (u: string) => {
    setUnit(u)
    // Reset quantity default: 100 for weight/volume, 1 for discrete units
    setQ(PER_100_UNITS.has(u) ? '100' : '1')
  }

  const handle = () => {
    if (!fname.trim()) return
    const calVal = parseFloat(cal) || 0
    const pVal   = parseFloat(p) || 0
    const cVal   = parseFloat(c) || 0
    const fVal   = parseFloat(f) || 0
    onAdd({
      foodName: fname.trim(),
      caloriesPer100g: per100 ? calVal : toPer100g(calVal, unit),
      proteinPer100g:  per100 ? pVal   : toPer100g(pVal, unit),
      carbsPer100g:    per100 ? cVal   : toPer100g(cVal, unit),
      fatPer100g:      per100 ? fVal   : toPer100g(fVal, unit),
      quantity: parseFloat(q) || 1,
      unit,
    })
    setFname(''); setCal(''); setP(''); setC(''); setF(''); setQ(per100 ? '100' : '1')
    onClose()
  }

  const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: 12, background: '#1a1a1a', border: '1px solid #222', borderRadius: 6, color: '#fff', outline: 'none', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }

  return (
    <div style={{ padding: '14px 18px', background: '#0d0d0d', borderTop: '1px solid #1a1a1a' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={lbl}>Food name</label>
          <input type="text" value={fname} onChange={(e) => setFname(e.target.value)} placeholder="e.g. Large egg white" style={inp} />
        </div>
        <div>
          <label style={lbl}>Unit</label>
          <select value={unit} onChange={(e) => handleUnitChange(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            {UNITS.map((u) => <option key={u} value={u} style={{ background: '#1a1a1a' }}>{u}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Quantity ({unit})</label>
          <input type="number" min={0} step="any" value={q} onChange={(e) => setQ(e.target.value)} style={inp} />
        </div>
        <div><label style={lbl}>kcal {suffix}</label><input type="number" min={0} step="any" value={cal} onChange={(e) => setCal(e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Protein {suffix}</label><input type="number" min={0} step="any" value={p} onChange={(e) => setP(e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Carbs {suffix}</label><input type="number" min={0} step="any" value={c} onChange={(e) => setC(e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Fat {suffix}</label><input type="number" min={0} step="any" value={f} onChange={(e) => setF(e.target.value)} style={inp} /></div>
      </div>
      <button
        type="button"
        onClick={handle}
        style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: '#f97316', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}
      >
        Add food
      </button>
    </div>
  )
}
