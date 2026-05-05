-- workout_templates: named reusable workouts (Upper A, Lower B, etc.)
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- exercises within a template, ordered
CREATE TABLE IF NOT EXISTS public.workout_template_exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES public.exercises(id),
  sort_order   int NOT NULL DEFAULT 0,
  target_sets  int NOT NULL DEFAULT 3,
  target_reps  text NOT NULL DEFAULT '8-10',
  rest_seconds int NOT NULL DEFAULT 90,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- a program assigned to a specific client
CREATE TABLE IF NOT EXISTS public.workout_programs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id    uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name         text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- maps each day of week to a template (null = rest day)
CREATE TABLE IF NOT EXISTS public.workout_program_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES public.workout_programs(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon ... 6=Sun
  template_id uuid REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, day_of_week)
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_workout_templates_workspace
  ON public.workout_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workout_template_exercises_template
  ON public.workout_template_exercises(template_id);
CREATE INDEX IF NOT EXISTS idx_workout_programs_client
  ON public.workout_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_program_days_program
  ON public.workout_program_days(program_id);

-- RLS
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_program_days ENABLE ROW LEVEL SECURITY;
