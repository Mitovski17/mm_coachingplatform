-- Per-workspace "universal instructions" for an exercise.
-- A coach saves the notes they wrote on one template row as the default for that
-- exercise; every later pick of the same exercise pre-fills with them, and the
-- coach can still edit the copy that lives on the template row.
--
-- Kept out of `exercises.description` on purpose: most exercises are global
-- (workspace_id IS NULL) and shared across every workspace, so notes must be
-- scoped per workspace rather than written onto the shared row.
CREATE TABLE IF NOT EXISTS public.exercise_default_notes (
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  exercise_id   uuid        NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  notes         text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, exercise_id)
);

ALTER TABLE public.exercise_default_notes ENABLE ROW LEVEL SECURITY;

-- Coaches manage the defaults for their own workspace. Writes from the app go
-- through the service role, which bypasses RLS; this policy keeps any direct
-- authenticated access correctly scoped.
DROP POLICY IF EXISTS "coaches manage workspace exercise_default_notes" ON public.exercise_default_notes;
CREATE POLICY "coaches manage workspace exercise_default_notes" ON public.exercise_default_notes
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
  );
