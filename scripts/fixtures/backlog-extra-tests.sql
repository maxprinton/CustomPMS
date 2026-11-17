-- Extra tests beyond the shared scenario table. __U__ / __W__ are replaced by the runner with the test user and workspace.
-- Each block raises an exception when something is wrong; a passing block prints "EXTRA|<name>|ok".
\set ON_ERROR_STOP on

-- 1. backlog_add puts one sentence into the Inbox, logged as claude; the title is trimmed and an empty one is rejected
do $$
declare a public.backlog_items; v_by text;
begin
  delete from public.backlog_events; delete from public.backlog_items;
  a := public.backlog_add('  Try the thing  ', p_ws => __W__);
  if a.status <> 'inbox' or a.source <> 'claude' or a.number <> 1 or a.title <> 'Try the thing' then raise exception 'backlog_add wrong: %', a; end if;
  select by into v_by from public.backlog_events where item_id = a.id;
  if v_by <> 'claude' then raise exception 'event by should be claude, got %', v_by; end if;
  begin
    perform public.backlog_add('   ', p_ws => __W__);
    raise exception 'empty title was accepted';
  exception when check_violation then null; end;
  raise notice 'EXTRA|add, trim and log|ok';
end $$;

-- 2. BL numbers count per workspace and are never reused
do $$
declare a public.backlog_items; b public.backlog_items; c public.backlog_items; w2 uuid; u2 uuid := '00000000-0000-0000-0000-0000000000b2';
begin
  delete from public.backlog_events; delete from public.backlog_items;
  insert into auth.users (id, email) values (u2, 'b@example.com');
  select workspace_id into w2 from public.workspace_members where user_id = u2;
  a := public.backlog_add('first', p_ws => __W__);
  b := public.backlog_add('second', p_ws => __W__);
  c := public.backlog_add('other workspace', p_ws => w2);
  if a.number <> 1 or b.number <> 2 then raise exception 'numbers wrong: % %', a.number, b.number; end if;
  if c.number <> 1 then raise exception 'the other workspace should start at BL-1, got %', c.number; end if;
  update public.backlog_items set deleted_at = now() where id = b.id;
  b := public.backlog_add('third', p_ws => __W__);
  if b.number <> 3 then raise exception 'a deleted number must not be reused, got %', b.number; end if;
  begin
    update public.backlog_items set number = 1 where id = b.id;
    raise exception 'duplicate number accepted';
  exception when unique_violation then null; end;
  raise notice 'EXTRA|numbers per workspace|ok';
end $$;

-- 3. moves, timestamps, reopen and events
do $$
declare a public.backlog_items; b public.backlog_items; ev int; pos double precision;
begin
  delete from public.backlog_events; delete from public.backlog_items;
  a := public.backlog_add('First', p_ws => __W__);
  b := public.backlog_add('Second', p_ws => __W__);
  if b.position <= a.position then raise exception 'second item should be below the first'; end if;
  a := public.backlog_move(a.number, 'next', 'user', null, null, 'S', null, __W__);
  a := public.backlog_move(a.number, 'now', 'claude', 'starting', null, null, 'docs/SPEC.md', __W__);
  if a.status <> 'now' then raise exception 'not in now'; end if;
  a := public.backlog_move(a.number, 'verifying', p_ws => __W__);
  if a.verifying_since is null then raise exception 'verifying_since not set'; end if;
  a := public.backlog_move(a.number, 'done', p_ws => __W__);
  if a.done_at is null or a.verifying_since is not null then raise exception 'done timestamps wrong'; end if;
  select count(*) into ev from public.backlog_events where item_id = a.id;
  if ev <> 5 then raise exception 'expected 5 events (insert + 4 moves), got %', ev; end if;
  a := public.backlog_move(a.number, 'now', p_ws => __W__);
  if a.reopened_count <> 1 or a.done_at is not null then raise exception 'reopen wrong: %', a; end if;
  if not exists (select 1 from public.backlog_events where item_id = a.id and note = 'starting' and by = 'claude') then
    raise exception 'event with note/by missing';
  end if;
  raise notice 'EXTRA|moves, timestamps, reopen, events|ok';
end $$;

