'use client'

import { useState, useEffect, FocusEvent, InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TOTAL_STEPS = 6

// ─── Shared styled primitives (mirrors invite/page.tsx) ─────────────────────

const InputField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function InputField({ onBlur, ...props }, ref) {
    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.border = '1px solid var(--color-border)'
      onBlur?.(e)
    }
    return (
      <input
        ref={ref}
        className="w-full px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#6B6B6B]"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-secondary)',
        }}
        onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--color-border-strong)' }}
        onBlur={handleBlur}
        {...props}
      />
    )
  }
)

const TextareaField = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextareaField({ onBlur, ...props }, ref) {
    const handleBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
      e.currentTarget.style.border = '1px solid var(--color-border)'
      onBlur?.(e)
    }
    return (
      <textarea
        ref={ref}
        rows={3}
        className="w-full px-4 py-3 text-sm outline-none transition-colors resize-none placeholder:text-[#6B6B6B]"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-secondary)',
        }}
        onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--color-border-strong)' }}
        onBlur={handleBlur}
        {...props}
      />
    )
  }
)

// ─── Reusable selection primitives ──────────────────────────────────────────

function UnitToggle({
  value,
  onChange,
}: {
  value: 'kg' | 'lbs'
  onChange: (v: 'kg' | 'lbs') => void
}) {
  return (
    <div className="flex gap-2">
      {(['kg', 'lbs'] as const).map((unit) => {
        const active = value === unit
        return (
          <button
            key={unit}
            type="button"
            onClick={() => onChange(unit)}
            className="px-5 py-2 text-sm transition-colors"
            style={{
              backgroundColor: active ? 'var(--color-accent)' : 'var(--color-surface-3)',
              color: active ? '#FFFFFF' : 'var(--color-text-muted)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {unit}
          </button>
        )
      })}
    </div>
  )
}

function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  cols = 2,
}: {
  options: readonly { readonly value: T; readonly label: string }[]
  value: T | ''
  onChange: (v: T) => void
  cols?: 2 | 3 | 4 | 5
}) {
  const colClass = cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : cols === 4 ? 'grid-cols-4' : 'grid-cols-5'
  return (
    <div className={`grid ${colClass} gap-2`}>
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="py-3 px-3 text-sm text-center transition-colors"
            style={{
              backgroundColor: active ? 'var(--color-accent-dim)' : 'var(--color-surface-2)',
              border: active ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: active ? 500 : 400,
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { readonly value: T; readonly label: string }[]
  value: T | ''
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="px-4 py-2 text-sm transition-colors"
            style={{
              backgroundColor: active ? 'var(--color-accent)' : 'var(--color-surface-3)',
              color: active ? '#FFFFFF' : 'var(--color-text-muted)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Field-level label + error wrapper ──────────────────────────────────────

function Field({
  label,
  htmlFor,
  error,
  optional,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm mb-2"
        style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}
      >
        {label}
        {optional && (
          <span className="ml-1" style={{ color: 'var(--color-text-hint)', fontWeight: 400 }}>
            (optional)
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Spinner (same markup as invite page) ────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-6 w-6"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ color: 'var(--color-text-hint)' }}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.961 3 8.12l3-2.829z"
      />
    </svg>
  )
}

// ─── Option data ─────────────────────────────────────────────────────────────

const GOALS = [
  { value: 'lose_fat', label: 'Lose fat' },
  { value: 'build_muscle', label: 'Build muscle' },
  { value: 'recomposition', label: 'Body recomposition' },
  { value: 'performance', label: 'Improve performance' },
] as const

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly active' },
  { value: 'moderately_active', label: 'Moderately active' },
  { value: 'very_active', label: 'Very active' },
] as const

const TRAINING_LOCATIONS = [
  { value: 'gym', label: 'Gym' },
  { value: 'home', label: 'Home' },
  { value: 'both', label: 'Both' },
] as const

const TRAINING_DAYS = [
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
] as const

const TRAINING_TIMES = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'no_preference', label: 'No preference' },
] as const

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEP_META = [
  { title: 'Current weight', subtitle: 'Tell us where you are starting from.' },
  { title: 'Your goal', subtitle: 'What are you training towards?' },
  { title: 'Target weight', subtitle: 'Where do you want to get to?' },
  { title: 'Nutrition', subtitle: 'Tell us about your eating habits.' },
  { title: 'Lifestyle', subtitle: 'Help us understand your routine.' },
  { title: 'Training', subtitle: 'How and where do you train?' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  // ── auth / init state
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [userEmail, setUserEmail] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── wizard state
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── step 1 — current weight
  const [currentWeight, setCurrentWeight] = useState('')
  const [currentWeightUnit, setCurrentWeightUnit] = useState<'kg' | 'lbs'>('kg')

  // ── step 2 — goal
  const [goal, setGoal] = useState('')

  // ── step 3 — desired weight
  const [desiredWeight, setDesiredWeight] = useState('')
  const [desiredWeightUnit, setDesiredWeightUnit] = useState<'kg' | 'lbs'>('kg')

  // ── step 4 — nutrition
  const [mealsPerDay, setMealsPerDay] = useState('')
  const [foodsToAvoid, setFoodsToAvoid] = useState('')

  // ── step 5 — lifestyle
  const [activityLevel, setActivityLevel] = useState('')
  const [occupationNotes, setOccupationNotes] = useState('')
  const [healthNotes, setHealthNotes] = useState('')

  // ── step 6 — training
  const [trainingLocation, setTrainingLocation] = useState('')
  const [trainingDays, setTrainingDays] = useState('')
  const [preferredTime, setPreferredTime] = useState('')

  // ── on mount: verify auth + skip if already onboarded
  useEffect(() => {
    const init = async () => {
      // Dev preview bypass — add ?preview=true to render the form without auth
      // and regardless of onboarding completion state
      if (process.env.NODE_ENV === 'development') {
        const params = new URLSearchParams(window.location.search)
        if (params.get('preview') === 'true') {
          const mockEmail =
            document.cookie
              .split('; ')
              .find((row) => row.startsWith('dev_mock_email='))
              ?.split('=')[1] ?? 'preview@dev.local'
          setUserEmail(decodeURIComponent(mockEmail))
          setStatus('ready')
          return
        }
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: client } = await supabase
        .from('clients')
        .select('onboarding_completed_at')
        .eq('email', user.email!)
        .maybeSingle()

      if (client?.onboarding_completed_at) {
        router.replace('/client/dashboard')
        return
      }

      setUserEmail(user.email!)
      setStatus('ready')
    }

    init()
  }, [router])

  // ── per-step validation
  const validate = (s: number): Record<string, string> => {
    const e: Record<string, string> = {}
    switch (s) {
      case 1: {
        const w = parseFloat(currentWeight)
        if (!currentWeight.trim() || isNaN(w) || w <= 0)
          e.current_weight = 'Enter your current weight'
        break
      }
      case 2:
        if (!goal) e.goal = 'Select a goal'
        break
      case 3: {
        const w = parseFloat(desiredWeight)
        if (!desiredWeight.trim() || isNaN(w) || w <= 0)
          e.desired_weight = 'Enter your target weight'
        break
      }
      case 4: {
        const m = parseInt(mealsPerDay, 10)
        if (!mealsPerDay.trim() || isNaN(m) || m < 1 || m > 8)
          e.meals_per_day = 'Enter a number between 1 and 8'
        break
      }
      case 5:
        if (!activityLevel) e.activity_level = 'Select your activity level'
        break
      case 6:
        if (!trainingLocation) e.training_location = 'Select where you train'
        if (!trainingDays) e.training_days = 'Select how many days per week'
        if (!preferredTime) e.preferred_time = 'Select your preferred training time'
        break
    }
    return e
  }

  const handleNext = () => {
    const errs = validate(step)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setStep((s) => s + 1)
  }

  const handleBack = () => {
    setErrors({})
    setStep((s) => s - 1)
  }

  const handleComplete = async () => {
    const errs = validate(6)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setIsSubmitting(true)
    setServerError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('clients')
      .update({
        current_weight: parseFloat(currentWeight),
        current_weight_unit: currentWeightUnit,
        goal,
        desired_weight: parseFloat(desiredWeight),
        desired_weight_unit: desiredWeightUnit,
        meals_per_day: parseInt(mealsPerDay, 10),
        foods_to_avoid: foodsToAvoid.trim() || null,
        activity_level: activityLevel,
        occupation_notes: occupationNotes.trim() || null,
        health_notes: healthNotes.trim() || null,
        training_location: trainingLocation,
        training_days_per_week: parseInt(trainingDays, 10),
        preferred_training_time: preferredTime,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('email', userEmail)

    if (error) {
      setServerError('Something went wrong. Please try again.')
      setIsSubmitting(false)
      return
    }

    router.push('/client/dashboard')
  }

  // ── loading screen
  if (status === 'loading') {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: 'var(--color-surface-1)' }}
      >
        <Spinner />
      </div>
    )
  }

  const meta = STEP_META[step - 1]
  const progress = (step / TOTAL_STEPS) * 100

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-8 py-12"
      style={{ backgroundColor: 'var(--color-surface-1)' }}
    >
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="flex flex-col mb-10">
          <span
            className="text-2xl leading-tight"
            style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
          >
            Mitovski
          </span>
          <span
            className="text-2xl leading-tight"
            style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
          >
            Coaching
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="mb-8"
          style={{
            height: '3px',
            backgroundColor: 'var(--color-surface-3)',
            borderRadius: '2px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: 'var(--color-accent)',
              borderRadius: '2px',
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {/* Step heading */}
        <h2
          className="text-3xl mb-1"
          style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
        >
          {meta.title}
        </h2>
        <p className="mb-8 text-sm" style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
          {meta.subtitle}
        </p>

        {/* Step content */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            step === TOTAL_STEPS ? handleComplete() : handleNext()
          }}
          className="flex flex-col gap-5"
          noValidate
        >
          {/* ─ Step 1: Current weight ─ */}
          {step === 1 && (
            <Field label="Current weight" error={errors.current_weight}>
              <UnitToggle value={currentWeightUnit} onChange={setCurrentWeightUnit} />
              <div className="mt-3">
                <InputField
                  type="number"
                  inputMode="decimal"
                  placeholder={currentWeightUnit === 'kg' ? 'e.g. 80' : 'e.g. 176'}
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
            </Field>
          )}

          {/* ─ Step 2: Goal ─ */}
          {step === 2 && (
            <Field label="Select a goal" error={errors.goal}>
              <OptionGrid
                options={GOALS}
                value={goal as typeof GOALS[number]['value'] | ''}
                onChange={(v) => setGoal(v)}
              />
            </Field>
          )}

          {/* ─ Step 3: Desired weight ─ */}
          {step === 3 && (
            <Field label="Target weight" error={errors.desired_weight}>
              <UnitToggle value={desiredWeightUnit} onChange={setDesiredWeightUnit} />
              <div className="mt-3">
                <InputField
                  type="number"
                  inputMode="decimal"
                  placeholder={desiredWeightUnit === 'kg' ? 'e.g. 75' : 'e.g. 165'}
                  value={desiredWeight}
                  onChange={(e) => setDesiredWeight(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
            </Field>
          )}

          {/* ─ Step 4: Nutrition ─ */}
          {step === 4 && (
            <>
              <Field label="Meals per day" error={errors.meals_per_day}>
                <InputField
                  id="mealsPerDay"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 3"
                  value={mealsPerDay}
                  onChange={(e) => setMealsPerDay(e.target.value)}
                  min={1}
                  max={8}
                />
              </Field>
              <Field label="Foods to avoid or allergies" optional>
                <TextareaField
                  placeholder="e.g. dairy, gluten, shellfish…"
                  value={foodsToAvoid}
                  onChange={(e) => setFoodsToAvoid(e.target.value)}
                />
              </Field>
            </>
          )}

          {/* ─ Step 5: Lifestyle ─ */}
          {step === 5 && (
            <>
              <Field label="Activity level outside training" error={errors.activity_level}>
                <OptionGrid
                  options={ACTIVITY_LEVELS}
                  value={activityLevel as typeof ACTIVITY_LEVELS[number]['value'] | ''}
                  onChange={(v) => setActivityLevel(v)}
                />
              </Field>
              <Field label="Occupation / daily routine" optional>
                <TextareaField
                  placeholder="e.g. Office worker, mostly sitting…"
                  value={occupationNotes}
                  onChange={(e) => setOccupationNotes(e.target.value)}
                />
              </Field>
              <Field label="Injuries or health conditions" optional>
                <TextareaField
                  placeholder="e.g. Lower back pain, knee issues…"
                  value={healthNotes}
                  onChange={(e) => setHealthNotes(e.target.value)}
                />
              </Field>
            </>
          )}

          {/* ─ Step 6: Training ─ */}
          {step === 6 && (
            <>
              <Field label="Where do you train?" error={errors.training_location}>
                <ButtonGroup
                  options={TRAINING_LOCATIONS}
                  value={trainingLocation as typeof TRAINING_LOCATIONS[number]['value'] | ''}
                  onChange={(v) => setTrainingLocation(v)}
                />
              </Field>
              <Field label="Days per week" error={errors.training_days}>
                <ButtonGroup
                  options={TRAINING_DAYS}
                  value={trainingDays as typeof TRAINING_DAYS[number]['value'] | ''}
                  onChange={(v) => setTrainingDays(v)}
                />
              </Field>
              <Field label="Preferred training time" error={errors.preferred_time}>
                <ButtonGroup
                  options={TRAINING_TIMES}
                  value={preferredTime as typeof TRAINING_TIMES[number]['value'] | ''}
                  onChange={(v) => setPreferredTime(v)}
                />
              </Field>
            </>
          )}

          {/* Server error */}
          {serverError && (
            <div
              className="px-4 py-3 text-sm"
              style={{
                backgroundColor: 'var(--color-surface-3)',
                color: 'var(--color-text-secondary)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {serverError}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-3">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-3 text-sm transition-colors"
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-muted)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-strong)'
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.color = 'var(--color-text-muted)'
                }}
              >
                Back
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`py-3 text-sm flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${step > 1 ? 'flex-1' : 'w-full'}`}
              style={{
                backgroundColor: 'var(--color-text-primary)',
                color: 'var(--color-base)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-3)'
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'var(--color-text-primary)'
                  e.currentTarget.style.color = 'var(--color-base)'
                }
              }}
              onMouseDown={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                }
              }}
              onMouseUp={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-3)'
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                }
              }}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 flex-shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.961 3 8.12l3-2.829z"
                    />
                  </svg>
                  Saving…
                </>
              ) : step === TOTAL_STEPS ? (
                'Complete'
              ) : (
                'Next'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
