export type SetRow = {
  setNumber: number
  weightKg: string
  reps: string
  done: boolean
}

export type ExerciseState = {
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  targetSets: number
  targetReps: string
  restSeconds: number
  notes: string | null
  previousSets: Array<{ weightKg: number; reps: number }>
  currentSets: SetRow[]
  overloadIndicator: 'up' | 'down' | 'same' | null
}

export type RestTimer = {
  active: boolean
  secondsLeft: number
  totalSeconds: number
  exerciseId: string | null
  startedAt: string | null  // ISO timestamp — used to recompute secondsLeft on restore
}

export type ActiveWorkoutSession = {
  templateDayId: string   // '' for custom workouts
  isCustom: boolean
  templateName: string    // saved as the session name — "<template> — <day>"
  /** The day on its own, shown in the header. Optional: sessions stored before
   *  this existed restore without it and fall back to templateName. */
  dayLabel?: string
  /** Coach's overall template notes, shown behind the "workout instructions" button. */
  templateNotes?: string | null
  clientInfo: { id: string; workspace_id: string }
  exercises: ExerciseState[]
  sessionNotes: string
  startTime: string       // ISO timestamp
  rest: RestTimer
}
