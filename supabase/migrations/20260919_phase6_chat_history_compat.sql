-- MathDesk Phase 6: compatibility update for the pre-existing chat_history table.
-- The legacy table uses an identity id primary key and unique user_id.

alter table public.chat_history add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists chat_history_set_updated_at on public.chat_history;
create trigger chat_history_set_updated_at before update on public.chat_history for each row execute function public.set_updated_at();
