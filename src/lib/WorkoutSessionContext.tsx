'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ActiveWorkoutSession, ExerciseState, RestTimer } from './workout-session-types'

const LS_KEY = 'workout_active_session'

type Updater<T> = T | ((prev: T) => T)

type WorkoutSessionCtx = {
  session: ActiveWorkoutSession | null
  elapsed: number
  startSession: (s: ActiveWorkoutSession) => void
  setExercises: (updater: Updater<ExerciseState[]>) => void
  setNotes: (notes: string) => void
  setRest: (updater: Updater<RestTimer>) => void
  endSession: () => void
}

const WorkoutSessionContext = createContext<WorkoutSessionCtx | null>(null)

function restoreSecondsleft(rest: RestTimer): RestTimer {
  if (!rest.active || !rest.startedAt) return rest
  const elapsed = Math.floor((Date.now() - new Date(rest.startedAt).getTime()) / 1000)
  const secondsLeft = Math.max(0, rest.totalSeconds - elapsed)
  return { ...rest, secondsLeft, active: secondsLeft > 0 }
}

export function WorkoutSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const hydrated = useRef(false)

  // Hydrate from localStorage once on mount
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const parsed: ActiveWorkoutSession = JSON.parse(raw)
        // Recompute rest timer in case browser was closed mid-rest
        parsed.rest = restoreSecondsleft(parsed.rest)
        setSession(parsed)
      }
    } catch {
      localStorage.removeItem(LS_KEY)
    }
  }, [])

  // Elapsed timer — runs continuously as long as a session exists
  useEffect(() => {
    if (!session) return
    const start = new Date(session.startTime).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session?.startTime])  // eslint-disable-line react-hooks/exhaustive-deps

  // Rest timer countdown — lives here so it persists across page navigations
  useEffect(() => {
    if (!session?.rest.active) return
    const id = setInterval(() => {
      setSession((prev) => {
        if (!prev?.rest.active) return prev
        if (prev.rest.secondsLeft <= 1) {
          try { navigator.vibrate?.([300, 100, 300]) } catch { /* ok */ }
          const updated = { ...prev, rest: { ...prev.rest, active: false, secondsLeft: 0 } }
          localStorage.setItem(LS_KEY, JSON.stringify(updated))
          return updated
        }
        const updated = { ...prev, rest: { ...prev.rest, secondsLeft: prev.rest.secondsLeft - 1 } }
        localStorage.setItem(LS_KEY, JSON.stringify(updated))
        return updated
      })
    }, 1000)
    return () => clearInterval(id)
  }, [session?.rest.active])  // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback((s: ActiveWorkoutSession) => {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  }, [])

  const startSession = useCallback((s: ActiveWorkoutSession) => {
    setSession(s)
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  }, [])

  const setExercises = useCallback((updater: Updater<ExerciseState[]>) => {
    setSession((prev) => {
      if (!prev) return prev
      const exercises = typeof updater === 'function' ? updater(prev.exercises) : updater
      const updated = { ...prev, exercises }
      save(updated)
      return updated
    })
  }, [save])

  const setNotes = useCallback((sessionNotes: string) => {
    setSession((prev) => {
      if (!prev) return prev
      const updated = { ...prev, sessionNotes }
      save(updated)
      return updated
    })
  }, [save])

  const setRest = useCallback((updater: Updater<RestTimer>) => {
    setSession((prev) => {
      if (!prev) return prev
      const rest = typeof updater === 'function' ? updater(prev.rest) : updater
      const updated = { ...prev, rest }
      save(updated)
      return updated
    })
  }, [save])

  const endSession = useCallback(() => {
    setSession(null)
    setElapsed(0)
    localStorage.removeItem(LS_KEY)
  }, [])

  return (
    <WorkoutSessionContext.Provider value={{ session, elapsed, startSession, setExercises, setNotes, setRest, endSession }}>
      {children}
    </WorkoutSessionContext.Provider>
  )
}

export function useWorkoutSession() {
  const ctx = useContext(WorkoutSessionContext)
  if (!ctx) throw new Error('useWorkoutSession must be used within WorkoutSessionProvider')
  return ctx
}
