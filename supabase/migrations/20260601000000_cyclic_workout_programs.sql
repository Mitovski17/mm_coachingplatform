-- Add cyclic schedule support to workout_programs and workout_program_days

-- Add schedule_type (weekly | cyclic) and cycle_start_date to programs
ALTER TABLE public.workout_programs
  ADD COLUMN IF NOT EXISTS schedule_type TEXT NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS cycle_start_date DATE;

-- Make day_of_week nullable: cyclic programs use cycle_position instead
-- (NULL passes the existing CHECK constraint since NULL BETWEEN 0 AND 6 = NULL, not FALSE)
-- (NULL values don't conflict with the existing UNIQUE(program_id, day_of_week) constraint)
ALTER TABLE public.workout_program_days
  ALTER COLUMN day_of_week DROP NOT NULL;

-- Add cycle_position: zero-indexed position in the repeating cycle
-- NULL for weekly program days; explicit integer for cyclic program days (including rest days)
ALTER TABLE public.workout_program_days
  ADD COLUMN IF NOT EXISTS cycle_position INTEGER;
