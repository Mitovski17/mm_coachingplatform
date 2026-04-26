-- Check-in system: templates + submissions

CREATE TABLE public.checkin_templates (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  questions    jsonb       NOT NULL,  -- [{ id, label, type }] type: text | number | photo | scale_1_10
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checkins (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id  uuid        REFERENCES public.checkin_templates(id) ON DELETE SET NULL,
  status       text        NOT NULL DEFAULT 'pending',  -- pending | reviewed
  answers      jsonb       NOT NULL,  -- { [question_id]: answer_value }
  coach_notes  text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz
);

ALTER TABLE public.checkin_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- ── checkin_templates policies ────────────────────────────────────────────────

-- Coaches: full access to templates in their workspace
DROP POLICY IF EXISTS checkin_templates_coach_all ON public.checkin_templates;
CREATE POLICY checkin_templates_coach_all ON public.checkin_templates
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

-- ── checkins policies ─────────────────────────────────────────────────────────

-- Coaches: full access to check-ins in their workspace
DROP POLICY IF EXISTS checkins_coach_all ON public.checkins;
CREATE POLICY checkins_coach_all ON public.checkins
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

-- Clients: insert their own check-ins
DROP POLICY IF EXISTS checkins_client_insert ON public.checkins;
CREATE POLICY checkins_client_insert ON public.checkins
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE email = auth.email()
    )
  );

-- Clients: read only their own check-ins
DROP POLICY IF EXISTS checkins_client_select ON public.checkins;
CREATE POLICY checkins_client_select ON public.checkins
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE email = auth.email()
    )
  );