-- 4. parked reason is kept while parked and cleared on leaving; a missing item is reported
do $$
declare a public.backlog_items;
begin
  delete from public.backlog_events; delete from public.backlog_items;
  a := public.backlog_add('Park me', p_ws => __W__);
  a := public.backlog_move(a.number, 'parked', 'user', null, 'Not now', null, null, __W__);
  if a.parked_reason <> 'Not now' then raise exception 'reason not saved'; end if;
  a := public.backlog_move(a.number, 'later', p_ws => __W__);
  if a.parked_reason is not null then raise exception 'reason should clear when leaving parked'; end if;
  begin
    perform public.backlog_move(999999, 'later', p_ws => __W__);
    raise exception 'missing item was accepted';
  exception when others then
    if sqlerrm not like 'BL-999999 not found.' then raise; end if;
  end;
  raise notice 'EXTRA|parked reason and missing item|ok';
end $$;

-- 5. the real-use check becomes due after verify_days (default 7, per workspace)
do $$
declare a public.backlog_items; due boolean;
begin
  delete from public.backlog_events; delete from public.backlog_items; delete from public.backlog_settings;
  a := public.backlog_add('Check me', 'bug', p_ws => __W__);
  a := public.backlog_move(a.number, 'now', p_ws => __W__);
  a := public.backlog_move(a.number, 'verifying', p_ws => __W__);
  select verify_due into due from public.backlog_overview where id = a.id;
  if due then raise exception 'should not be due yet'; end if;
  update public.backlog_items set verifying_since = now() - interval '8 days' where id = a.id;
  select verify_due into due from public.backlog_overview where id = a.id;
  if not due then raise exception 'should be due after 8 days (default 7)'; end if;
  insert into public.backlog_settings (workspace_id, verify_days) values (__W__, 10);
  select verify_due into due from public.backlog_overview where id = a.id;
  if due then raise exception 'should not be due with verify_days = 10'; end if;
  delete from public.backlog_settings;
  raise notice 'EXTRA|verify due|ok';
end $$;

-- 6. bugs do not count toward the Now cap, and a custom cap from the settings row is used
do $$
declare a public.backlog_items;
begin
  delete from public.backlog_events; delete from public.backlog_items; delete from public.backlog_settings;
  perform public.backlog_move((public.backlog_add('bug 1', 'bug', p_ws => __W__)).number, 'now', p_ws => __W__);
  perform public.backlog_move((public.backlog_add('bug 2', 'bug', p_ws => __W__)).number, 'now', p_ws => __W__);
  perform public.backlog_move((public.backlog_add('bug 3', 'bug', p_ws => __W__)).number, 'now', p_ws => __W__);
  a := public.backlog_add('feature A', p_ws => __W__);
  a := public.backlog_move(a.number, 'next', 'user', null, null, 'S', null, __W__);
  a := public.backlog_move(a.number, 'now', 'user', null, null, null, 'docs/a.md', __W__);
  if a.status <> 'now' then raise exception 'feature should enter Now next to 3 bugs'; end if;
  insert into public.backlog_settings (workspace_id, now_cap) values (__W__, 1);
  a := public.backlog_add('feature B', p_ws => __W__);
  a := public.backlog_move(a.number, 'next', 'user', null, null, 'S', null, __W__);
  begin
    perform public.backlog_move(a.number, 'now', 'user', null, null, null, 'docs/b.md', __W__);
    raise exception 'Now cap of 1 was ignored';
  exception when others then
    if sqlerrm <> 'Now already has 1 items. Finish, verify or move one first.' then raise; end if;
  end;
  delete from public.backlog_settings;
  raise notice 'EXTRA|bugs and custom caps|ok';
end $$;

-- 7. steps ("waiting on you") and the probe that notices the user closing one
do $$
declare s public.backlog_steps; a public.backlog_items; hit boolean;
begin
  delete from public.backlog_events; delete from public.backlog_items; delete from public.backlog_steps;
  a := public.backlog_add('With a step', p_ws => __W__);
  s := public.step_ask('Run the migration', 'migration', 'Open Supabase and run it', a.number, null, __W__);
  if s.status <> 'pending' or s.item_id <> a.id then raise exception 'step_ask wrong: %', s; end if;
  begin
    perform public.step_ask('bad kind', 'nonsense', p_ws => __W__);
    raise exception 'bad step kind accepted';
  exception when check_violation then null; end;
  if public.test_run_probe('tprobe_step_closed', __W__, now() - interval '1 minute') then raise exception 'probe should be false before the step is closed'; end if;
  s := public.step_done(s.id, 'user');
  if s.status <> 'done' or s.done_at is null then raise exception 'step_done wrong: %', s; end if;
  if not public.test_run_probe('tprobe_step_closed', __W__, now() - interval '1 minute') then raise exception 'probe should be true after the user closed the step'; end if;
  raise notice 'EXTRA|steps and the step probe|ok';
end $$;

