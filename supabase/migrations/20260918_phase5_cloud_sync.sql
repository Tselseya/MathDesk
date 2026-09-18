-- MathDesk Phase 5: cloud-synced chat history and saved lessons.
-- Safe for the pre-existing chat_history table used by the legacy app.

create table if not exists public.chat_history (
  id bigint generated always as identity primary key,
  user_id uuid unique not null references auth.users(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.chat_history add column if not exists updated_at timestamptz not null default now();
alter table public.chat_history enable row level security;
drop policy if exists "Users can manage their own chat history" on public.chat_history;
create policy "Users can manage their own chat history" on public.chat_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.saved_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  source_type text not null default 'text' check (source_type in ('text', 'file', 'image', 'chat')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_lessons_user_updated_idx on public.saved_lessons(user_id, updated_at desc);
alter table public.saved_lessons enable row level security;
drop policy if exists "Users can manage their own saved lessons" on public.saved_lessons;
create policy "Users can manage their own saved lessons" on public.saved_lessons for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists chat_history_set_updated_at on public.chat_history;
create trigger chat_history_set_updated_at before update on public.chat_history for each row execute function public.set_updated_at();
drop trigger if exists saved_lessons_set_updated_at on public.saved_lessons;
create trigger saved_lessons_set_updated_at before update on public.saved_lessons for each row execute function public.set_updated_at();
