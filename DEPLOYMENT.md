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
3. Deploy `supabase/functions/mathdesk-ai`; the function performs `auth.getUser` validation inside the handler because the project uses ES256 access tokens.
4. Verify unauthenticated requests return `401`.
5. Verify an authenticated request returns a non-empty reply.
6. Verify the browser network panel shows only the Supabase Function URL.

The function requires a signed-in Supabase user. The provider key stays server-side. Rate limits are stored in a private table and consumed through a service-role-only RPC.

## GitHub Pages deployment

The repository includes `.github/workflows/deploy-pages.yml`. Every push to `main` runs tests, type-checks, builds, verifies the compiled artifact, and deploys `dist/` through GitHub Pages. Configure these GitHub Actions secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_HCAPTCHA_SITEKEY
```

After the Edge Function is verified, remove obsolete `VITE_N8N_WEBHOOK_URL` and `VITE_MATHDESK_API_URL` secrets from GitHub Actions. They are no longer read by the app or workflow.

Before relying on the deployment, configure GitHub Pages to use **GitHub Actions** as its source rather than the repository branch root. Branch-root mode can serve stale committed `index.html` and hashed assets instead of the artifact produced by the workflow. After a deployment, compare the asset hashes in the live HTML with the successful workflow artifact.

The local release sequence is:

```bash
npm ci
npm test
npm run check
npm run build
npm run verify-build
```

`verify-build` confirms that `dist/index.html` references existing compiled assets, includes the production CSP, includes the manifest and service worker, and does not expose retired n8n, ngrok, or direct Groq provider endpoints.

### hCaptcha configuration

MathDesk uses hCaptcha for Supabase email/password login, signup, and password reset:

1. Create or use an hCaptcha site for `app.mathdesk.page.gd` and obtain its public **site key**.
2. Add the site key as the GitHub Actions secret `VITE_HCAPTCHA_SITEKEY`. It is intentionally public in the browser bundle.
3. Keep the hCaptcha **secret key** only in Supabase Dashboard → Authentication → Attack Protection → Captcha secret. Never put it in a `VITE_*` variable or commit it.
4. Keep CAPTCHA protection enabled in Supabase after the site key and secret are both configured.
5. Test login, signup, and password reset on the deployed domain. Complete the hCaptcha challenge before submitting each form.

If the site key is absent, the frontend cannot produce a token and Supabase returns `captcha_failed` with `no captcha_token found`.

## Upload to an Apache host

If the custom domain is served by an Apache-compatible host instead of GitHub Pages, upload the contents of `dist/` into the public web root. Do not upload `.env` files, the repository’s Supabase service credentials, or the `supabase/functions` source as public files.

## Production rollback

To roll back the website, revert the frontend commit and let the Pages workflow deploy the previous known-good build. To rotate the AI provider key, replace `GROQ_API_KEY` in Supabase Edge Function secrets and redeploy the function. Do not place the old key into GitHub or the browser.
