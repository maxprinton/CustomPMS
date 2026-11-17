-- Phase 2: template files and filled working copies.
-- Files live in one private bucket; the app reads and writes it only from the server, after checking access.
insert into storage.buckets (id, name, public) values ('cpms-files', 'cpms-files', false) on conflict (id) do nothing;

create unique index template_files_storage_path_key on public.template_files (storage_path);

alter table public.template_copies
  add column storage_path text,
  add column file_name text,
  add column version int not null default 1,
  add column filled jsonb,
  add column filled_at timestamptz;
