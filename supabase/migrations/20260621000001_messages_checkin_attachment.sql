-- Add check-in snippet attachment support to messages
-- Stores a compact snapshot of key metrics from the check-in the coach is replying to.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS checkin_attachment jsonb;
