-- Carb cycle nutrition assignments
-- Stores a cyclic low/high carb rotation for a client.
-- cycle_length days repeat; the last position in the cycle is the "high" day.
-- Default: 4-day cycle → [Low, Low, Low, High]

CREATE TABLE IF NOT EXISTS public.carb_cycle_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id        uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  low_plan_id      uuid NOT NULL REFERENCES public.meal_plan_templates(id) ON DELETE CASCADE,
  high_plan_id     uuid NOT NULL REFERENCES public.meal_plan_templates(id) ON DELETE CASCADE,
  cycle_start_date date NOT NULL,
  cycle_length     integer NOT NULL DEFAULT 4,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Only one active carb cycle per client at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_carb_cycle_assignments_active_client
  ON public.carb_cycle_assignments(client_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_carb_cycle_assignments_client
  ON public.carb_cycle_assignments(client_id);

ALTER TABLE public.carb_cycle_assignments ENABLE ROW LEVEL SECURITY;

-- Clients can read their own assignment (coach uses service role via adminClient)
CREATE POLICY "clients can read own carb cycle assignment"
  ON public.carb_cycle_assignments FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE email = auth.email()
    )
  );
