-- Stubs so the CPMS migrations can run on a plain scratch Postgres (no Supabase). Used only by scripts/test-backlog-sql.mjs.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text, created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false);
grant usage on schema public, auth to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
-- numbering helper for the filler rows (they are inserted with the triggers switched off)
create or replace function public.test_nn(w uuid) returns bigint language plpgsql as
$$ begin return (select coalesce(max(number), 0) + 1 from public.backlog_items where workspace_id = w); end $$;
