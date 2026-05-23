-- Allow coaches to manage invites for their own workspace.
-- Previously the policy only permitted 'owner' and 'admin' roles.
ALTER POLICY "workspace admins can manage invites" ON public.invites
USING (
  workspace_id IN (
    SELECT profiles.workspace_id
    FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text])
  )
);
