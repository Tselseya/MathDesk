# MathDesk security hardening and AI endpoint report

**Date:** 12 October 2026
**Branch:** `fix/restore-redesign-ai-hardening`
**Production deployment:** pending deployment and live verification
**Supabase project:** MathDesk Project (`hmkngkzmoxltozwnwxfl`)

## Executive summary

The branch restores the Particle Desky redesign and applies the applicable October 7 audit fixes. The browser-side n8n/ngrok AI dependency has been removed from the active app and replaced by the authenticated Supabase Edge Function `mathdesk-ai`.

The remaining release blockers are operational: deploy the function, apply the rate-limit migration in the production project, configure server-side Groq secrets, complete the authenticated test matrix, and verify the deployed site. The branch itself must not be described as production-ready until those checks pass.

## Implemented fixes

### UI and interaction restoration

- Restored the Particle Desky homepage and interaction layer.
- Removed floating mathematical symbols and decorative orbit layers from the homepage.
- Kept the graph-paper visual treatment, background-only click ripples, cursor particles, theme handling, and reduced-motion support.
- Preserved responsive AI workspace behavior and mobile drawer/desktop rail layout.

### AI endpoint hardening

- `src/services/mathdeskAI.ts` now uses `supabase.functions.invoke('mathdesk-ai')`.
- The client requires an authenticated Supabase session before invoking AI.
- `supabase/functions/mathdesk-ai/index.ts` validates the JWT/user, request size, mode, images, and provider response.
- Groq is called only from the Edge Function using server-side `GROQ_API_KEY`.
- `private.ai_rate_limits` and its service-role-only RPC provide durable per-user and daily global quotas.
- Provider errors are normalized; provider credentials are not returned to clients.
- The GitHub Pages build no longer injects n8n or gateway endpoint variables.
- CSP `connect-src` no longer allows n8n/ngrok or an obsolete browser API gateway.

### Database and Supabase security

- Applied the advisor fixes for search-path pinning and restricted RPC execution.
- Enabled/retained RLS on user-owned tables.
- Added explicit authenticated-owner policies where required.
- Added explicit deny policies for direct client access to internal/shared tables where access is mediated by RPCs.
- Preserved the intentionally public approximate homepage visit-counter RPC; it is not a security boundary and remains a possible inflation vector.
- Added the AI rate-limit migration file: `supabase/migrations/20261012094923_ai_rate_limits.sql`.

### Authentication and privacy

- Added HIBP k-anonymity password checks for signup and password recovery.
- Only the first five SHA-1 hash characters are sent to HIBP; the password and full hash stay in the browser.
- HIBP outages fail open so users are not locked out by an unrelated external service.
- Contact email is `mathdesk.team@gmail.com` across the legal/UI surfaces.
- AI access is no longer available to anonymous users.

### Supply chain and caching

- Pinned direct npm dependencies and aligned the lockfile.
- Verified production dependency audit has no high-severity findings.
- Service Worker caching is limited to versioned same-origin static assets and does not cache auth, Supabase, AI, or user-specific responses.

## Verification completed locally

```text
npm run check                         PASS
npm test -- --reporter=verbose       PASS
npm run build                         PASS
npm audit --omit=dev --audit-level=high  PASS
npm audit                             PASS
 git diff --check                     PASS
```

Run these commands again immediately before merge; the report records the required evidence, not a substitute for a fresh run after final edits.

## Required production gate

1. Link the Supabase CLI to project `hmkngkzmoxltozwnwxfl`.
2. Apply `supabase/migrations/20261012094923_ai_rate_limits.sql`.
3. Set `GROQ_API_KEY` and `GROQ_MODEL` as Supabase Edge Function secrets.
4. Deploy `mathdesk-ai` without `--no-verify-jwt`.
5. Configure only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as GitHub Actions secrets.
6. Run unauthenticated, malformed-request, authenticated-success, provider-failure, per-user quota, global quota, and second-account isolation tests.
7. Deploy the Pages build and verify auth, signup/reset, AI, lessons, sharing permissions, theme persistence, mobile layout, offline/slow-network errors, and broken routes.
8. Remove obsolete GitHub Actions secrets `VITE_N8N_WEBHOOK_URL` and `VITE_MATHDESK_API_URL` after confirming they are not needed by any other workflow.

## Known residual risks

- Supabase Auth's provider-side leaked-password protection may still show an advisor warning; HIBP is defense-in-depth and not an equivalent replacement.
- The public homepage visit counter can be inflated. It must remain approximate or be removed/throttled in a later change.
- GitHub Pages cannot provide true response-level security headers. The CSP meta tag is useful but weaker than a hosting-layer CSP/HSTS/nosniff policy.
- Supabase free-plan email delivery and backup capabilities need operational validation before inviting real users.

## Release conclusion

**Not yet cleared for production publication** until the Edge Function and migration are deployed and the live test matrix passes. The code path is prepared for that deployment; passing local tests alone does not prove the hosted AI endpoint, secrets, quotas, or production domain are working.
