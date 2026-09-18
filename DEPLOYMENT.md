# MathDesk production deployment

The React/Vite redesign is now merged into `main`. The current deployment target is the custom domain `app.mathdesk.page.gd`, served from an Apache-compatible host such as InfinityFree.

## Build locally or in CI

```bash
npm ci
cp .env.production.example .env.production
# Fill in the production n8n or hosted API endpoint and Supabase anon key.
npm run check
npm run build
```

Vite embeds `VITE_*` variables at build time. Do not upload `.env.production`, `.env.local`, or any file containing a private n8n endpoint. The Supabase URL and anon key are intended for browser use, but database access is protected by Supabase Row Level Security.

## Upload to InfinityFree/Apache

Upload the **contents of `dist/`**, not the `dist` directory itself, into the public web root for `app.mathdesk.page.gd`. The generated `dist/.htaccess` enables client-side SPA fallback and long-lived caching for hashed static assets. Keep `CNAME` in the repository for GitHub-based deployment metadata, but do not upload it as an application route unless the host requires it.

After upload, verify the root page, `/site.webmanifest`, `/sw.js`, Supabase login, chat-history sync, saved lessons, and an AI request. Camera capture requires HTTPS and a user gesture; the custom domain must remain HTTPS for camera access and PWA installation.

## GitHub Pages deployment

The repository now includes `.github/workflows/deploy-pages.yml`. Every push to `main` builds the React application and deploys the generated `dist/` artifact through GitHub Pages. This is the required path for the current `app.mathdesk.page.gd` custom-domain deployment; uploading source files directly to the Pages root will produce a blank page because the compiled `assets/` directory is missing.

In the repository settings, add the following Actions secrets before relying on cloud functionality: `VITE_N8N_WEBHOOK_URL`, `VITE_MATHDESK_API_URL` when a hosted gateway exists, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. The workflow can build with empty optional values, but AI and Supabase features will remain unavailable until their secrets are configured.

## Production environment values

Use `.env.production.example` as the template. The preferred future setup is `VITE_MATHDESK_API_URL` pointing to a stable hosted API gateway. Until that exists, set `VITE_N8N_WEBHOOK_URL` to the production n8n webhook. Never expose n8n credentials in frontend variables; the endpoint itself is visible to browser users and should be protected by the workflow or a server-side gateway.

## Rollback

The previous design is preserved in the Git history and the `legacy/` directory. To roll back, redeploy the last known-good `main` build artifact or revert the merge commit `75b5f5e4e2487f0c5a6d96cec50c9cc8f8af738b` in a separate reviewed commit. Do not delete the legacy source as part of routine deployment.
