-- ─── EXERCISES (global library, not workspace-scoped) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.exercises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  muscle_group  text NOT NULL,  -- chest | back | legs | shoulders | arms | core | cardio
  equipment     text NOT NULL,  -- barbell | dumbbell | machine | bodyweight | cable | other
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── WORKOUT SESSIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name             text NOT NULL DEFAULT '',
  notes            text,
  performed_at     timestamptz NOT NULL DEFAULT now(),
  duration_minutes int,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── WORKOUT SETS (individual sets within a session) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id),
  set_number  int NOT NULL DEFAULT 1,
  reps        int,
  weight_kg   numeric(6,2),
  rpe         numeric(3,1),  -- Rate of Perceived Exertion 1-10, optional
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── NUTRITION LOGS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  logged_date  date NOT NULL DEFAULT CURRENT_DATE,
  meal_type    text NOT NULL,  -- breakfast | lunch | dinner | snack
  food_name    text NOT NULL,
  calories     numeric(7,1),
  protein_g    numeric(6,1),
  carbs_g      numeric(6,1),
  fat_g        numeric(6,1),
  quantity     numeric(7,1),
  unit         text DEFAULT 'g',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workout_sessions_client ON public.workout_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_workspace ON public.workout_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_session ON public.workout_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_client_date ON public.nutrition_logs(client_id, logged_date);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

-- exercises: anyone authenticated can read the global library
CREATE POLICY "authenticated users can read exercises"
  ON public.exercises FOR SELECT
  USING (auth.role() = 'authenticated');

-- workout_sessions: clients can read/insert their own rows
CREATE POLICY "clients can read own workout sessions"
  ON public.workout_sessions FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE email = auth.email()
    )
  );

CREATE POLICY "clients can insert own workout sessions"
  ON public.workout_sessions FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE email = auth.email()
    )
  );

-- workout_sets: inherit access via session ownership
CREATE POLICY "clients can read own workout sets"
  ON public.workout_sets FOR SELECT
  USING (
    session_id IN (
      SELECT ws.id FROM public.workout_sessions ws
      JOIN public.clients c ON c.id = ws.client_id
      WHERE c.email = auth.email()
    )
  );

CREATE POLICY "clients can insert own workout sets"
  ON public.workout_sets FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT ws.id FROM public.workout_sessions ws
      JOIN public.clients c ON c.id = ws.client_id
      WHERE c.email = auth.email()
    )
  );

-- nutrition_logs: clients can read/insert their own rows
CREATE POLICY "clients can read own nutrition logs"
  ON public.nutrition_logs FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE email = auth.email()
    )
  );

CREATE POLICY "clients can insert own nutrition logs"
  ON public.nutrition_logs FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE email = auth.email()
    )
  );
