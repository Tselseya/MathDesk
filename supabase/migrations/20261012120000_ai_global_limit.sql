-- Adds a shared daily quota across all users, enforced atomically inside the
-- existing consume_ai_rate_limit RPC (same signature, so no client/function
-- signature change). Groq limits are per organization, so a per-user cap alone
-- cannot protect the provider key.

create table if not exists private.ai_global_limits (
  day date primary key,
  requests integer not null default 0,
  image_requests integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table private.ai_global_limits enable row level security;
revoke all on table private.ai_global_limits from public, anon, authenticated;

create or replace function public.consume_ai_rate_limit(p_user_id uuid, p_has_images boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  current_row private.ai_rate_limits%rowtype;
  now_ts timestamptz := now();
  today date := (now() at time zone 'utc')::date;
  window_limit integer := 30;
  image_window_limit integer := 10;
  daily_limit integer := 3000;
  daily_image_limit integer := 400;
  -- Shared across ALL users. Keep below your Groq plan's daily request cap.
  global_daily_limit integer := 900;
  global_daily_image_limit integer := 150;
  seconds_to_midnight integer := ceil(extract(epoch from (((today + 1)::timestamp at time zone 'utc') - now())))::integer;
  retry_seconds integer;
begin
  insert into private.ai_rate_limits (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into current_row from private.ai_rate_limits where user_id = p_user_id for update;

  if current_row.day <> today then
    current_row.day := today;
    current_row.daily_requests := 0;
    current_row.daily_image_requests := 0;
  end if;
  if now_ts - current_row.window_started_at >= interval '10 minutes' then
    current_row.window_started_at := now_ts;
    current_row.window_requests := 0;
    current_row.window_image_requests := 0;
  end if;

  -- 1. Per-user limits.
  if current_row.daily_requests >= daily_limit
     or (p_has_images and current_row.daily_image_requests >= daily_image_limit) then
    retry_seconds := greatest(1, seconds_to_midnight);
  elsif current_row.window_requests >= window_limit
     or (p_has_images and current_row.window_image_requests >= image_window_limit) then
    retry_seconds := greatest(1, ceil(extract(epoch from (current_row.window_started_at + interval '10 minutes' - now_ts)))::integer);
  end if;

  if retry_seconds is not null then
    update private.ai_rate_limits set day = current_row.day, daily_requests = current_row.daily_requests, daily_image_requests = current_row.daily_image_requests, window_started_at = current_row.window_started_at, window_requests = current_row.window_requests, window_image_requests = current_row.window_image_requests, updated_at = now_ts where user_id = p_user_id;
    return jsonb_build_object('allowed', false, 'scope', 'user', 'retry_after', retry_seconds, 'used', current_row.window_requests);
  end if;

  -- 2. Global daily limit: one conditional UPDATE, so concurrent requests cannot overshoot.
  insert into private.ai_global_limits (day) values (today) on conflict (day) do nothing;
  update private.ai_global_limits
  set requests = requests + 1,
      image_requests = image_requests + case when p_has_images then 1 else 0 end,
      updated_at = now_ts
  where day = today
    and requests < global_daily_limit
    and (not p_has_images or image_requests < global_daily_image_limit);

  if not found then
    -- Global cap hit: do not charge this user's own counters.
    update private.ai_rate_limits set day = current_row.day, daily_requests = current_row.daily_requests, daily_image_requests = current_row.daily_image_requests, window_started_at = current_row.window_started_at, window_requests = current_row.window_requests, window_image_requests = current_row.window_image_requests, updated_at = now_ts where user_id = p_user_id;
    return jsonb_build_object('allowed', false, 'scope', 'global', 'retry_after', greatest(1, seconds_to_midnight), 'used', current_row.window_requests);
  end if;

  -- 3. Charge the user.
  current_row.window_requests := current_row.window_requests + 1;
  current_row.daily_requests := current_row.daily_requests + 1;
  if p_has_images then
    current_row.window_image_requests := current_row.window_image_requests + 1;
    current_row.daily_image_requests := current_row.daily_image_requests + 1;
  end if;
  update private.ai_rate_limits set day = current_row.day, daily_requests = current_row.daily_requests, daily_image_requests = current_row.daily_image_requests, window_started_at = current_row.window_started_at, window_requests = current_row.window_requests, window_image_requests = current_row.window_image_requests, updated_at = now_ts where user_id = p_user_id;
  return jsonb_build_object('allowed', true, 'scope', 'none', 'retry_after', 0, 'used', current_row.window_requests);
end;
$$;

revoke all on function public.consume_ai_rate_limit(uuid, boolean) from public, anon, authenticated;
grant execute on function public.consume_ai_rate_limit(uuid, boolean) to service_role;