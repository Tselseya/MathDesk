-- MathDesk launch hardening. Run once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Safe to re-run: every statement is idempotent.

-- 1) One row per conversation (replaces the old "one row per user" chat_history overwrite problem).
create table if not exists public.chat_conversations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Conversation' check (char_length(title) <= 80),
  mode text not null default 'solve' check (mode in ('solve', 'learn', 'practice', 'deskbot')),
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_conversations_messages_is_array check (jsonb_typeof(messages) = 'array'),
  constraint chat_conversations_messages_size check (octet_length(messages::text) <= 600000)
);

create index if not exists chat_conversations_user_updated_idx on public.chat_conversations (user_id, updated_at desc);

alter table public.chat_conversations enable row level security;

drop policy if exists "chat_conversations_select_own" on public.chat_conversations;
drop policy if exists "chat_conversations_insert_own" on public.chat_conversations;
drop policy if exists "chat_conversations_update_own" on public.chat_conversations;
drop policy if exists "chat_conversations_delete_own" on public.chat_conversations;
create policy "chat_conversations_select_own" on public.chat_conversations for select to authenticated using (auth.uid() = user_id);
create policy "chat_conversations_insert_own" on public.chat_conversations for insert to authenticated with check (auth.uid() = user_id);
create policy "chat_conversations_update_own" on public.chat_conversations for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chat_conversations_delete_own" on public.chat_conversations for delete to authenticated using (auth.uid() = user_id);

-- Anonymous visitors never need this table.
revoke all on public.chat_conversations from anon;

drop trigger if exists chat_conversations_set_updated_at on public.chat_conversations;
create trigger chat_conversations_set_updated_at before update on public.chat_conversations for each row execute function public.set_updated_at();

-- 2) Size limits on saved lessons (the app also enforces these).
alter table public.saved_lessons drop constraint if exists saved_lessons_title_len;
alter table public.saved_lessons add constraint saved_lessons_title_len check (char_length(title) <= 200) not valid;
alter table public.saved_lessons drop constraint if exists saved_lessons_content_len;
alter table public.saved_lessons add constraint saved_lessons_content_len check (char_length(content) <= 50000) not valid;

-- 3) Lets a signed-in user permanently delete their own account and every row that belongs to it.
--    All MathDesk tables reference auth.users(id) ON DELETE CASCADE, so deleting the auth user removes their data.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 4) CHECK ONLY (does not change anything): list the policies on chat_history. If two have identical definitions, drop one by name:
--    drop policy "the duplicate policy name" on public.chat_history;
select policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'chat_history' order by policyname;
