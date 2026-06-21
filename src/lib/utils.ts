import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Resolves whether a given date is a "low" or "high" carb day in a cyclic rotation.
 * The last position in the cycle (index = cycleLength - 1) is always the "high" day.
 * Example: cycleLength = 4 → [low, low, low, high] repeating.
 */
export function resolveCarbCycleDay(
  cycleStartDate: string,
  date: string,
  cycleLength: number
): 'low' | 'high' {
  const start = new Date(cycleStartDate + 'T00:00:00Z')
  const target = new Date(date + 'T00:00:00Z')
  const diffDays = Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'low'
  const pos = diffDays % cycleLength
  return pos === cycleLength - 1 ? 'high' : 'low'
}
