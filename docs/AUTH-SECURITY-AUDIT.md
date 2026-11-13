# MathDesk authentication and frontend security audit

**Audit date:** 2026-11-13  
**Repository:** `Tselseya/MathDesk` `main` at `10884c8`  
**Live target:** `https://app.mathdesk.page.gd/`  
**Scope:** AuthPanel, Supabase auth adapter, hCaptcha wiring, browser storage, AI edge-function boundary, production bundle, CSP, and public response headers.

## Executive summary

No private Supabase service-role key, Groq API key, private key material, or password was found in the inspected source or configured production bundle. Supabase authentication correctly forwards hCaptcha tokens for login, signup, and password reset. The live login and signup modals render hCaptcha, and a real challenge opened successfully after the site key was deployed.

The main unresolved launch-hardening issue is hosting-level security headers. GitHub Pages does not apply the repository’s `public/_headers` file, so the live response currently lacks HTTP `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, and `X-Frame-Options`. The application does embed a CSP meta tag, which provides useful browser enforcement for many directives, but it cannot replace all response headers and cannot enforce `frame-ancestors`.

## Automated checks

The new audit command is:

```sh
npm run security:audit dist
node scripts/security-audit.mjs https://app.mathdesk.page.gd/
```

Results for the configured production build:

- **Failures:** 0
- **Private credential markers:** none found
- **Private key material:** none found
- **CSP meta tag:** present with `object-src 'none'`, `base-uri 'self'`, and `form-action 'self'`
- **hCaptcha marker:** present when `VITE_HCAPTCHA_SITEKEY` is supplied at build time
- **Build verification:** passed
- **Unit tests:** 16 passed
- **Live response header warnings:** 4, listed below

## Findings

### MEDIUM — Hosting security headers are not active on GitHub Pages

**Evidence:** The live audit found no HTTP `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, or `X-Frame-Options` headers. `public/_headers` explicitly documents that GitHub Pages ignores it.

**Impact:** Clickjacking protection, HSTS, MIME-sniffing protection, and response-level CSP are weaker than the repository configuration suggests. The CSP meta tag still applies after parsing, but it is not equivalent to a response header and cannot express all header-only protections.

**Recommendation:** Move production hosting to Cloudflare Pages or Netlify, or place the GitHub Pages site behind a reverse proxy/CDN that applies the intended headers. Re-run the live audit after migration and require zero header warnings before calling the hosting layer hardened.

### LOW — Calculator uses a dynamic `Function` evaluator

**Evidence:** `src/components/CalculatorPanel.tsx` evaluates a tightly normalized arithmetic expression with `Function('S', ...)`.

**Current mitigation:** Input is converted to a restricted character set before evaluation; unsupported identifiers and punctuation are rejected; the result must be a finite number; the input is capped at 500 characters.

**Recommendation:** Replace it with a small parser or a vetted arithmetic-expression library before treating the calculator as high-assurance. Do not loosen the allowlist or add arbitrary identifiers.

### LOW — Browser storage contains drafts and local learning data

**Evidence:** `localStorage` and `sessionStorage` hold drafts, theme/motion preferences, pending share tokens, and anonymous/local lesson data.

**Impact:** Any future XSS in the application origin could read those values. The current reply formatter escapes untrusted text and strips dangerous tags, and no authentication tokens are manually stored by MathDesk code.

**Recommendation:** Keep stored content non-sensitive by policy, continue to prohibit personal information in prompts, and consider IndexedDB plus encryption only if the product later needs to store sensitive student work. Do not store passwords, refresh tokens, or private API keys in application storage.

### INFORMATIONAL — Public Supabase URL and anon key are expected

The frontend contains the Supabase project URL and public anon key when configured. This is normal for Supabase browser clients; it is not a service-role credential. Security depends on Supabase Auth, RLS policies, and Edge Function authorization, not on hiding the anon key.

### INFORMATIONAL — CAPTCHA is a deployment prerequisite

The frontend renders hCaptcha only when `VITE_HCAPTCHA_SITEKEY` is available at build time. The Pages workflow now forwards that secret, and the repository secret is configured. A missing secret produces a build that cannot complete CAPTCHA-protected login/signup even though the rest of the app loads.

## Authentication review

- Login, signup, and password-reset requests pass the hCaptcha token through Supabase Auth.
- Login errors are generic and do not reveal whether an email exists.
- Password-reset messaging is intentionally generic to reduce account enumeration.
- Signup requires a name, email, and password of at least eight characters.
- Signup performs a Have I Been Pwned k-anonymity check; only the first five SHA-1 hash characters leave the browser.
- CAPTCHA tokens are cleared after success, expiration, mode changes, and failed requests.
- Passwords are not placed in URLs, local storage, logs, or analytics by the inspected code.
- Password reset redirects to the current site origin, not to an arbitrary user-controlled URL.
- Supabase data access is scoped by the current user ID in the client and protected by RLS migrations.
- The AI Edge Function validates the bearer token with Supabase, validates modes/images/size limits, and applies per-user/global rate limits before calling Groq.

## E2E suite delivered

`e2e/auth.spec.ts` covers:

1. Login modal rendering and hCaptcha presence.
2. Signup modal rendering and hCaptcha presence.
3. Credentialed login when `E2E_AUTH_EMAIL` and `E2E_AUTH_PASSWORD` are supplied.
4. Opt-in credentialed signup when `E2E_ALLOW_SIGNUP=true`, `E2E_SIGNUP_EMAIL`, and `E2E_SIGNUP_PASSWORD` are supplied.
5. Successful sign-out cleanup after a credentialed login/signup session.

The suite never bypasses CAPTCHA. The headed runner pauses for the owner to solve the hCaptcha challenge. Credentials are environment-only and are not checked into the repository.

Run it with:

```sh
npm run test:e2e:auth:headed
```

See [AUTH-E2E-TESTING.md](./AUTH-E2E-TESTING.md) for credential setup and protected CI guidance.

## Release recommendation

MathDesk’s application-level authentication controls are suitable for continued owner-run testing. Before a broad public launch, address the hosting-header finding by moving to a host that applies `public/_headers` or by adding an equivalent reverse proxy. Keep credentialed E2E tests protected and owner-run because hCaptcha is intentionally not unattended-CI friendly.