-- 8. test missions and probes: a probe only runs functions named tprobe_*, and flips when the feature is used
do $$
declare t public.backlog_tests; a public.backlog_items;
begin
  delete from public.backlog_events; delete from public.backlog_items; delete from public.backlog_tests; delete from public.projects;
  a := public.backlog_add('Feature to test', p_ws => __W__);
  t := public.test_add('Create a project', 'Open Projects and create one', 'tprobe_project_created', a.number, __W__);
  if t.status <> 'pending' or t.item_id <> a.id then raise exception 'test_add wrong: %', t; end if;
  begin
    perform public.test_add('bad probe', 'x', 'pg_sleep', p_ws => __W__);
    raise exception 'a probe not named tprobe_* was accepted';
  exception when check_violation then null; end;
  if public.test_run_probe('pg_sleep', __W__, now()) then raise exception 'pg_sleep must never run as a probe'; end if;
  if public.test_run_probe('tprobe_does_not_exist', __W__, now()) then raise exception 'unknown probe must be false'; end if;
  -- (inside one transaction now() is frozen, so the mission's own timestamp is moved back a minute)
  update public.backlog_tests set since = now() - interval '1 minute' where id = t.id;
  select * into t from public.backlog_tests where id = t.id;
  if public.test_run_probe(t.probe, __W__, t.since) then raise exception 'probe should be false before the feature is used'; end if;
  insert into public.projects (workspace_id, name) values (__W__, 'Used it');
  if not public.test_run_probe(t.probe, __W__, t.since) then raise exception 'probe should be true after the feature is used'; end if;
  update public.backlog_tests set status = 'problem', problem_note = 'x' where id = t.id;
  raise notice 'EXTRA|test missions and probes|ok';
end $$;

-- 9. RLS: members see their workspace only; viewers read but never write; the SQL helpers are closed to the browser roles
do $$
declare viewer uuid := '00000000-0000-0000-0000-0000000000c3'; stranger uuid := '00000000-0000-0000-0000-0000000000b2';
        n int; blocked boolean;
begin
  delete from public.backlog_events; delete from public.backlog_items; delete from public.backlog_steps; delete from public.backlog_tests;
  insert into auth.users (id, email) values (viewer, 'v@example.com');
  insert into public.workspace_members (workspace_id, user_id, role) values (__W__, viewer, 'viewer');
  perform public.backlog_add('visible to members', p_ws => __W__);
  perform public.step_ask('a step', p_ws => __W__);

  -- every backlog table has RLS on
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relname in ('backlog_items', 'backlog_events', 'backlog_settings', 'backlog_activity', 'backlog_steps', 'backlog_tests') and c.relrowsecurity;
  if n <> 6 then raise exception 'RLS missing on a backlog table (% of 6)', n; end if;

  -- the owner writes
  perform set_config('request.jwt.claim.sub', __U__, true);
  set local role authenticated;
  insert into public.backlog_items (workspace_id, title) values (__W__, 'owner can write');
  select count(*) into n from public.backlog_items where workspace_id = __W__;
  if n <> 2 then raise exception 'owner should see 2 items, saw %', n; end if;
  reset role;

  -- the viewer reads but cannot write
  perform set_config('request.jwt.claim.sub', viewer::text, true);
  set local role authenticated;
  select count(*) into n from public.backlog_items where workspace_id = __W__;
  if n <> 2 then raise exception 'viewer should see 2 items, saw %', n; end if;
  blocked := false;
  begin
    insert into public.backlog_items (workspace_id, title) values (__W__, 'viewer must not write');
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'a viewer was able to insert an item'; end if;
  update public.backlog_items set title = 'hacked' where workspace_id = __W__;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'a viewer was able to update % items', n; end if;
  reset role;

  -- another workspace sees nothing
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  set local role authenticated;
  select count(*) into n from public.backlog_items where workspace_id = __W__;
  if n <> 0 then raise exception 'a stranger saw % items', n; end if;
  select count(*) into n from public.backlog_steps where workspace_id = __W__;
  if n <> 0 then raise exception 'a stranger saw % steps', n; end if;
  reset role;

  -- the Claude helpers cannot be called from the browser
  if has_function_privilege('authenticated', 'public.backlog_add(text,text,text,text,text,text,text,uuid)', 'execute') then raise exception 'backlog_add is open to authenticated'; end if;
  if has_function_privilege('anon', 'public.test_run_probe(text,uuid,timestamptz)', 'execute') then raise exception 'test_run_probe is open to anon'; end if;
  raise notice 'EXTRA|rls, roles and closed helpers|ok';
end $$;
