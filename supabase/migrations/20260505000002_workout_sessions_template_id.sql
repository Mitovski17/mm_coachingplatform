ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS template_id uuid
  REFERENCES public.workout_templates(id);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_client_template
  ON public.workout_sessions(client_id, template_id);
