-- Custom PMS (CPMS) 0003: the full backlog, ported from Personal OS (migrations 0061-0065) and made workspace-based.
-- Flow: inbox -> later -> next -> now -> verifying -> done. Rejected ideas go to parked (with a reason).
-- The rules live in a trigger, so they hold for the web app, the API and anything writing through SQL:
--   * Next needs a size. Now needs a size and a spec link (bugs are exempt).
--   * Now holds at most now_cap (2) items; bugs and reopened items bypass the cap.
--   * Next holds at most next_cap (5); Verifying holds at most verifying_cap (3).
--   * Parked needs a reason. Done is reached only through Verifying.
-- Every status change is logged in backlog_events. Also adds steps ("waiting on you"), test missions and the activity feed.

-- ---------- settings (one row per workspace; the trigger falls back to the defaults when there is no row) ----------
create table public.backlog_settings (
  workspace_id   uuid primary key references public.workspaces(id) on delete cascade,
  now_cap        integer not null default 2 check (now_cap between 1 and 10),
  next_cap       integer not null default 5 check (next_cap between 1 and 50),
  verifying_cap  integer not null default 3 check (verifying_cap between 1 and 20),
  verify_days    integer not null default 7 check (verify_days between 1 and 60),
  triage_prompt  boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- items: extend the phase 1 table ----------
alter table public.backlog_items
  add column number bigint,
  add column area text,
  add column spec_link text,
  add column value smallint check (value between 1 and 3),
  add column effort smallint check (effort between 1 and 3),
  add column position double precision not null default 0,
  add column source text not null default 'web' check (source in ('web', 'claude', 'api', 'import')),
  add column reopened_count integer not null default 0,
  add column status_changed_at timestamptz not null default now(),
  add column verifying_since timestamptz,
  add column done_at timestamptz,
  add column deleted_at timestamptz;

alter table public.backlog_items add constraint backlog_items_title_len check (length(btrim(title)) between 1 and 200);
alter table public.backlog_items add constraint backlog_items_size_check check (size is null or size in ('S', 'M', 'L'));

-- Numbers (BL-1, BL-2...) count per workspace and are never reused, so the soft-deleted rows count too.
update public.backlog_items b set number = n.rn
  from (select id, row_number() over (partition by workspace_id order by created_at, id) as rn from public.backlog_items) n
  where n.id = b.id;
alter table public.backlog_items alter column number set not null;
create unique index backlog_items_number_idx on public.backlog_items (workspace_id, number);
create index backlog_items_ws_status_idx on public.backlog_items (workspace_id, status, position) where deleted_at is null;

create function public.backlog_number() returns trigger language plpgsql set search_path = public as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 0));
    select coalesce(max(i.number), 0) + 1 into new.number from public.backlog_items i where i.workspace_id = new.workspace_id;
  end if;
  return new;
end $$;
create trigger backlog_items_number before insert on public.backlog_items
  for each row execute function public.backlog_number();

-- ---------- events (history) ----------
create table public.backlog_events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id      uuid not null references public.backlog_items(id) on delete cascade,
  from_status  text,
  to_status    text not null,
  at           timestamptz not null default now(),
  by           text not null default 'user' check (by in ('user', 'claude', 'system')),
  user_id      uuid default auth.uid() references auth.users(id) on delete set null,
  note         text
);
create index on public.backlog_events (item_id, at);
create index on public.backlog_events (workspace_id, at);
create index on public.backlog_events (user_id);

-- ---------- rules (BEFORE): transitions, guards, caps, timestamps, position ----------
create function public.backlog_guard() returns trigger language plpgsql set search_path = public as $$
declare
  v_now_cap  integer;
  v_next_cap integer;
  v_ver_cap  integer;
  v_pair     text;
  v_count    integer;
  v_reopen   boolean := false;
  v_max      double precision;
