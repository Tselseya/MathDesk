# Secure static hosting for MathDesk

The repository now contains a complete `public/_headers` policy. GitHub Pages ignores this file, while Cloudflare Pages and Netlify apply it during deployment.

## Recommended route: Cloudflare Pages

Cloudflare Pages is the better fit if you want to keep the repository on GitHub and later place the free `page.gd` site behind Cloudflare controls.

1. Open **Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git**.
2. Authorize GitHub and select `Tselseya/MathDesk`.
3. Configure the build:
   - Production branch: `main`
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
4. Add these **production environment variables** under the project’s Settings → Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_HCAPTCHA_SITEKEY`
5. Deploy and open the generated `pages.dev` URL.
6. Add the deployed hostname to the hCaptcha site-key allowlist and Supabase Auth URL configuration if it is a new hostname.
7. Run:

```sh
node scripts/security-audit.mjs https://your-project.pages.dev/
```

The audit should report zero live response-header warnings. Confirm the response headers in DevTools or with `curl -I` before switching traffic.

### Custom domain / existing page.gd hostname

If `app.mathdesk.page.gd` is managed by a third-party free-domain provider and is not in your Cloudflare account, Cloudflare Pages cannot directly attach that hostname. Use the generated `pages.dev` hostname first, then connect a domain you control through Cloudflare DNS. Do not change DNS until the Pages deployment and authentication smoke test pass.

## Alternative route: Netlify

1. Open **Netlify → Add new project → Import an existing project → GitHub**.
2. Select `Tselseya/MathDesk`.
3. Configure:
   - Branch: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add the same three production environment variables in Site configuration → Environment variables.
5. Deploy and open the generated `netlify.app` URL.
6. Add the Netlify hostname to hCaptcha and Supabase Auth URL allowlists.
7. Run the live security audit against the Netlify URL.

Netlify reads `public/_headers` through the published output because Vite copies `public/` into `dist/`. If Netlify’s header check shows the file was not copied, place `_headers` at the publish root as a build step and re-deploy.

## Important security details

- Keep `VITE_HCAPTCHA_SITEKEY` public; never place the hCaptcha private secret in the frontend or a `VITE_*` variable.
- Keep the Supabase anon key public by design; never expose the Supabase service-role key.
- Do not add test passwords to GitHub variables that are available to untrusted pull requests.
- Use the protected `E2E_*` names from `AUTH-E2E-TESTING.md` only in owner-controlled runs.
- Keep GitHub Pages available until the new host passes the full auth and security checks.
