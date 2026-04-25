-- Add onboarding fields to the clients table.
-- All columns are nullable — they are populated after the client completes the
-- onboarding wizard; the record itself is created earlier by the coach.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS current_weight          numeric,
  ADD COLUMN IF NOT EXISTS current_weight_unit     text,        -- 'kg' | 'lbs'
  ADD COLUMN IF NOT EXISTS goal                    text,        -- 'lose_fat' | 'build_muscle' | 'recomposition' | 'performance'
  ADD COLUMN IF NOT EXISTS desired_weight          numeric,
  ADD COLUMN IF NOT EXISTS desired_weight_unit     text,        -- 'kg' | 'lbs'
  ADD COLUMN IF NOT EXISTS meals_per_day           integer,
  ADD COLUMN IF NOT EXISTS foods_to_avoid          text,
  ADD COLUMN IF NOT EXISTS activity_level          text,        -- 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active'
  ADD COLUMN IF NOT EXISTS occupation_notes        text,
  ADD COLUMN IF NOT EXISTS health_notes            text,
  ADD COLUMN IF NOT EXISTS training_location       text,        -- 'gym' | 'home' | 'both'
  ADD COLUMN IF NOT EXISTS training_days_per_week  integer,
  ADD COLUMN IF NOT EXISTS preferred_training_time text,        -- 'morning' | 'afternoon' | 'evening' | 'no_preference'
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Enable RLS (safe to run even if already enabled)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Allow a signed-in client to read their own record (matched by email).
-- Coaches retain access via their existing workspace-scoped policies.
DROP POLICY IF EXISTS clients_select_own ON public.clients;
CREATE POLICY clients_select_own ON public.clients
  FOR SELECT
  USING (email = auth.email());

-- Allow a signed-in client to update their own record.
DROP POLICY IF EXISTS clients_update_own ON public.clients;
CREATE POLICY clients_update_own ON public.clients
  FOR UPDATE
  USING (email = auth.email())
  WITH CHECK (email = auth.email());
