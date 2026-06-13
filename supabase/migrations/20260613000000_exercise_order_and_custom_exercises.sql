-- Add exercise_order to workout_sets so history shows exercises in the order they were performed
ALTER TABLE public.workout_sets
  ADD COLUMN IF NOT EXISTS exercise_order int NOT NULL DEFAULT 0;

-- Add workspace_id to exercises to support client-created custom exercises
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workout_sets_order
  ON public.workout_sets(session_id, exercise_order, set_number);

CREATE INDEX IF NOT EXISTS idx_exercises_workspace
  ON public.exercises(workspace_id);

-- Allow workspace members (coach service role) to insert workspace-scoped exercises
-- The existing RLS policy allows authenticated reads; inserts go through service role
