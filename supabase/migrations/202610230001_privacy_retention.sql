-- Apply only after inspecting the production schema and retention impact.
begin;
-- Verified production schema: profiles.user_id is text; visits did not exist.
create table if not exists public.site_visits (
 user_id uuid not null references auth.users(id) on delete cascade,
 visit_date date not null default current_date,
 first_seen timestamptz not null default now(),
 last_seen timestamptz not null default now(),
 primary key(user_id, visit_date)
);
alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
create or replace function public.soundi_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users where id = auth.uid())
$$;
revoke all on function public.soundi_active_user() from public;
grant execute on function public.soundi_active_user() to anon, authenticated;

alter table public.songs enable row level security;
drop policy if exists "Prototype can update songs" on public.songs;
drop policy if exists "Prototype can delete songs" on public.songs;
drop policy if exists "Public can read songs" on public.songs;
drop policy if exists "Public can publish songs" on public.songs;
revoke insert, update, delete on public.songs from anon;
grant select on public.songs to anon, authenticated;
grant insert, update, delete on public.songs to authenticated;
create policy "Soundi read published or own" on public.songs for select to anon, authenticated
 using (status='published' or (owner_id=auth.uid()::text and public.soundi_active_user()));
create policy "Soundi insert own" on public.songs for insert to authenticated
 with check (owner_id=auth.uid()::text and public.soundi_active_user());
create policy "Soundi update own" on public.songs for update to authenticated
 using (owner_id=auth.uid()::text and public.soundi_active_user())
 with check (owner_id=auth.uid()::text and public.soundi_active_user());
create policy "Soundi delete own" on public.songs for delete to authenticated
 using (owner_id=auth.uid()::text and public.soundi_active_user());
-- Nickname lookup needs only these columns; do not expose Google email/name/avatar.
revoke select on public.profiles from anon, authenticated;
grant select(user_id,nickname,nickname_updated_at) on public.profiles to authenticated;
create or replace function public.soundi_delete_user_data()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.songs where owner_id = old.id::text;
  delete from public.profiles where user_id::text = old.id::text;
  delete from public.site_visits where user_id::text = old.id::text;
  return old;
end;
$$;
revoke all on function public.soundi_delete_user_data() from public, anon, authenticated;
drop trigger if exists soundi_delete_user_data on auth.users;
create trigger soundi_delete_user_data before delete on auth.users
for each row execute function public.soundi_delete_user_data();

-- Prevent a still-valid JWT from recreating data after account deletion.
create or replace function public.soundi_require_active_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor_uuid uuid := auth.uid();
begin
  -- Service-role maintenance and legacy rows retain their existing behavior.
  -- User-facing RLS still governs ownership; this additionally rejects deleted users.
  if actor_uuid is not null and not exists (select 1 from auth.users where id = actor_uuid) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.soundi_require_active_owner() from public, anon, authenticated;
drop trigger if exists soundi_require_active_owner on public.songs;
create trigger soundi_require_active_owner before insert or update on public.songs
for each row execute function public.soundi_require_active_owner();
drop trigger if exists soundi_require_active_owner on public.profiles;
create trigger soundi_require_active_owner before insert or update on public.profiles
for each row execute function public.soundi_require_active_owner();
drop trigger if exists soundi_require_active_owner on public.site_visits;
create trigger soundi_require_active_owner before insert or update on public.site_visits
for each row execute function public.soundi_require_active_owner();
create or replace function public.record_site_visit()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.soundi_active_user() then
    return;
  end if;

  insert into public.site_visits (user_id, visit_date, first_seen, last_seen)
  values (auth.uid(), current_date, now(), now())
  on conflict (user_id, visit_date)
  do update set last_seen = excluded.last_seen;
end;
$$;

revoke all on function public.record_site_visit() from public;
grant execute on function public.record_site_visit() to authenticated;

create or replace function public.dashboard_visit_stats()
returns table (
  today_visitors bigint,
  total_visitors bigint,
  revisit_rate numeric
)
language sql
security definer
set search_path = ''
as $$
  with per_user as (
    select user_id, count(distinct visit_date) as visit_days
    from public.site_visits
    group by user_id
  ),
  totals as (
    select
      count(distinct user_id) filter (where visit_date = current_date) as today_visitors,
      count(distinct user_id) as total_visitors
    from public.site_visits
  )
  select
    totals.today_visitors,
    totals.total_visitors,
    case
      when totals.total_visitors = 0 then 0
      else round((count(*) filter (where per_user.visit_days >= 2)::numeric / totals.total_visitors::numeric) * 100, 1)
    end as revisit_rate
  from totals
  left join per_user on true
  group by totals.today_visitors, totals.total_visitors;
$$;

revoke all on function public.dashboard_visit_stats() from public;
grant execute on function public.dashboard_visit_stats() to anon, authenticated;


commit;

-- Owner declined automatic visit deletion on 2026-10-23.
-- Do not schedule cron. Keep visit collection disabled until a retention
-- process is approved and deployed. Existing visit count verified as zero.
create or replace function public.record_site_visit()
returns void language plpgsql security definer set search_path = '' as $$
begin return; end;
$$;