begin
  new.title := btrim(new.title);

  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  v_now_cap  := coalesce((select s.now_cap       from public.backlog_settings s where s.workspace_id = new.workspace_id), 2);
  v_next_cap := coalesce((select s.next_cap      from public.backlog_settings s where s.workspace_id = new.workspace_id), 5);
  v_ver_cap  := coalesce((select s.verifying_cap from public.backlog_settings s where s.workspace_id = new.workspace_id), 3);

  if tg_op = 'INSERT' then
    if new.status not in ('inbox', 'later', 'next', 'now', 'parked') then
      raise exception 'New items can start in inbox, later, next, now or parked, not %.', new.status;
    end if;
  else
    v_pair := old.status || '>' || new.status;
    if not (v_pair = any (array[
      'inbox>later', 'inbox>next', 'inbox>now', 'inbox>parked',
      'later>next', 'later>now', 'later>parked', 'later>inbox',
      'next>now', 'next>later', 'next>parked',
      'now>verifying', 'now>next', 'now>later', 'now>parked',
      'verifying>done', 'verifying>now', 'verifying>parked',
      'done>now', 'done>parked',
      'parked>inbox', 'parked>later'
    ])) then
      raise exception 'Cannot move from % to %.', old.status, new.status;
    end if;
    v_reopen := v_pair in ('verifying>now', 'done>now');
  end if;

  -- size before next; size before now (bugs are exempt from the size and spec rules for now)
  if new.status in ('next', 'now') and new.size is null and not (new.status = 'now' and new.type = 'bug') then
    raise exception 'Set a size (S, M or L) before moving it to %.', initcap(new.status);
  end if;
  if new.status = 'now' and new.type <> 'bug' and coalesce(btrim(new.spec_link), '') = '' then
    raise exception 'Add a spec link before moving it to Now.';
  end if;

  -- caps (bugs and reopened items bypass the Now cap; moving items down is never blocked by a cap)
  if new.status = 'now' and new.type <> 'bug' and not v_reopen then
    select count(*) into v_count from public.backlog_items i
      where i.workspace_id = new.workspace_id and i.status = 'now' and i.type <> 'bug'
        and i.deleted_at is null and i.id <> new.id;
    if v_count >= v_now_cap then
      raise exception 'Now already has % items. Finish, verify or move one first.', v_now_cap;
    end if;
  end if;
  if new.status = 'next' then
    select count(*) into v_count from public.backlog_items i
      where i.workspace_id = new.workspace_id and i.status = 'next' and i.deleted_at is null and i.id <> new.id;
    if v_count >= v_next_cap then
      raise exception 'Next already has % items. Move one first.', v_next_cap;
    end if;
  end if;
  if new.status = 'verifying' then
    select count(*) into v_count from public.backlog_items i
      where i.workspace_id = new.workspace_id and i.status = 'verifying' and i.deleted_at is null and i.id <> new.id;
    if v_count >= v_ver_cap then
      raise exception 'Verifying already has % items. Mark one done or reopen it first.', v_ver_cap;
    end if;
  end if;

  if new.status = 'parked' and coalesce(btrim(new.parked_reason), '') = '' then
    raise exception 'Give a reason before parking it.';
  end if;

  -- effects
  new.status_changed_at := now();
  if new.status = 'verifying' then new.verifying_since := now(); else new.verifying_since := null; end if;
  if new.status = 'done' then new.done_at := now(); else new.done_at := null; end if;
  if new.status <> 'parked' then new.parked_reason := null; end if;
  if v_reopen then new.reopened_count := coalesce(old.reopened_count, 0) + 1; end if;

  -- a moved (or new) item goes to the bottom of its column unless the caller set a position
  if (tg_op = 'INSERT' and new.position = 0) or (tg_op = 'UPDATE' and new.position = old.position) then
    select coalesce(max(i.position), 0) into v_max from public.backlog_items i
      where i.workspace_id = new.workspace_id and i.status = new.status and i.deleted_at is null and i.id <> new.id;
    new.position := v_max + 1;
  end if;

  return new;
end $$;

-- ---------- history (AFTER) ----------
create function public.backlog_log() returns trigger language plpgsql set search_path = public as $$
declare
  v_by   text := coalesce(nullif(current_setting('app.backlog_by', true), ''), 'user');
  v_note text := nullif(current_setting('app.backlog_note', true), '');
begin
  if v_by not in ('user', 'claude', 'system') then v_by := 'user'; end if;
  if tg_op = 'INSERT' then
    insert into public.backlog_events (workspace_id, item_id, from_status, to_status, by, note)
      values (new.workspace_id, new.id, null, new.status, v_by, v_note);
  elsif new.status is distinct from old.status then
    insert into public.backlog_events (workspace_id, item_id, from_status, to_status, by, note)
      values (new.workspace_id, new.id, old.status, new.status, v_by, v_note);
  end if;
  return null;
end $$;

create trigger backlog_items_guard before insert or update on public.backlog_items
  for each row execute function public.backlog_guard();
create trigger backlog_items_log after insert or update on public.backlog_items
  for each row execute function public.backlog_log();
create trigger set_updated_at before update on public.backlog_settings
  for each row execute function public.set_updated_at();

-- ---------- Claude's activity feed: what Claude is doing and did ----------
create table public.backlog_activity (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id      uuid references public.backlog_items(id) on delete cascade,
  work_id      uuid,
  kind         text not null check (kind in ('start', 'update', 'finish', 'blocked', 'note', 'decision')),
  text         text not null,
  by           text not null default 'claude',
  at           timestamptz not null default now()
);
create index on public.backlog_activity (workspace_id, at desc);
create index on public.backlog_activity (item_id);

