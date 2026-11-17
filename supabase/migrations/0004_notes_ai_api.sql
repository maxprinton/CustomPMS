-- Custom PMS (CPMS) 0004: probes for notes and tags, AI usage (daily cap), webhooks for the ERP bridge.

-- AI usage: one row per workspace per day, so the free tier is never exceeded by accident.
create table public.ai_usage (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  day          date not null default (now() at time zone 'utc')::date,
  calls        integer not null default 0 check (calls >= 0),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, day)
);
alter table public.ai_usage enable row level security;
create policy ai_usage_select on public.ai_usage for select to authenticated using (public.is_member(workspace_id));
create policy ai_usage_insert on public.ai_usage for insert to authenticated with check (public.can_write(workspace_id));
create policy ai_usage_update on public.ai_usage for update to authenticated using (public.can_write(workspace_id)) with check (public.can_write(workspace_id));
create trigger set_updated_at before update on public.ai_usage for each row execute function public.set_updated_at();

-- Webhooks: the ERP (or anything else) is told when something changes. Owners manage them; deliveries are written by the server.
create table public.webhooks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  url          text not null check (url ~ '^https://'),
  secret       text not null,
  events       text[] not null default '{}',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index on public.webhooks (workspace_id);
alter table public.webhooks enable row level security;
create policy webhooks_select on public.webhooks for select to authenticated using (public.is_owner(workspace_id));
create policy webhooks_insert on public.webhooks for insert to authenticated with check (public.is_owner(workspace_id));
create policy webhooks_update on public.webhooks for update to authenticated using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
create policy webhooks_delete on public.webhooks for delete to authenticated using (public.is_owner(workspace_id));

create table public.webhook_deliveries (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  webhook_id   uuid not null references public.webhooks(id) on delete cascade,
  event        text not null,
  status_code  integer,
  error        text,
  created_at   timestamptz not null default now()
);
create index on public.webhook_deliveries (webhook_id, created_at desc);
create index on public.webhook_deliveries (workspace_id);
alter table public.webhook_deliveries enable row level security;
create policy webhook_deliveries_select on public.webhook_deliveries for select to authenticated using (public.is_owner(workspace_id));

-- Probes for the new test missions ("the user has used this feature since the mission was created").
create function public.tprobe_note_created(p_ws uuid, p_since timestamptz) returns boolean
language sql stable set search_path = public as
$$ select exists (select 1 from notes where workspace_id = p_ws and created_at > p_since) $$;
create function public.tprobe_tag_added(p_ws uuid, p_since timestamptz) returns boolean
language sql stable set search_path = public as
$$ select exists (select 1 from links where workspace_id = p_ws and created_at > p_since) $$;
create function public.tprobe_ai_draft(p_ws uuid, p_since timestamptz) returns boolean
language sql stable set search_path = public as
$$ select exists (select 1 from ai_usage where workspace_id = p_ws and updated_at > p_since and calls > 0) $$;
create function public.tprobe_api_key_made(p_ws uuid, p_since timestamptz) returns boolean
language sql stable set search_path = public as
$$ select exists (select 1 from api_keys where workspace_id = p_ws and created_at > p_since) $$;
