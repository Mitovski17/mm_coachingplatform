-- Body metrics table for tracking client measurements over time
CREATE TABLE IF NOT EXISTS public.body_metrics (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  recorded_date   date        NOT NULL,
  weight          numeric(6,2),
  body_fat_pct    numeric(5,2),
  waist_cm        numeric(6,2),
  chest_cm        numeric(6,2),
  hips_cm         numeric(6,2),
  left_arm_cm     numeric(6,2),
  right_arm_cm    numeric(6,2),
  left_thigh_cm   numeric(6,2),
  right_thigh_cm  numeric(6,2),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS body_metrics_client_date_idx
  ON public.body_metrics (client_id, recorded_date DESC);

ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

-- Coaches can manage their clients' metrics
CREATE POLICY "coaches_manage_body_metrics" ON public.body_metrics
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.coaches WHERE user_id = auth.uid()
    )
  );

-- Clients can read and insert their own metrics
CREATE POLICY "clients_read_own_body_metrics" ON public.body_metrics
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "clients_insert_own_body_metrics" ON public.body_metrics
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );
