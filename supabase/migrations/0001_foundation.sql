-- Custom PMS (CPMS) foundation: workspaces, roles, core PM entities, templates, backlog, ERP bridge stubs.
-- Roles: owner / member / viewer. Built-in templates (workspace_id is null) are shared read-only.

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

create function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = ws and user_id = auth.uid())
$$;

create function public.can_write(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner', 'member'))
$$;

create function public.is_owner(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role = 'owner')
$$;

revoke execute on function public.is_member(uuid), public.can_write(uuid), public.is_owner(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.can_write(uuid), public.is_owner(uuid) to authenticated;

create function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  kind text not null default 'external' check (kind in ('external', 'internal')),
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  code text,
  method text not null default 'predictive' check (method in ('predictive', 'agile', 'hybrid')),
  phase text not null default 'initiation' check (phase in ('initiation', 'planning', 'execution', 'monitoring', 'closing')),
  status text not null default 'active' check (status in ('active', 'on_hold', 'done', 'cancelled')),
  objective text,
  sponsor text,
  start_date date,
  end_date date,
  budget numeric(14, 2),
  profile jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'blocked')),
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  probability smallint check (probability between 1 and 5),
  impact smallint check (impact between 1 and 5),
  score smallint generated always as (probability * impact) stored,
  response text,
  status text not null default 'open' check (status in ('open', 'mitigated', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.backlog_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  type text not null default 'feature' check (type in ('bug', 'feature', 'improvement', 'big_idea')),
  status text not null default 'inbox' check (status in ('inbox', 'later', 'next', 'now', 'verifying', 'done', 'parked')),
  size text,
  notes text,
  parked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null default '',
  content jsonb not null default '[]'::jsonb,
  kind text not null default 'note' check (kind in ('note', 'meeting', 'decision', 'lesson')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Templates: workspace_id null = built-in, shared and read-only.
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  name_es text,
  phase text,
  method text,
  doc_type text,
  tags text[] not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index templates_code_builtin on public.templates (code) where workspace_id is null;
create unique index templates_code_ws on public.templates (workspace_id, code) where workspace_id is not null;

create table public.template_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  lang text not null check (lang in ('en', 'es')),
  role text not null default 'blank',
  storage_path text not null,
  file_name text,
  mime text,
  size bigint,
  sha256 text,
  created_at timestamptz not null default now()
);

create table public.template_copies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  lang text not null default 'en' check (lang in ('en', 'es')),
  status text not null default 'draft',
  notes text,
  source_file_id uuid references public.template_files(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tag_id, entity_type, entity_id)
);

-- V2 ERP bridge (empty for now).
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.erp_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  erp_system text not null default 'erp',
  erp_id text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, entity_type, erp_system, erp_id)
);

-- Indexes on foreign keys used for filtering.
create index on public.clients (workspace_id);
create index on public.contacts (client_id);
create index on public.contacts (workspace_id);
create index on public.projects (workspace_id, client_id);
create index on public.projects (client_id);
create index on public.tasks (project_id);
create index on public.tasks (workspace_id);
create index on public.milestones (project_id);
create index on public.milestones (workspace_id);
create index on public.risks (project_id);
create index on public.risks (workspace_id);
create index on public.backlog_items (workspace_id, status);
create index on public.backlog_items (project_id);
create index on public.notes (workspace_id, project_id);
create index on public.notes (client_id);
create index on public.notes (project_id);
create index on public.templates (workspace_id);
create index on public.template_files (template_id);
create index on public.template_files (workspace_id);
create index on public.template_copies (workspace_id, project_id);
create index on public.template_copies (template_id);
create index on public.template_copies (project_id);
create index on public.template_copies (client_id);
create index on public.template_copies (source_file_id);
create index on public.tags (workspace_id);
create index on public.links (workspace_id);
create index on public.links (entity_type, entity_id);
create index on public.api_keys (workspace_id);
create index on public.api_keys (created_by);
create index on public.erp_links (workspace_id);
create index on public.erp_links (entity_type, entity_id);

-- updated_at triggers.
do $$
declare t text;
begin
  foreach t in array array['clients','contacts','projects','tasks','milestones','risks','backlog_items','notes','templates','template_copies']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Row level security.
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy workspaces_select on public.workspaces for select to authenticated using (public.is_member(id));
create policy workspaces_update on public.workspaces for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));

create policy members_select on public.workspace_members for select to authenticated using (public.is_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated with check (public.is_owner(workspace_id));
create policy members_update on public.workspace_members for update to authenticated using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
create policy members_delete on public.workspace_members for delete to authenticated using (public.is_owner(workspace_id));

do $$
declare t text;
begin
  foreach t in array array['clients','contacts','projects','tasks','milestones','risks','backlog_items','notes','template_copies','tags','links','erp_links']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write(workspace_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write(workspace_id)) with check (public.can_write(workspace_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write(workspace_id))', t || '_delete', t);
  end loop;
end $$;

-- Templates and files: built-in rows (workspace_id null) readable by everyone signed in, never writable from the app.
do $$
declare t text;
begin
  foreach t in array array['templates','template_files']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (workspace_id is null or public.is_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (workspace_id is not null and public.can_write(workspace_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (workspace_id is not null and public.can_write(workspace_id)) with check (workspace_id is not null and public.can_write(workspace_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (workspace_id is not null and public.can_write(workspace_id))', t || '_delete', t);
  end loop;
end $$;

-- API keys: owners only.
alter table public.api_keys enable row level security;
create policy api_keys_select on public.api_keys for select to authenticated using (public.is_owner(workspace_id));
create policy api_keys_insert on public.api_keys for insert to authenticated with check (public.is_owner(workspace_id));
create policy api_keys_update on public.api_keys for update to authenticated using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
create policy api_keys_delete on public.api_keys for delete to authenticated using (public.is_owner(workspace_id));

-- On sign-up: create a workspace and make the new user its owner.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  insert into public.workspaces (name) values ('My workspace') returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner');
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
