-- Selecta Labs admin dashboard: database setup.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- It is safe to run again.

-- ---------- Admins ----------
create table if not exists public.admins (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);

insert into public.admins (email) values
  ('mohamed547754@gmail.com'),
  ('mymhelmy80@gmail.com')
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table public.admins enable row level security;
drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select to authenticated using (public.is_admin());
drop policy if exists admins_write on public.admins;
create policy admins_write on public.admins for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Sites ----------
create table if not exists public.sites (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  url text not null,
  created_at timestamptz not null default now()
);

insert into public.sites (id, name, url) values
  ('selectaai', 'Selecta AI', 'https://selectalabs.github.io/selectaai/'),
  ('askadb', 'AskaDB', 'https://selectalabs.github.io/askadb/'),
  ('toolecta', 'Toolecta', 'https://selectalabs.github.io/toolecta/'),
  ('home', 'Selecta Labs', 'https://selectalabs.github.io/')
on conflict (id) do nothing;

alter table public.sites enable row level security;
drop policy if exists sites_read on public.sites;
create policy sites_read on public.sites for select to anon, authenticated using (true);
drop policy if exists sites_write on public.sites;
create policy sites_write on public.sites for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Ads ----------
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  site_id text references public.sites (id) on delete cascade,   -- null = every site
  slot text not null default 'top' check (slot in ('top', 'inline', 'bottom')),
  kind text not null check (kind in ('image', 'text', 'html')),
  title text check (char_length(title) <= 120),
  body text check (char_length(body) <= 400),
  button_text text check (char_length(button_text) <= 40),
  image_url text,
  link_url text check (link_url is null or link_url ~ '^https?://'),
  html text check (char_length(html) <= 20000),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ads_site_slot on public.ads (site_id, slot);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists ads_touch on public.ads;
create trigger ads_touch before update on public.ads for each row execute function public.touch_updated_at();

alter table public.ads enable row level security;
-- Visitors only see ads that are on and inside their date window.
drop policy if exists ads_public_read on public.ads;
create policy ads_public_read on public.ads for select to anon, authenticated
  using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
drop policy if exists ads_admin_all on public.ads;
create policy ads_admin_all on public.ads for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Events (site visits, ad views, ad clicks) ----------
create table if not exists public.events (
  id bigint generated always as identity primary key,
  site_id text not null references public.sites (id) on delete cascade,
  type text not null check (type in ('view', 'ad_view', 'ad_click')),
  ad_id uuid references public.ads (id) on delete set null,
  path text check (char_length(path) <= 300),
  referrer text check (char_length(referrer) <= 300),
  visitor text check (char_length(visitor) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists events_site_time on public.events (site_id, created_at);
create index if not exists events_ad on public.events (ad_id) where ad_id is not null;

alter table public.events enable row level security;
-- Anyone can add an event (that is how visits are counted). Only admins can read them.
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to anon, authenticated with check (true);
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated using (public.is_admin());

-- Daily totals per site (respects the admin-only read rule above).
create or replace view public.site_daily with (security_invoker = on) as
select
  site_id,
  (created_at at time zone 'Africa/Cairo')::date as day,
  count(*) filter (where type = 'view') as views,
  count(distinct visitor) filter (where type = 'view') as visitors,
  count(*) filter (where type = 'ad_view') as ad_views,
  count(*) filter (where type = 'ad_click') as ad_clicks
from public.events
group by 1, 2;

-- Totals per ad.
create or replace view public.ad_totals with (security_invoker = on) as
select
  ad_id,
  count(*) filter (where type = 'ad_view') as views,
  count(*) filter (where type = 'ad_click') as clicks,
  max(created_at) as last_seen
from public.events
where ad_id is not null
group by 1;

-- ---------- Daily snapshots (written by GitHub Actions) ----------
create table if not exists public.snapshots (
  day date primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.snapshots enable row level security;
drop policy if exists snapshots_read on public.snapshots;
create policy snapshots_read on public.snapshots for select to authenticated using (public.is_admin());
-- Writes come from GitHub Actions with the service role key, which skips these rules.

-- ---------- Storage for ad images ----------
insert into storage.buckets (id, name, public)
values ('ad-images', 'ad-images', true)
on conflict (id) do nothing;

drop policy if exists ad_images_admin_insert on storage.objects;
create policy ad_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-images' and public.is_admin());
drop policy if exists ad_images_admin_update on storage.objects;
create policy ad_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'ad-images' and public.is_admin());
drop policy if exists ad_images_admin_delete on storage.objects;
create policy ad_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ad-images' and public.is_admin());

-- ---------- Grants ----------
grant usage on schema public to anon, authenticated;
grant select on public.sites, public.ads to anon;
grant insert on public.events to anon;
grant select, insert, update, delete on public.admins, public.sites, public.ads, public.events, public.snapshots to authenticated;
grant select on public.site_daily, public.ad_totals to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