-- ---------- steps: "waiting on you" (things done outside the app: run a migration, upload, add keys) ----------
create table public.backlog_steps (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id      uuid references public.backlog_items(id) on delete set null,
  kind         text not null default 'other' check (kind in ('migration', 'publish', 'keys', 'other')),
  title        text not null,
  detail       text,
  ref          text,
  status       text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  check_result text not null default 'unchecked' check (check_result in ('unchecked', 'verified', 'mismatch')),
  check_note   text,
  asked_at     timestamptz not null default now(),
  done_at      timestamptz,
  done_by      text check (done_by in ('user', 'claude', 'system')),
  deleted_at   timestamptz
);
create index on public.backlog_steps (workspace_id, status, asked_at desc);
create index on public.backlog_steps (item_id);

-- ---------- tests: test missions for the user, auto-detected when the feature is used ----------
create table public.backlog_tests (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id      uuid references public.backlog_items(id) on delete set null,
  title        text not null,
  how_to       text not null,
  probe        text check (probe is null or probe ~ '^tprobe_[a-z0-9_]+$'),
  status       text not null default 'pending' check (status in ('pending', 'detected', 'worked', 'problem', 'skipped')),
  since        timestamptz not null default now(),
  detected_at  timestamptz,
  answered_at  timestamptz,
  problem_note text,
  bug_item_id  uuid references public.backlog_items(id) on delete set null,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on public.backlog_tests (workspace_id, status, created_at);
create index on public.backlog_tests (item_id);
create index on public.backlog_tests (bug_item_id);

-- Probes: tiny read-only checks that say "the user has used this feature since the mission was created".
create function public.tprobe_project_created(p_ws uuid, p_since timestamptz) returns boolean
language sql stable set search_path = public as
$$ select exists (select 1 from projects where workspace_id = p_ws and created_at > p_since) $$;
create function public.tprobe_client_created(p_ws uuid, p_since timestamptz) returns boolean
language sql stable set search_path = public as
$$ select exists (select 1 from clients where workspace_id = p_ws and created_at > p_since) $$;
create function public.tprobe_task_added(p_ws uuid, p_since timestamptz) returns boolean
language sql stable set search_path = public as
$$ select exists (select 1 from tasks where workspace_id = p_ws and created_at > p_since) $$;
create function public.tprobe_copy_made(p_ws uuid, p_since timestamptz) returns boolean
language sql stable set search_path = public as
$$ select exists (select 1 from template_copies where workspace_id = p_ws and created_at > p_since) $$;
create function public.tprobe_item_moved(p_ws uuid, p_since timestamptz) returns boolean
language sql stable set search_path = public as
$$ select exists (select 1 from backlog_events where workspace_id = p_ws and at > p_since and from_status is not null and by = 'user') $$;
create function public.tprobe_step_closed(p_ws uuid, p_since timestamptz) returns boolean
language sql stable set search_path = public as
$$ select exists (select 1 from backlog_steps where workspace_id = p_ws and done_by = 'user' and done_at > p_since and status in ('done', 'skipped')) $$;

create function public.test_run_probe(p_probe text, p_ws uuid, p_since timestamptz) returns boolean
language plpgsql set search_path = public as $$
declare ok boolean;
begin
  if p_probe is null or p_probe !~ '^tprobe_[a-z0-9_]+$' then return false; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = p_probe) then return false; end if;
  execute format('select public.%I($1, $2)', p_probe) into ok using p_ws, p_since;
  return coalesce(ok, false);
end $$;

