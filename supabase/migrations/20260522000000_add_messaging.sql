-- ── conversations ─────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null references public.workspaces(id) on delete cascade,
  client_id       uuid        not null references public.clients(id) on delete cascade,
  coach_id        uuid        not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  unique (workspace_id, client_id)
);

create index if not exists conversations_workspace_id_idx on public.conversations (workspace_id);
create index if not exists conversations_client_id_idx    on public.conversations (client_id);

-- ── messages ──────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.conversations(id) on delete cascade,
  workspace_id    uuid        not null references public.workspaces(id) on delete cascade,
  sender_role     text        not null check (sender_role in ('coach', 'client')),
  body            text        not null,
  read_by_coach   boolean     not null default false,
  read_by_client  boolean     not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists messages_workspace_id_idx    on public.messages (workspace_id);
create index if not exists messages_created_at_idx      on public.messages (created_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- Coach: full access to conversations in their workspace
create policy conversations_coach_all on public.conversations
  for all
  using (
    workspace_id in (
      select workspace_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select workspace_id from public.profiles where id = auth.uid()
    )
  );

-- Client: read their own conversation
create policy conversations_client_select on public.conversations
  for select
  using (
    client_id in (
      select id from public.clients where email = auth.email()
    )
  );

-- Coach: full access to messages in their workspace
create policy messages_coach_all on public.messages
  for all
  using (
    workspace_id in (
      select workspace_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select workspace_id from public.profiles where id = auth.uid()
    )
  );

-- Client: read messages in their conversation
create policy messages_client_select on public.messages
  for select
  using (
    conversation_id in (
      select c.id from public.conversations c
      join public.clients cl on cl.id = c.client_id
      where cl.email = auth.email()
    )
  );

-- Client: insert messages (sender_role must be 'client')
create policy messages_client_insert on public.messages
  for insert
  with check (
    sender_role = 'client'
    and conversation_id in (
      select c.id from public.conversations c
      join public.clients cl on cl.id = c.client_id
      where cl.email = auth.email()
    )
  );

-- Client: update read_by_client on their conversation messages
create policy messages_client_update on public.messages
  for update
  using (
    conversation_id in (
      select c.id from public.conversations c
      join public.clients cl on cl.id = c.client_id
      where cl.email = auth.email()
    )
  )
  with check (
    conversation_id in (
      select c.id from public.conversations c
      join public.clients cl on cl.id = c.client_id
      where cl.email = auth.email()
    )
  );

-- ── Trigger: keep conversations.last_message_at in sync ──────────────────────
create or replace function public.update_conversation_last_message_at()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set    last_message_at = new.created_at
  where  id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_after_insert
after insert on public.messages
for each row execute function public.update_conversation_last_message_at();
