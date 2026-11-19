-- Roles for the Selecta Labs admin dashboard. Safe to run again.
-- super_admin: everything, including managing admins
-- admin:       manage ads and sites, see all numbers
-- viewer:      see the numbers only

alter table public.admins add column if not exists role text not null default 'viewer';
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('super_admin', 'admin', 'viewer'));
update public.admins set role = 'super_admin' where email in ('mohamed547754@gmail.com', 'mymhelmy80@gmail.com');

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.admins where email = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
create or replace function public.can_edit()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('super_admin', 'admin'), false);
$$;
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'super_admin', false);
$$;
grant execute on function public.my_role(), public.can_edit(), public.is_super_admin() to authenticated;

-- Only super admins add, change or remove admins. Everyone on the team can see the list.
drop policy if exists admins_write on public.admins;
drop policy if exists admins_insert on public.admins;
drop policy if exists admins_update on public.admins;
drop policy if exists admins_delete on public.admins;
create policy admins_insert on public.admins for insert to authenticated with check (public.is_super_admin());
create policy admins_update on public.admins for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy admins_delete on public.admins for delete to authenticated using (public.is_super_admin());

-- Sites: admins and super admins edit.
drop policy if exists sites_write on public.sites;
drop policy if exists sites_insert on public.sites;
drop policy if exists sites_update on public.sites;
drop policy if exists sites_delete on public.sites;
create policy sites_insert on public.sites for insert to authenticated with check (public.can_edit());
create policy sites_update on public.sites for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy sites_delete on public.sites for delete to authenticated using (public.can_edit());

-- Ads: the whole team sees every ad; admins and super admins edit.
drop policy if exists ads_admin_all on public.ads;
drop policy if exists ads_team_read on public.ads;
drop policy if exists ads_insert on public.ads;
drop policy if exists ads_update on public.ads;
drop policy if exists ads_delete on public.ads;
create policy ads_team_read on public.ads for select to authenticated using (public.is_admin());
create policy ads_insert on public.ads for insert to authenticated with check (public.can_edit());
create policy ads_update on public.ads for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy ads_delete on public.ads for delete to authenticated using (public.can_edit());

-- Ad images: admins and super admins upload.
drop policy if exists ad_images_admin_insert on storage.objects;
drop policy if exists ad_images_admin_update on storage.objects;
drop policy if exists ad_images_admin_delete on storage.objects;
create policy ad_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-images' and public.can_edit());
create policy ad_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'ad-images' and public.can_edit());
create policy ad_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ad-images' and public.can_edit());
