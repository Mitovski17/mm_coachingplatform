-- Security-advisor remediation (C3 from the 2026-07 audit).
--
-- Three classes of fix, all defense-in-depth: the app talks to these tables
-- through the service-role key (which bypasses RLS entirely), so none of this
-- changes current app behaviour. It closes the gap where the *anon*/*authenticated*
-- keys could reach data directly if the frontend ever queried these tables.
--
--   1. 10 tables had RLS enabled but zero policies (deny-all today, but flagged
--      by the linter and brittle). Add workspace-scoped coach policies and
--      client-read policies that mirror the existing meal_plan_templates /
--      workout_template_days idioms.
--   2. Pin search_path on 3 trigger functions (was role-mutable).
--   3. Revoke EXECUTE on the 2 SECURITY DEFINER helpers from anon/authenticated
--      so they can't be called as RPCs. Verified that policy evaluation does not
--      require the caller to hold EXECUTE — RLS quals run in the table-owner
--      context — so revoking does not break the profiles policy that uses
--      get_my_workspace_id().
--
-- NOTE: "Leaked password protection disabled" is an Auth setting, not SQL. Enable
-- it in Dashboard → Authentication → Policies → "Leaked password protection".

-- ---------------------------------------------------------------------------
-- 1. RLS policies
-- ---------------------------------------------------------------------------

-- Coach access uses the workspace-membership idiom already used on public.clients:
--   workspace_id in (select workspace_id from profiles where id = auth.uid())
-- Client read access mirrors the existing "clients can read own ..." policies:
--   scoped through meal_plan_assignments / workout_programs to clients.email.

-- body_metrics (has workspace_id + client_id) -------------------------------
drop policy if exists "coaches manage workspace body_metrics" on public.body_metrics;
create policy "coaches manage workspace body_metrics" on public.body_metrics
  for all using (
    workspace_id in (select workspace_id from public.profiles where id = auth.uid())
  );

drop policy if exists "clients read own body_metrics" on public.body_metrics;
create policy "clients read own body_metrics" on public.body_metrics
  for select using (
    client_id in (select id from public.clients where email = auth.email())
  );

-- meal_plan_assignments (has workspace_id + client_id) ----------------------
drop policy if exists "coaches manage workspace meal_plan_assignments" on public.meal_plan_assignments;
create policy "coaches manage workspace meal_plan_assignments" on public.meal_plan_assignments
  for all using (
    workspace_id in (select workspace_id from public.profiles where id = auth.uid())
  );

drop policy if exists "clients read own meal_plan_assignments" on public.meal_plan_assignments;
create policy "clients read own meal_plan_assignments" on public.meal_plan_assignments
  for select using (
    client_id in (select id from public.clients where email = auth.email())
  );

-- meal_plan_meals (template_id -> meal_plan_templates.workspace_id) ---------
drop policy if exists "coaches manage workspace meal_plan_meals" on public.meal_plan_meals;
create policy "coaches manage workspace meal_plan_meals" on public.meal_plan_meals
  for all using (
    template_id in (
      select id from public.meal_plan_templates
      where workspace_id in (select workspace_id from public.profiles where id = auth.uid())
    )
  );

drop policy if exists "clients read own meal_plan_meals" on public.meal_plan_meals;
create policy "clients read own meal_plan_meals" on public.meal_plan_meals
  for select using (
    template_id in (
      select template_id from public.meal_plan_assignments
      where client_id in (select id from public.clients where email = auth.email())
    )
  );

-- meal_plan_meal_options (meal_id -> meal_plan_meals) ----------------------
drop policy if exists "coaches manage workspace meal_plan_meal_options" on public.meal_plan_meal_options;
create policy "coaches manage workspace meal_plan_meal_options" on public.meal_plan_meal_options
  for all using (
    meal_id in (
      select m.id from public.meal_plan_meals m
      join public.meal_plan_templates t on t.id = m.template_id
      where t.workspace_id in (select workspace_id from public.profiles where id = auth.uid())
    )
  );

drop policy if exists "clients read own meal_plan_meal_options" on public.meal_plan_meal_options;
create policy "clients read own meal_plan_meal_options" on public.meal_plan_meal_options
  for select using (
    meal_id in (
      select m.id from public.meal_plan_meals m
      where m.template_id in (
        select template_id from public.meal_plan_assignments
        where client_id in (select id from public.clients where email = auth.email())
      )
    )
  );

-- meal_plan_foods (option_id -> meal_plan_meal_options -> meal -> template) -
drop policy if exists "coaches manage workspace meal_plan_foods" on public.meal_plan_foods;
create policy "coaches manage workspace meal_plan_foods" on public.meal_plan_foods
  for all using (
    option_id in (
      select o.id from public.meal_plan_meal_options o
      join public.meal_plan_meals m on m.id = o.meal_id
      join public.meal_plan_templates t on t.id = m.template_id
      where t.workspace_id in (select workspace_id from public.profiles where id = auth.uid())
    )
  );

drop policy if exists "clients read own meal_plan_foods" on public.meal_plan_foods;
create policy "clients read own meal_plan_foods" on public.meal_plan_foods
  for select using (
    option_id in (
      select o.id from public.meal_plan_meal_options o
      join public.meal_plan_meals m on m.id = o.meal_id
      where m.template_id in (
        select template_id from public.meal_plan_assignments
        where client_id in (select id from public.clients where email = auth.email())
      )
    )
  );

-- workout_programs (has workspace_id + client_id) --------------------------
drop policy if exists "coaches manage workspace workout_programs" on public.workout_programs;
create policy "coaches manage workspace workout_programs" on public.workout_programs
  for all using (
    workspace_id in (select workspace_id from public.profiles where id = auth.uid())
  );

drop policy if exists "clients read own workout_programs" on public.workout_programs;
create policy "clients read own workout_programs" on public.workout_programs
  for select using (
    client_id in (select id from public.clients where email = auth.email())
  );

-- workout_program_days (program_id -> workout_programs) --------------------
drop policy if exists "coaches manage workspace workout_program_days" on public.workout_program_days;
create policy "coaches manage workspace workout_program_days" on public.workout_program_days
  for all using (
    program_id in (
      select id from public.workout_programs
      where workspace_id in (select workspace_id from public.profiles where id = auth.uid())
    )
  );

drop policy if exists "clients read own workout_program_days" on public.workout_program_days;
create policy "clients read own workout_program_days" on public.workout_program_days
  for select using (
    program_id in (
      select id from public.workout_programs
      where client_id in (select id from public.clients where email = auth.email())
    )
  );

-- workout_templates (has workspace_id) -------------------------------------
drop policy if exists "coaches manage workspace workout_templates" on public.workout_templates;
create policy "coaches manage workspace workout_templates" on public.workout_templates
  for all using (
    workspace_id in (select workspace_id from public.profiles where id = auth.uid())
  );

drop policy if exists "clients read assigned workout_templates" on public.workout_templates;
create policy "clients read assigned workout_templates" on public.workout_templates
  for select using (
    id in (
      select td.template_id
      from public.workout_program_days pd
      join public.workout_programs p on p.id = pd.program_id
      join public.workout_template_days td on td.id = pd.template_day_id
      join public.clients c on c.id = p.client_id
      where c.email = auth.email() and p.is_active = true
    )
  );

-- workout_template_exercises (template_day_id -> workout_template_days) -----
drop policy if exists "coaches manage workspace workout_template_exercises" on public.workout_template_exercises;
create policy "coaches manage workspace workout_template_exercises" on public.workout_template_exercises
  for all using (
    template_day_id in (
      select td.id from public.workout_template_days td
      join public.workout_templates t on t.id = td.template_id
      where t.workspace_id in (select workspace_id from public.profiles where id = auth.uid())
    )
  );

drop policy if exists "clients read own workout_template_exercises" on public.workout_template_exercises;
create policy "clients read own workout_template_exercises" on public.workout_template_exercises
  for select using (
    template_day_id in (
      select pd.template_day_id
      from public.workout_program_days pd
      join public.workout_programs p on p.id = pd.program_id
      join public.clients c on c.id = p.client_id
      where c.email = auth.email() and p.is_active = true
    )
  );

-- workout_template_exercise_sets (template_exercise_id -> exercises -> ...) -
drop policy if exists "coaches manage workspace workout_template_exercise_sets" on public.workout_template_exercise_sets;
create policy "coaches manage workspace workout_template_exercise_sets" on public.workout_template_exercise_sets
  for all using (
    template_exercise_id in (
      select te.id from public.workout_template_exercises te
      join public.workout_template_days td on td.id = te.template_day_id
      join public.workout_templates t on t.id = td.template_id
      where t.workspace_id in (select workspace_id from public.profiles where id = auth.uid())
    )
  );

drop policy if exists "clients read own workout_template_exercise_sets" on public.workout_template_exercise_sets;
create policy "clients read own workout_template_exercise_sets" on public.workout_template_exercise_sets
  for select using (
    template_exercise_id in (
      select te.id
      from public.workout_template_exercises te
      join public.workout_program_days pd on pd.template_day_id = te.template_day_id
      join public.workout_programs p on p.id = pd.program_id
      join public.clients c on c.id = p.client_id
      where c.email = auth.email() and p.is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Pin search_path on trigger functions (was role-mutable)
-- ---------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = '';
alter function public.update_conversation_last_message_at() set search_path = '';
alter function public.update_coach_chat_sessions_updated_at() set search_path = '';

-- ---------------------------------------------------------------------------
-- 3. Lock down SECURITY DEFINER helpers (remove the RPC endpoints)
-- ---------------------------------------------------------------------------

-- rls_auto_enable() is a maintenance helper referenced by no policy, so it can
-- be fully revoked. anon/authenticated inherit EXECUTE via the PUBLIC grant, so
-- PUBLIC must be revoked too; service_role keeps its own explicit grant.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- get_my_workspace_id() is different: the "workspace members can view profiles"
-- policy on public.profiles calls it to resolve the caller's workspace WITHOUT
-- recursing into profiles' own RLS. Policy quals DO enforce EXECUTE against the
-- querying role, so simply revoking it breaks that policy for authenticated
-- users (verified). Instead relocate it into a non-API schema: PostgREST only
-- exposes `public`, so a function in `private` is no longer callable as an RPC,
-- while the policy (repointed below) and service_role still work.
create schema if not exists private;

create or replace function private.get_my_workspace_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.profiles where id = auth.uid() limit 1;
$$;

revoke execute on function private.get_my_workspace_id() from public;
grant usage on schema private to authenticated;
grant execute on function private.get_my_workspace_id() to authenticated;

alter policy "workspace members can view profiles" on public.profiles
  using ((workspace_id = private.get_my_workspace_id()) or (id = auth.uid()));

drop function if exists public.get_my_workspace_id();
