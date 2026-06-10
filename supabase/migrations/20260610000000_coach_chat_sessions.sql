-- Coach AI chat sessions per client
create table if not exists coach_chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references profiles(id) on delete cascade,
  workspace_id uuid not null,
  title       text not null default 'New conversation',
  messages    jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists coach_chat_sessions_client_id_idx
  on coach_chat_sessions (client_id, updated_at desc);

-- auto-update updated_at
create or replace function update_coach_chat_sessions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_coach_chat_sessions_updated_at on coach_chat_sessions;
create trigger trg_coach_chat_sessions_updated_at
  before update on coach_chat_sessions
  for each row execute procedure update_coach_chat_sessions_updated_at();

-- RLS: service role bypasses; coach reads own workspace sessions only
alter table coach_chat_sessions enable row level security;

create policy "coach_chat_sessions_workspace_select"
  on coach_chat_sessions for select
  using (
    workspace_id in (
      select workspace_id from profiles where id = auth.uid()
    )
  );

create policy "coach_chat_sessions_workspace_insert"
  on coach_chat_sessions for insert
  with check (
    workspace_id in (
      select workspace_id from profiles where id = auth.uid()
    )
  );

create policy "coach_chat_sessions_workspace_update"
  on coach_chat_sessions for update
  using (
    workspace_id in (
      select workspace_id from profiles where id = auth.uid()
    )
  );

create policy "coach_chat_sessions_workspace_delete"
  on coach_chat_sessions for delete
  using (
    workspace_id in (
      select workspace_id from profiles where id = auth.uid()
    )
  );