-- ---------- RLS: members read, writers (owner and member) write ----------
do $$
declare t text;
begin
  foreach t in array array['backlog_settings', 'backlog_events', 'backlog_activity', 'backlog_steps', 'backlog_tests']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write(workspace_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write(workspace_id)) with check (public.can_write(workspace_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write(workspace_id))', t || '_delete', t);
  end loop;
end $$;

-- ---------- helpers for Claude (and anything else writing through SQL) ----------
-- With no workspace given they use the signed-in user's, or the oldest workspace.
create function public.backlog_ws(p_ws uuid default null) returns uuid language sql stable set search_path = public as
$$ select coalesce(p_ws, (select m.workspace_id from workspace_members m where m.user_id = auth.uid() order by m.created_at limit 1), (select w.id from workspaces w order by w.created_at limit 1)) $$;

create function public.backlog_add(
  p_title text, p_type text default 'feature', p_source text default 'claude', p_status text default 'inbox',
  p_area text default null, p_notes text default null, p_parked_reason text default null, p_ws uuid default null
) returns public.backlog_items language plpgsql set search_path = public as $$
declare r public.backlog_items;
begin
  perform set_config('app.backlog_by', case when p_source in ('claude', 'import', 'api') then 'claude' else 'user' end, true);
  insert into public.backlog_items (workspace_id, title, type, status, source, area, notes, parked_reason)
    values (public.backlog_ws(p_ws), p_title, p_type, p_status, p_source, p_area, p_notes, p_parked_reason)
    returning * into r;
  return r;
end $$;

create function public.backlog_move(
  p_number bigint, p_status text, p_by text default 'claude', p_note text default null,
  p_reason text default null, p_size text default null, p_spec_link text default null, p_ws uuid default null
) returns public.backlog_items language plpgsql set search_path = public as $$
declare r public.backlog_items;
begin
  perform set_config('app.backlog_by', p_by, true);
  perform set_config('app.backlog_note', coalesce(p_note, ''), true);
  update public.backlog_items
     set status = p_status,
         parked_reason = coalesce(p_reason, parked_reason),
         size = coalesce(p_size, size),
         spec_link = coalesce(p_spec_link, spec_link)
   where workspace_id = public.backlog_ws(p_ws) and number = p_number and deleted_at is null
   returning * into r;
  if not found then raise exception 'BL-% not found.', p_number; end if;
  return r;
end $$;

create function public.step_ask(p_title text, p_kind text default 'other', p_detail text default null, p_number bigint default null, p_ref text default null, p_ws uuid default null)
returns public.backlog_steps language plpgsql set search_path = public as $$
declare v_ws uuid := public.backlog_ws(p_ws); v_item uuid; r public.backlog_steps;
begin
  if p_number is not null then select id into v_item from public.backlog_items where workspace_id = v_ws and number = p_number and deleted_at is null; end if;
  insert into public.backlog_steps (workspace_id, item_id, kind, title, detail, ref) values (v_ws, v_item, p_kind, p_title, p_detail, p_ref) returning * into r;
  return r;
end $$;

create function public.step_done(p_id uuid, p_by text default 'user', p_check text default 'unchecked', p_note text default null)
returns public.backlog_steps language plpgsql set search_path = public as $$
declare r public.backlog_steps;
begin
  update public.backlog_steps set status = 'done', done_at = now(), done_by = p_by, check_result = p_check, check_note = coalesce(p_note, check_note)
   where id = p_id and deleted_at is null returning * into r;
  return r;
end $$;

create function public.test_add(p_title text, p_how_to text, p_probe text default null, p_number bigint default null, p_ws uuid default null)
returns public.backlog_tests language plpgsql set search_path = public as $$
declare v_ws uuid := public.backlog_ws(p_ws); v_item uuid; r public.backlog_tests;
begin
  if p_number is not null then select id into v_item from public.backlog_items where workspace_id = v_ws and number = p_number and deleted_at is null; end if;
  insert into public.backlog_tests (workspace_id, item_id, title, how_to, probe) values (v_ws, v_item, p_title, p_how_to, p_probe) returning * into r;
  return r;
end $$;

create function public.activity_log(p_kind text, p_text text, p_number bigint default null, p_work uuid default null, p_ws uuid default null)
returns public.backlog_activity language plpgsql set search_path = public as $$
declare v_ws uuid := public.backlog_ws(p_ws); v_item uuid; r public.backlog_activity;
begin
  if p_number is not null then select id into v_item from public.backlog_items where workspace_id = v_ws and number = p_number and deleted_at is null; end if;
  insert into public.backlog_activity (workspace_id, item_id, work_id, kind, text) values (v_ws, v_item, p_work, p_kind, p_text) returning * into r;
  return r;
end $$;

-- The helpers are for the SQL editor and the service role, not for the browser API.
revoke execute on function
  public.backlog_ws(uuid), public.backlog_add(text, text, text, text, text, text, text, uuid),
  public.backlog_move(bigint, text, text, text, text, text, text, uuid),
  public.step_ask(text, text, text, bigint, text, uuid), public.step_done(uuid, text, text, text),
  public.test_add(text, text, text, bigint, uuid), public.activity_log(text, text, bigint, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.test_run_probe(text, uuid, timestamptz) to authenticated;
revoke execute on function public.test_run_probe(text, uuid, timestamptz) from public, anon;

-- ---------- view for reading the board at the start of a session ----------
create view public.backlog_overview with (security_invoker = true) as
select
  i.id, i.workspace_id, i.number, 'BL-' || i.number as code, i.title, i.type, i.status, i.size, i.area, i.spec_link,
  i.position, i.reopened_count,
  floor(extract(epoch from (now() - i.status_changed_at)) / 86400)::integer as days_in_status,
  (i.status = 'verifying' and i.verifying_since is not null
    and now() - i.verifying_since >= make_interval(days => coalesce(
          (select s.verify_days from public.backlog_settings s where s.workspace_id = i.workspace_id), 7))) as verify_due
from public.backlog_items i
where i.deleted_at is null;

-- One settings row for every existing workspace; new workspaces fall back to the defaults.
insert into public.backlog_settings (workspace_id) select id from public.workspaces on conflict do nothing;
