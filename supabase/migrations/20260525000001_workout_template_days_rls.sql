-- RLS policy for workout_template_days
-- Allow clients to read template days that are part of their active program

CREATE POLICY "clients can read their program template days"
  ON public.workout_template_days
  FOR SELECT
  USING (
    id IN (
      SELECT pd.template_day_id
      FROM public.workout_program_days pd
      JOIN public.workout_programs p ON p.id = pd.program_id
      JOIN public.clients c ON c.id = p.client_id
      WHERE c.email = auth.email()
        AND p.is_active = true
    )
  );
