# MathDesk particle redesign handoff

This branch restores the 7 October Particle Desky redesign and carries the security hardening needed before production deployment.

## Local setup

```bash
npm ci
cp .env.example .env.local
# Set only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for local development.
npm run dev
```

Never commit `.env.local`, a Groq key, a Supabase service-role key, or a local n8n/ngrok endpoint.

## AI adapter

The UI uses `src/services/mathdeskAI.ts`; React components do not call a provider directly. The adapter invokes `supabase.functions.invoke('mathdesk-ai')` with this payload shape:

```json
{
  "message": "Explain this problem",
  "mode": "solve",
  "hasImages": false,
  "images": []
}
```

Supported modes are `solve`, `learn`, `practice`, and `deskbot`. AI access requires a signed-in Supabase account. The Edge Function validates the JWT and request body, enforces durable per-user/global quotas, calls Groq with the server-only `GROQ_API_KEY`, and returns `{ "reply": "..." }`. The browser never receives provider credentials or a local n8n/ngrok URL.

See [`docs/EDGE-FUNCTION-SETUP.md`](docs/EDGE-FUNCTION-SETUP.md) for deployment and verification.

## Validation

```bash
npm run check
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

## Product capabilities

- Particle Desky hero with anchored drag/orbit correction.
- Graph-paper background with floating math symbols and decorative orbit layers suppressed.
- Background-only click ripples, cursor particles, staged entrance transitions, and reduced-motion support.
- Persistent AI workspace with responsive drawer/rail behavior, tools, camera capture, uploads, drafts, chat history, graphing, calculator handoff, and saved lessons.
- Supabase Auth with HIBP k-anonymity checks during signup and password recovery.
- Local-first lessons with cloud synchronization for authenticated users.
- Versioned static-asset service-worker caching; dynamic/auth/API responses are not cached.
- PWA manifest, offline shell, and explicit offline state that prevents pretending AI is available offline.

## Release gate

Do not merge or publish until the Edge Function deployment, rate-limit migration, authenticated AI test matrix, Supabase auth/email tests, and live smoke test are complete. After deployment, remove obsolete GitHub Actions secrets `VITE_N8N_WEBHOOK_URL` and `VITE_MATHDESK_API_URL`.
