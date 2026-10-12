# MathDesk production deployment

MathDesk is a React/Vite app deployed to GitHub Pages at `https://app.mathdesk.page.gd/`. AI requests go through the authenticated Supabase Edge Function `mathdesk-ai`; the browser no longer calls local n8n, ngrok, Groq, or a browser-visible API gateway.

## Build locally or in CI

```bash
npm ci
cp .env.production.example .env.production
npm run check
npm test
npm run build
```

Only public Supabase client values belong in the browser build:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Do not put `GROQ_API_KEY`, a Supabase service-role/secret key, or any n8n credential in a `VITE_*` variable.

## Supabase AI deployment

See [`docs/EDGE-FUNCTION-SETUP.md`](./docs/EDGE-FUNCTION-SETUP.md) for the complete sequence:

1. Apply `supabase/migrations/20261012094923_ai_rate_limits.sql`.
2. Set `GROQ_API_KEY` and `GROQ_MODEL` as Supabase Edge Function secrets.
3. Deploy `supabase/functions/mathdesk-ai` with JWT verification enabled.
4. Verify unauthenticated requests return `401`.
5. Verify an authenticated request returns a non-empty reply.
6. Verify the browser network panel shows only the Supabase Function URL.

The function requires a signed-in Supabase user. The provider key stays server-side. Rate limits are stored in a private table and consumed through a service-role-only RPC.

## GitHub Pages deployment

The repository includes `.github/workflows/deploy-pages.yml`. Every push to `main` builds and deploys the `dist/` artifact through GitHub Pages. Configure these GitHub Actions secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

After the Edge Function is verified, remove obsolete `VITE_N8N_WEBHOOK_URL` and `VITE_MATHDESK_API_URL` secrets from GitHub Actions. They are no longer read by the app or workflow.

## Upload to an Apache host

If the custom domain is served by an Apache-compatible host instead of GitHub Pages, upload the contents of `dist/` into the public web root. Do not upload `.env` files, the repository’s Supabase service credentials, or the `supabase/functions` source as public files.

## Production rollback

To roll back the website, revert the frontend commit and let the Pages workflow deploy the previous known-good build. To rotate the AI provider key, replace `GROQ_API_KEY` in Supabase Edge Function secrets and redeploy the function. Do not place the old key into GitHub or the browser.
