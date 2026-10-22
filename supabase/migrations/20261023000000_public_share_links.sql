-- Public token-only access for read-only share snapshots.
-- The URL token has 256 bits of entropy; only its SHA-256 hash is stored.
-- Owner checks remain in create/status/revoke. This function returns only active, unexpired snapshots.
create or replace function public.get_shared_conversation(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select jsonb_build_object('title', s.title, 'mode', s.mode, 'messages', s.snapshot, 'expires_at', s.expires_at)
    into v_result
    from public.shared_conversations as s
   where s.token_hash = p_token_hash
     and s.revoked_at is null
     and s.expires_at > now();
  return v_result;
end;
$$;
revoke all on function public.get_shared_conversation(text) from public, anon, authenticated;
grant execute on function public.get_shared_conversation(text) to anon, authenticated;
