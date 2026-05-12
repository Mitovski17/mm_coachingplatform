create table if not exists ai_digests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  week_start_date date not null,
  summary text not null,
  wins jsonb not null default '[]',
  concerns jsonb not null default '[]',
  actions jsonb not null default '[]',
  suggested_response text not null,
  rag_status text not null check (rag_status in ('red', 'yellow', 'green')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, week_start_date)
);

create index if not exists ai_digests_client_id_idx on ai_digests (client_id);
create index if not exists ai_digests_workspace_id_idx on ai_digests (workspace_id);
