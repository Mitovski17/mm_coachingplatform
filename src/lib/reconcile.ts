import { randomUUID } from 'node:crypto'

/**
 * Pairs the rows coming out of an editor with the rows already in the database
 * so that stable primary keys survive a save.
 *
 * Template child rows are referenced from elsewhere with `ON DELETE SET NULL`:
 * `workout_template_days.id` from program days, date overrides and session
 * history; `meal_plan_meal_options.id` / `meal_plan_foods.id` from nutrition
 * logs. Re-saving a template by deleting its children and re-inserting them
 * therefore silently unassigns clients. Reusing the existing id keeps every
 * reference intact.
 *
 * Matching runs in three passes, most reliable first:
 *   1. the editor sent back the row's own id
 *   2. an unclaimed existing row has the same key (name / label / food name)
 *   3. leftovers pair up in order, which is what a rename looks like
 */
export type ReconcilePair<P, E> = {
  incoming: P
  /** Existing row this maps onto, or null when it is genuinely new. */
  existing: E | null
  /** Primary key to write — reused when matched, freshly minted when not. */
  id: string
}

export type ReconcileResult<P, E> = {
  pairs: ReconcilePair<P, E>[]
  /** Existing rows nothing mapped onto — safe to delete. */
  removed: E[]
}

export function reconcileRows<P, E extends { id: string }>(
  incoming: P[],
  existing: E[],
  {
    idOf,
    keyOf,
    existingKeyOf,
  }: {
    idOf?: (row: P) => string | null | undefined
    keyOf: (row: P) => string
    existingKeyOf: (row: E) => string
  }
): ReconcileResult<P, E> {
  const pool = new Map(existing.map((e) => [e.id, e]))
  const matched: Array<E | null> = incoming.map(() => null)

  // Pass 1 — explicit id from the editor.
  if (idOf) {
    incoming.forEach((row, i) => {
      const id = idOf(row)
      const hit = id ? pool.get(id) : undefined
      if (hit) {
        matched[i] = hit
        pool.delete(hit.id)
      }
    })
  }

  // Pass 2 — same key.
  incoming.forEach((row, i) => {
    if (matched[i]) return
    const key = normalizeKey(keyOf(row))
    for (const candidate of pool.values()) {
      if (normalizeKey(existingKeyOf(candidate)) === key) {
        matched[i] = candidate
        pool.delete(candidate.id)
        return
      }
    }
  })

  // Pass 3 — leftovers in order (a renamed row).
  const leftovers = existing.filter((e) => pool.has(e.id))
  let next = 0
  incoming.forEach((row, i) => {
    if (matched[i] || next >= leftovers.length) return
    const candidate = leftovers[next++]
    matched[i] = candidate
    pool.delete(candidate.id)
  })

  return {
    pairs: incoming.map((row, i) => ({
      incoming: row,
      existing: matched[i],
      id: matched[i]?.id ?? randomUUID(),
    })),
    removed: existing.filter((e) => pool.has(e.id)),
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}
