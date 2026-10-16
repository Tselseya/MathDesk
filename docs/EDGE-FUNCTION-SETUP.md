# MathDesk AI: Supabase Edge Function setup

This replaces the browser-visible local n8n/ngrok endpoint with an authenticated Supabase Edge Function. The browser sends a Supabase Auth user JWT; the Edge Function validates it, applies database-backed rate limits, and calls Groq with a server-side secret.

## Architecture

```text
Signed-in browser
  -> supabase.functions.invoke('mathdesk-ai')
  -> Edge Function verifies the user token (auth.getUser) and validates the body
  -> RPC consume_ai_rate_limit: per-user and global quotas (private tables, service role only)
  -> Groq API using GROQ_API_KEY
  -> { "reply": "..." }
```

The Groq key must never be a `VITE_*` variable and must never be committed.

## 1. Apply the database migration

From the repository root, after reviewing the migration:

```bash
supabase link --project-ref hmkngkzmoxltozwnwxfl
supabase db push
```

If the CLI is not authenticated, use a scoped Supabase access token locally:

```bash
export SUPABASE_ACCESS_TOKEN='your-scoped-token'
```

The migration creates a private rate-limit table and a `service_role`-only RPC. It does not expose the table through the Data API.

## 2. Set Edge Function secrets

Use the Supabase Dashboard: **Project Settings → Edge Functions → Secrets**, or the CLI:

```bash
supabase secrets set \
  GROQ_API_KEY='your-groq-key' \
  GROQ_MODEL='qwen/qwen3.8-27b'
```

Supabase supplies these automatically to the function and also supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Do not add any of them to GitHub Pages secrets except the public `VITE_SUPABASE_URL` and public client key.

## 3. Deploy the function

```bash
supabase functions deploy mathdesk-ai --project-ref hmkngkzmoxltozwnwxfl
```

`supabase/config.toml` sets `verify_jwt = false` on purpose. This project signs user tokens with asymmetric ES256 keys, and the gateway option "Verify JWT with legacy secret" rejects them. The function checks every token itself with `auth.getUser`, so a missing, malformed or anon-key token still returns `401`. Do not switch the gateway check back on. After any CLI deploy, open the function's Settings page and confirm that option is still off.

Groq retires models without much notice (`llama-3.3-70b-versatile` and `llama-4-scout` are gone). If requests start returning `502`, check the function logs for a `groq error` line, list models with `GET https://api.groq.com/openai/v1/models`, and update `GROQ_MODEL`.

## 4. Verify authentication before testing AI

Unauthenticated calls must return `401`:

```bash
curl -i -X POST \
  'https://hmkngkzmoxltozwnwxfl.supabase.co/functions/v1/mathdesk-ai' \
  -H 'Content-Type: application/json' \
  --data '{"mode":"deskbot","message":"hello"}'
```

A signed-in browser request should return `200` with `{ "reply": "..." }`, provided `GROQ_API_KEY` is configured.

## 5. Configure GitHub Pages

The frontend now calls the Supabase Function directly. Keep only these GitHub Actions secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Remove these obsolete frontend endpoint secrets after the new build is confirmed:

```text
VITE_N8N_WEBHOOK_URL
VITE_MATHDESK_API_URL
```

The public Supabase URL and publishable/anon key are not provider secrets; database access remains controlled by RLS and the function’s JWT boundary.

## 6. Test matrix before production launch

- No `Authorization` header, or the public anon key as the bearer token → `401`.
- Expired or malformed user JWT → `401`.
- Signed-in valid request → `200` and a non-empty `reply`.
- Unknown mode → `400`.
- Empty message → `400`.
- Oversized message → `413`.
- Third image → `413`.
- Images in practice/deskbot mode → `400`.
- More than 10 requests in ten minutes (4 with images), or 40 in a UTC day (10 with images), for one account → `429` with `Retry-After`.
- A second account has its own quota bucket.
- The shared cap of 120 requests (30 with images) per UTC day returns `429` to every account, with a daily-capacity message and `Retry-After` set to the next UTC midnight.
- Provider failure → generic `502`; provider key is never returned.
- Browser network panel shows only the Supabase Function URL, never Groq or ngrok.

## Rollback

The frontend rollback is a normal Git revert/redeploy. To disable the function without deleting it, remove the frontend deployment reference and redeploy the previous commit. Rotate `GROQ_API_KEY` immediately if it was ever placed in a browser-exposed variable.
