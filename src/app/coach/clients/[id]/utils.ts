import type {
  Checkin,
  NutritionSummary,
  RedFlag,
  WorkoutCompliance,
} from './actions'

function currentMondayISO(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString()
}

export function computeRedFlags(data: {
  compliance: WorkoutCompliance
  checkins: Checkin[]
  nutritionSummary: NutritionSummary
  hasMealPlan: boolean
}): RedFlag[] {
  const flags: RedFlag[] = []
  const { compliance, checkins, nutritionSummary, hasMealPlan } = data

  // missed workouts
  if (compliance.targetPerWeek > 0) {
    const last = compliance.lastSessionDate
      ? new Date(compliance.lastSessionDate).getTime()
      : null
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000
    if (last === null || Date.now() - last > fiveDaysMs) {
      flags.push({
        type: 'missed_workouts',
        message: 'No workout logged in 5+ days',
      })
    }
  }

  // no check-in this week
  const monday = currentMondayISO().split('T')[0]
  const hasThisWeek = checkins.some((c) => c.weekStartDate === monday)
  if (!hasThisWeek) {
    flags.push({ type: 'no_checkin', message: 'Check-in not submitted this week' })
  }

  const latest = checkins[0]
  if (latest) {
    if (latest.performanceRating !== null && latest.performanceRating <= 4) {
      flags.push({
        type: 'low_performance',
        message: 'Performance rated ≤4 last check-in',
      })
    }
    if (latest.nutritionAdherence !== null && latest.nutritionAdherence <= 60) {
      flags.push({
        type: 'low_adherence',
        message: 'Nutrition adherence below 60%',
      })
    }
  }

  if (nutritionSummary.loggingDaysThisWeek === 0 && hasMealPlan) {
    flags.push({ type: 'not_logging', message: 'No nutrition logged this week' })
  }

  return flags
}
