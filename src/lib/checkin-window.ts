/**
 * Check-in window utilities.
 *
 * The window opens every Sunday at 00:00 UTC and stays open until the client
 * submits. Once submitted, show a countdown to the next Sunday window.
 *
 * These are pure functions — no server directive, safe to import anywhere.
 */

/** Returns the most recent Sunday as YYYY-MM-DD (UTC). */
export function getSundayStart(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun … 6=Sat
  const sunday = new Date(now)
  sunday.setUTCDate(now.getUTCDate() - day)
  sunday.setUTCHours(0, 0, 0, 0)
  return sunday.toISOString().split('T')[0]
}

/** Returns the next Sunday at 00:00 UTC as a Date. */
export function getNextSundayMidnight(): Date {
  const now = new Date()
  const day = now.getUTCDay()
  // If today IS Sunday (0), the next window is 7 days from now.
  const daysUntil = day === 0 ? 7 : 7 - day
  const nextSunday = new Date(now)
  nextSunday.setUTCDate(now.getUTCDate() + daysUntil)
  nextSunday.setUTCHours(0, 0, 0, 0)
  return nextSunday
}

/** Formats a millisecond duration into "Xd Xh Xm" (omits zero leading units). */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m'
  const totalSeconds = Math.floor(ms / 1000)
  const days    = Math.floor(totalSeconds / 86400)
  const hours   = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  const parts: string[] = []
  if (days > 0)    parts.push(`${days}d`)
  if (hours > 0)   parts.push(`${hours}h`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`)
  return parts.join(' ')
}
