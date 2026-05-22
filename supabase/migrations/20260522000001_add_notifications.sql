create table public.notifications (
  id             uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        not null references public.workspaces(id) on delete cascade,
  recipient_type text        not null check (recipient_type in ('coach', 'client')),
  recipient_id   uuid        not null,
  -- 'coach' => profiles.id  |  'client' => clients.id  (polymorphic, no FK)
  type           text        not null,
  title          text        not null,
  body           text        not null default '',
  link           text        not null default '/',
  read           boolean     not null default false,
  created_at     timestamptz not null default now()
);

create index notifications_coach_idx
  on public.notifications (recipient_id, created_at desc)
  where recipient_type = 'coach';

create index notifications_client_idx
  on public.notifications (recipient_id, created_at desc)
  where recipient_type = 'client';

create index notifications_workspace_idx
  on public.notifications (workspace_id);

alter table public.notifications enable row level security;

-- Coaches can read their own notifications
create policy notifications_coach_select on public.notifications
  for select
  using (
    recipient_type = 'coach'
    and recipient_id = auth.uid()
  );

-- Coaches can mark their own notifications as read
create policy notifications_coach_update on public.notifications
  for update
  using (
    recipient_type = 'coach'
    and recipient_id = auth.uid()
  )
  with check (
    recipient_type = 'coach'
    and recipient_id = auth.uid()
  );

-- Clients can read their own notifications
create policy notifications_client_select on public.notifications
  for select
  using (
    recipient_type = 'client'
    and exists (
      select 1 from public.clients
      where id = recipient_id
        and email = auth.jwt() ->> 'email'
    )
  );

-- Clients can mark their own notifications as read
create policy notifications_client_update on public.notifications
  for update
  using (
    recipient_type = 'client'
    and exists (
      select 1 from public.clients
      where id = recipient_id
        and email = auth.jwt() ->> 'email'
    )
  )
  with check (
    recipient_type = 'client'
    and exists (
      select 1 from public.clients
      where id = recipient_id
        and email = auth.jwt() ->> 'email'
    )
  );

-- No INSERT policy: service role (used in all server actions) bypasses RLS

-- Enable Realtime broadcasting for this table
alter publication supabase_realtime add table public.notifications;
