-- Date-specific workout overrides: assign a specific template day to a client on exact dates
CREATE TABLE IF NOT EXISTS public.date_workout_overrides (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id    UUID        NOT NULL REFERENCES public.clients(id)    ON DELETE CASCADE,
  template_day_id UUID     REFERENCES public.workout_template_days(id) ON DELETE SET NULL,
  assigned_date DATE       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, assigned_date)
);

-- Date-specific meal plan overrides: assign a specific meal plan template to a client on exact dates
CREATE TABLE IF NOT EXISTS public.date_meal_overrides (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id)       ON DELETE CASCADE,
  client_id    UUID        NOT NULL REFERENCES public.clients(id)           ON DELETE CASCADE,
  template_id  UUID        REFERENCES public.meal_plan_templates(id)        ON DELETE SET NULL,
  assigned_date DATE       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, assigned_date)
);

CREATE INDEX IF NOT EXISTS idx_date_workout_overrides_client
  ON public.date_workout_overrides(client_id, assigned_date);

CREATE INDEX IF NOT EXISTS idx_date_meal_overrides_client
  ON public.date_meal_overrides(client_id, assigned_date);

ALTER TABLE public.date_workout_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_meal_overrides    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_date_workout_overrides"
  ON public.date_workout_overrides FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_date_meal_overrides"
  ON public.date_meal_overrides FOR ALL
  USING (auth.role() = 'service_role');
