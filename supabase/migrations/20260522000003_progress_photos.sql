-- Create the progress-photos storage bucket (private, 10 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progress-photos',
  'progress-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Standalone progress photos uploaded outside of check-ins
CREATE TABLE IF NOT EXISTS public.progress_photos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES public.clients(id)    ON DELETE CASCADE,
  storage_path text        NOT NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS progress_photos_coach_select ON public.progress_photos;
CREATE POLICY progress_photos_coach_select ON public.progress_photos
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS progress_photos_client_select ON public.progress_photos;
CREATE POLICY progress_photos_client_select ON public.progress_photos
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE email = auth.email()
    )
  );

DROP POLICY IF EXISTS progress_photos_client_insert ON public.progress_photos;
CREATE POLICY progress_photos_client_insert ON public.progress_photos
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE email = auth.email()
    )
  );
