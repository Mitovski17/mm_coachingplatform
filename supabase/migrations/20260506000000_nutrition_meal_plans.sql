-- Global food cache (Open Food Facts imports + manual entries)
CREATE TABLE IF NOT EXISTS public.foods (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  brand             text,
  calories_per_100g numeric(7,1),
  protein_per_100g  numeric(6,1),
  carbs_per_100g    numeric(6,1),
  fat_per_100g      numeric(6,1),
  source            text NOT NULL DEFAULT 'manual',
  external_id       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(external_id)
);

-- Meal plan templates (training or rest day, workspace-scoped)
CREATE TABLE IF NOT EXISTS public.meal_plan_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name             text NOT NULL,
  plan_type        text NOT NULL DEFAULT 'training',
  notes            text,
  recommendations  text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Meals within a template
CREATE TABLE IF NOT EXISTS public.meal_plan_meals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.meal_plan_templates(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Options within a meal (A, B, C)
CREATE TABLE IF NOT EXISTS public.meal_plan_meal_options (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id    uuid NOT NULL REFERENCES public.meal_plan_meals(id) ON DELETE CASCADE,
  label      text NOT NULL DEFAULT 'A',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Foods within an option
CREATE TABLE IF NOT EXISTS public.meal_plan_foods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id   uuid NOT NULL REFERENCES public.meal_plan_meal_options(id) ON DELETE CASCADE,
  food_id     uuid REFERENCES public.foods(id) ON DELETE SET NULL,
  food_name   text NOT NULL,
  quantity    numeric(7,1) NOT NULL DEFAULT 100,
  unit        text NOT NULL DEFAULT 'g',
  calories    numeric(7,1) NOT NULL DEFAULT 0,
  protein_g   numeric(6,1) NOT NULL DEFAULT 0,
  carbs_g     numeric(6,1) NOT NULL DEFAULT 0,
  fat_g       numeric(6,1) NOT NULL DEFAULT 0,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Client assignments
CREATE TABLE IF NOT EXISTS public.meal_plan_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id    uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id  uuid NOT NULL REFERENCES public.meal_plan_templates(id) ON DELETE CASCADE,
  plan_type    text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_plan_assignments_active
  ON public.meal_plan_assignments(client_id, plan_type)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_meal_plan_templates_workspace
  ON public.meal_plan_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_meals_template
  ON public.meal_plan_meals(template_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_meal_options_meal
  ON public.meal_plan_meal_options(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_foods_option
  ON public.meal_plan_foods(option_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_assignments_client
  ON public.meal_plan_assignments(client_id);

ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS meal_option_id uuid
    REFERENCES public.meal_plan_meal_options(id) ON DELETE SET NULL;
ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS template_food_id uuid
    REFERENCES public.meal_plan_foods(id) ON DELETE SET NULL;

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_meal_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read foods"
  ON public.foods FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "clients can read own meal plan data via assignments"
  ON public.meal_plan_templates FOR SELECT
  USING (
    id IN (
      SELECT template_id FROM public.meal_plan_assignments
      WHERE client_id IN (
        SELECT id FROM public.clients WHERE email = auth.email()
      )
    )
  );
