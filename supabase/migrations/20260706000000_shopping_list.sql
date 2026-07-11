-- Shopping List feature
-- 1. Add purchasing / localization metadata to foods so the aggregator can
--    convert stored nutrition grams into buyable Bulgarian units.
-- 2. Persist per-item "checked" state so a generated list survives a refresh.

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS name_bg          text,
  ADD COLUMN IF NOT EXISTS purchase_unit    text NOT NULL DEFAULT 'г',
  ADD COLUMN IF NOT EXISTS package_size     numeric(8,1),
  ADD COLUMN IF NOT EXISTS grocery_category text NOT NULL DEFAULT 'Други',
  ADD COLUMN IF NOT EXISTS is_pantry_staple boolean NOT NULL DEFAULT false;

-- Checked-off items for a client's generated shopping list.
-- list_key encodes the range + staples toggle so distinct lists keep separate
-- check state; item_key is the aggregation key (catalog id / normalized name).
CREATE TABLE IF NOT EXISTS public.shopping_list_checks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  list_key   text NOT NULL,
  item_key   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, list_key, item_key)
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_checks_client_list
  ON public.shopping_list_checks(client_id, list_key);

ALTER TABLE public.shopping_list_checks ENABLE ROW LEVEL SECURITY;

-- Clients can read their own check state; all writes go through the service role.
CREATE POLICY "clients can read own shopping checks"
  ON public.shopping_list_checks FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE email = auth.email()
    )
  );

CREATE POLICY "service_role_shopping_list_checks"
  ON public.shopping_list_checks FOR ALL
  USING (auth.role() = 'service_role');
