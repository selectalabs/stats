-- Selecta Labs: anonymous in-app usage (AskaDB first). Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run again.
--
-- What apps send (only when the user turned "anonymous usage statistics" on):
--   a random install id (not linked to a person), the app version, channel (store/installer), Windows version,
--   one 'active' row per day the app is opened, and one 'counts' row per finished day with feature counters
--   and data source TYPES (e.g. postgres, excel, odoo). Never names, emails, SQL, questions, table names or data.

create table if not exists public.app_usage (
  id bigint generated always as identity primary key,
  app text not null check (app ~ '^[a-z0-9-]{2,30}$'),
  install_id uuid not null,
  day date not null,
  kind text not null check (kind in ('active', 'counts')),
  version text check (version ~ '^[0-9A-Za-z.+-]{1,20}$'),
  channel text check (channel in ('store', 'installer', 'dev', 'other')),
  os text check (char_length(os) <= 40),
  sessions int not null default 0 check (sessions between 0 and 500),
  counts jsonb not null default '{}'::jsonb check (jsonb_typeof(counts) = 'object' and pg_column_size(counts) <= 1500),
  sources text[] not null default '{}' check (cardinality(sources) <= 12),
  created_at timestamptz not null default now(),
  unique (app, install_id, day, kind)
);
create index if not exists app_usage_app_day on public.app_usage (app, day);

alter table public.app_usage enable row level security;
-- Apps may only add rows for recent days. Nobody but admins can read; nobody can change or delete through the API.
drop policy if exists app_usage_insert on public.app_usage;
create policy app_usage_insert on public.app_usage for insert to anon, authenticated
  with check (day between (now() at time zone 'utc')::date - 8 and (now() at time zone 'utc')::date + 1);
drop policy if exists app_usage_read on public.app_usage;
create policy app_usage_read on public.app_usage for select to authenticated using (public.is_admin());

-- Column grants: the anon role can insert only these columns (id and created_at are set by the database).
revoke all on public.app_usage from anon;
grant insert (app, install_id, day, kind, version, channel, os, sessions, counts, sources) on public.app_usage to anon;
grant select on public.app_usage to authenticated;
