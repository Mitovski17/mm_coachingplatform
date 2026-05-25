-- Coach onboarding: track wizard completion and profile answers

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coaching_focus       text    CHECK (coaching_focus IN ('training', 'nutrition', 'both')),
  ADD COLUMN IF NOT EXISTS client_count_range   text    CHECK (client_count_range IN ('starting', '1-10', '10+'));
