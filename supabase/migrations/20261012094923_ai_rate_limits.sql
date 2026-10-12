create schema if not exists private;

create table if not exists private.ai_rate_limits (
  user_id uuid primary key,
  window_started_at timestamptz not null default now(),
  window_requests integer not null default 0,
  window_image_requests integer not null default 0,
  day date not null default current_date,
  daily_requests integer not null default 0,
  daily_image_requests integer not null default 0,
  updated_at timestamptz not null default now()
);

revoke all on table private.ai_rate_limits from public, anon, authenticated;

create or replace function public.consume_ai_rate_limit(p_user_id uuid, p_has_images boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  current_row private.ai_rate_limits%rowtype;
  current_time timestamptz := now();
  window_limit integer := 30;
  image_window_limit integer := 10;
  daily_limit integer := 3000;
  daily_image_limit integer := 400;
  retry_seconds integer := 60;
begin
  insert into private.ai_rate_limits (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into current_row from private.ai_rate_limits where user_id = p_user_id for update;

  if current_row.day <> current_time::date then
    current_row.day := current_time::date;
    current_row.daily_requests := 0;
    current_row.daily_image_requests := 0;
  end if;
  if current_time - current_row.window_started_at >= interval '10 minutes' then
    current_row.window_started_at := current_time;
    current_row.window_requests := 0;
    current_row.window_image_requests := 0;
  end if;

  if current_row.daily_requests >= daily_limit
     or (p_has_images and current_row.daily_image_requests >= daily_image_limit)
     or current_row.window_requests >= window_limit
     or (p_has_images and current_row.window_image_requests >= image_window_limit) then
    retry_seconds := greatest(1, ceil(extract(epoch from (current_row.window_started_at + interval '10 minutes' - current_time)))::integer);
    update private.ai_rate_limits set day = current_row.day, daily_requests = current_row.daily_requests, daily_image_requests = current_row.daily_image_requests, window_started_at = current_row.window_started_at, window_requests = current_row.window_requests, window_image_requests = current_row.window_image_requests, updated_at = current_time where user_id = p_user_id;
    return jsonb_build_object('allowed', false, 'retry_after', retry_seconds, 'used', current_row.window_requests);
  end if;

  current_row.window_requests := current_row.window_requests + 1;
  current_row.daily_requests := current_row.daily_requests + 1;
  if p_has_images then
    current_row.window_image_requests := current_row.window_image_requests + 1;
    current_row.daily_image_requests := current_row.daily_image_requests + 1;
  end if;
  update private.ai_rate_limits set day = current_row.day, daily_requests = current_row.daily_requests, daily_image_requests = current_row.daily_image_requests, window_started_at = current_row.window_started_at, window_requests = current_row.window_requests, window_image_requests = current_row.window_image_requests, updated_at = current_time where user_id = p_user_id;
  return jsonb_build_object('allowed', true, 'retry_after', 0, 'used', current_row.window_requests);
end;
$$;

revoke all on function public.consume_ai_rate_limit(uuid, boolean) from public, anon, authenticated;
grant execute on function public.consume_ai_rate_limit(uuid, boolean) to service_role;
