-- Allow 'client' in addition to 'coach' for the invites role column.
-- Previously the check constraint only permitted 'coach'.
ALTER TABLE public.invites
  DROP CONSTRAINT IF EXISTS invites_role_check;

ALTER TABLE public.invites
  ADD CONSTRAINT invites_role_check
  CHECK (role IN ('coach', 'client'));
