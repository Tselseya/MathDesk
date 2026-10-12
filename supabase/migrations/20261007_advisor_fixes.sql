-- MathDesk: fixes for the Supabase security-advisor findings in the 7 Oct 2026 audit.
-- Run in the Supabase SQL Editor (new query, paste, Run). Safe to re-run.
-- Nothing here deletes data. Each block says what it changes.

-- 1) Pin the search path of the updated_at trigger function (advisor: "function_search_path_mutable").
alter function public.set_updated_at() set search_path = '';

-- 2) Stop anonymous and signed-in users from calling the auto-RLS helper (advisor: callable SECURITY DEFINER function).
--    To read what it does first:  select pg_get_functiondef('public.rls_auto_enable'::regproc);
do $$
begin
  if to_regproc('public.rls_auto_enable') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- 3) Make "no direct access" explicit on the tables that are only reached through RPC functions.
--    The functions are SECURITY DEFINER, so they keep working; direct client reads and writes stay blocked.
drop policy if exists "no_direct_client_access" on public.shared_conversations;
create policy "no_direct_client_access" on public.shared_conversations
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "no_direct_client_access" on public.homepage_visit_counter;
create policy "no_direct_client_access" on public.homepage_visit_counter
  for all to anon, authenticated using (false) with check (false);

-- 4) Remove the duplicate chat_history policy, then limit the older owner-only policies to signed-in users
--    (they currently apply to the "public" role, which also covers anonymous visitors; they matched no rows, but be explicit).
drop policy if exists "Users can manage own history" on public.chat_history;

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('saved_lessons', 'chat_history')
  loop
    execute format('alter policy %I on public.%I to authenticated', r.policyname, r.tablename);
  end loop;
end $$;

-- 5) Checks (read-only). Expected: chat_history has one policy; set_updated_at has search_path=""; rls_auto_enable is not
--    executable by anon/authenticated. increment_homepage_visit_count stays callable on purpose (visitor counter).
select tablename, policyname, roles from pg_policies where schemaname = 'public' order by tablename, policyname;
select routine_name, grantee from information_schema.routine_privileges
  where routine_schema = 'public' and grantee in ('anon', 'authenticated') order by routine_name, grantee;
