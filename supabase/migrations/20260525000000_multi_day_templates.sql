-- Add the intermediate layer: individual workout days inside a template
CREATE TABLE IF NOT EXISTS public.workout_template_days (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  sort_order   int  NOT NULL DEFAULT 0,
  label        text NOT NULL DEFAULT 'Day 1',
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_template_days_template
  ON public.workout_template_days(template_id);

ALTER TABLE public.workout_template_days ENABLE ROW LEVEL SECURITY;

-- Re-point workout_template_exercises from template_id to template_day_id
ALTER TABLE public.workout_template_exercises
  ADD COLUMN IF NOT EXISTS template_day_id uuid REFERENCES public.workout_template_days(id) ON DELETE CASCADE;

-- Migrate existing exercises: create one default day per template and assign exercises to it
DO $$
DECLARE
  t RECORD;
  new_day_id uuid;
BEGIN
  FOR t IN SELECT DISTINCT template_id FROM public.workout_template_exercises LOOP
    INSERT INTO public.workout_template_days (template_id, sort_order, label)
    VALUES (t.template_id, 0, 'Day 1')
    RETURNING id INTO new_day_id;

    UPDATE public.workout_template_exercises
    SET template_day_id = new_day_id
    WHERE template_id = t.template_id;
  END LOOP;
END;
$$;

-- Make template_day_id NOT NULL now that existing rows are migrated
ALTER TABLE public.workout_template_exercises
  ALTER COLUMN template_day_id SET NOT NULL;

-- Drop the old template_id FK from exercises (no longer needed — access goes through day)
ALTER TABLE public.workout_template_exercises
  DROP COLUMN IF EXISTS template_id;

-- Update program days: replace template_id with template_day_id
ALTER TABLE public.workout_program_days
  ADD COLUMN IF NOT EXISTS template_day_id uuid REFERENCES public.workout_template_days(id) ON DELETE SET NULL;

-- Migrate existing program_days rows: point them at the first (only) day of their template
UPDATE public.workout_program_days pd
SET template_day_id = (
  SELECT id FROM public.workout_template_days
  WHERE template_id = pd.template_id
  ORDER BY sort_order ASC
  LIMIT 1
)
WHERE pd.template_id IS NOT NULL;

-- Drop old template_id column from program_days
ALTER TABLE public.workout_program_days
  DROP COLUMN IF EXISTS template_id;

CREATE INDEX IF NOT EXISTS idx_workout_program_days_template_day
  ON public.workout_program_days(template_day_id);

-- Add template_day_id to workout_sessions for accurate last-session lookup
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS template_day_id uuid REFERENCES public.workout_template_days(id) ON DELETE SET NULL;
