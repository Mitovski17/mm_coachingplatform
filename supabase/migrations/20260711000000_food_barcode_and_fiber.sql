-- Add fiber tracking and a first-class barcode column to the global food cache.
-- Barcode-scanned products (Open Food Facts + client-contributed manual entries)
-- are looked up by this column so the database grows over time.

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS fiber_per_100g numeric(6,1);

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS barcode text;

-- Fast lookup by barcode (partial index — most manual foods have no barcode)
CREATE INDEX IF NOT EXISTS idx_foods_barcode
  ON public.foods(barcode)
  WHERE barcode IS NOT NULL;

-- One row per barcode. Client contributions upsert onto this constraint so a
-- product scanned by two different clients doesn't create duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_foods_barcode
  ON public.foods(barcode)
  WHERE barcode IS NOT NULL;
