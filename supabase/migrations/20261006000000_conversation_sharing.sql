-- Optional conversation sharing for signed-in MathDesk users.
-- A URL token is generated in the browser; only its SHA-256 hash is stored here.
-- Run this migration in the MathDesk Supabase project before enabling share links.

create table if not exists public.shared_conversations (
  share_id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.chat_conversations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text unique check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  title text not null check (char_length(title) <= 80),
  mode text not null check (mode in ('solve', 'learn', 'practice', 'deskbot')),
  snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(snapshot) = 'array'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint shared_conversations_snapshot_size check (octet_length(snapshot::text) <= 600000)
);

create index if not exists shared_conversations_owner_created_idx
  on public.shared_conversations (owner_id, created_at desc);

alter table public.shared_conversations enable row level security;
revoke all on table public.shared_conversations from public, anon, authenticated;

create or replace function public.create_shared_conversation(p_conversation_id uuid, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_mode text;
  v_messages jsonb;
  v_snapshot jsonb;
  v_share_id uuid;
  v_created_at timestamptz;
  v_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid share token';
  end if;

  select c.title, c.mode, c.messages
    into v_title, v_mode, v_messages
    from public.chat_conversations as c
   where c.id = p_conversation_id
     and c.user_id = auth.uid();
  if not found then
    raise exception 'Conversation not found';
  end if;
  if jsonb_typeof(v_messages) <> 'array' then
    raise exception 'Conversation cannot be shared';
  end if;
  if v_mode not in ('solve', 'learn', 'practice', 'deskbot') then
    raise exception 'Conversation mode cannot be shared';
  end if;

  -- Copy the full transcript's role and text. Image previews/attachments are never included;
  -- oversized complete snapshots are rejected below rather than silently truncated.
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'role', item.message ->> 'role',
               'content', coalesce(item.message ->> 'content', '')
             ) order by item.ordinality
           ),
           '[]'::jsonb
         )
    into v_snapshot
    from jsonb_array_elements(v_messages) with ordinality as item(message, ordinality)
   where jsonb_typeof(item.message) = 'object'
     and item.message ->> 'role' in ('user', 'ai');

  if jsonb_array_length(v_snapshot) = 0 then
    raise exception 'Conversation has no shareable messages';
  end if;
  if octet_length(v_snapshot::text) > 600000 then
    raise exception 'Conversation is too large to share';
  end if;

  insert into public.shared_conversations as existing (
    conversation_id, owner_id, token_hash, title, mode, snapshot, created_at, expires_at, revoked_at
  ) values (
    p_conversation_id,
    auth.uid(),
    p_token_hash,
    left(coalesce(v_title, 'Conversation'), 80),
    v_mode,
    v_snapshot,
    now(),
    now() + interval '30 days',
    null
  )
  on conflict (conversation_id) do update
     set owner_id = excluded.owner_id,
         token_hash = excluded.token_hash,
         title = excluded.title,
         mode = excluded.mode,
         snapshot = excluded.snapshot,
         created_at = now(),
         expires_at = now() + interval '30 days',
         revoked_at = null
   where existing.owner_id = auth.uid()
  returning share_id, created_at, expires_at
       into v_share_id, v_created_at, v_expires_at;

  if v_share_id is null then
    raise exception 'Share link could not be created';
  end if;

  return jsonb_build_object('share_id', v_share_id, 'created_at', v_created_at, 'expires_at', v_expires_at);
end;
$$;

create or replace function public.get_shared_conversation(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select jsonb_build_object(
           'title', s.title,
           'mode', s.mode,
           'messages', s.snapshot,
           'expires_at', s.expires_at
         )
    into v_result
    from public.shared_conversations as s
   where s.token_hash = p_token_hash
     and s.revoked_at is null
     and s.expires_at > now();

  return v_result;
end;
$$;

create or replace function public.get_my_conversation_share_status(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select jsonb_build_object(
           'active', s.revoked_at is null and s.expires_at > now(),
           'created_at', s.created_at,
           'expires_at', s.expires_at,
           'revoked_at', s.revoked_at
         )
    into v_result
    from public.shared_conversations as s
   where s.conversation_id = p_conversation_id
     and s.owner_id = auth.uid();

  return v_result;
end;
$$;

create or replace function public.revoke_shared_conversation(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.shared_conversations
     set revoked_at = coalesce(revoked_at, now()),
         token_hash = null,
         snapshot = '[]'::jsonb
   where conversation_id = p_conversation_id
     and owner_id = auth.uid()
     and revoked_at is null
  returning share_id into v_share_id;

  return v_share_id is not null;
end;
$$;

revoke all on function public.create_shared_conversation(uuid, text) from public, anon, authenticated;
revoke all on function public.get_shared_conversation(text) from public, anon, authenticated;
revoke all on function public.get_my_conversation_share_status(uuid) from public, anon, authenticated;
revoke all on function public.revoke_shared_conversation(uuid) from public, anon, authenticated;
grant execute on function public.create_shared_conversation(uuid, text) to authenticated;
grant execute on function public.get_shared_conversation(text) to authenticated;
grant execute on function public.get_my_conversation_share_status(uuid) to authenticated;
grant execute on function public.revoke_shared_conversation(uuid) to authenticated;
