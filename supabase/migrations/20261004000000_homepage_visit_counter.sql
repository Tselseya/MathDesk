-- Aggregate all-time homepage page loads without storing IP addresses or visitor identifiers.
-- Apply this migration to the Supabase project before deploying the counter-enabled frontend.

create table if not exists public.homepage_visit_counter (
  id smallint primary key default 1 check (id = 1),
  total_visits bigint not null default 0 check (total_visits >= 0),
  updated_at timestamptz not null default pg_catalog.now()
);

insert into public.homepage_visit_counter (id, total_visits)
values (1, 0)
on conflict (id) do nothing;

alter table public.homepage_visit_counter enable row level security;
revoke all on table public.homepage_visit_counter from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

create or replace function public.increment_homepage_visit_count()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_total bigint;
begin
  insert into public.homepage_visit_counter as counter (id, total_visits, updated_at)
  values (1, 1, pg_catalog.now())
  on conflict (id) do update
    set total_visits = counter.total_visits + 1,
        updated_at = pg_catalog.now()
  returning total_visits into next_total;

  return next_total;
end;
$$;

revoke all on function public.increment_homepage_visit_count() from public;
grant execute on function public.increment_homepage_visit_count() to anon, authenticated;

comment on function public.increment_homepage_visit_count() is
  'Atomically increments and returns the all-time MathDesk homepage page-load count.';
