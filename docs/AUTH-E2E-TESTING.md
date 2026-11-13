# MathDesk authentication E2E testing

The browser suite in `e2e/auth.spec.ts` verifies the production login and signup surfaces. It deliberately does not bypass hCaptcha. The owner must complete the visible hCaptcha challenge in a headed browser, and credentials are supplied only through environment variables or local CI secrets.

## Test-account policy

Use two isolated Supabase accounts:

- `E2E_AUTH_EMAIL` / `E2E_AUTH_PASSWORD`: a persistent, confirmed login account.
- `E2E_SIGNUP_EMAIL` / `E2E_SIGNUP_PASSWORD`: a disposable signup account. Use a mailbox that can receive Supabase confirmation email if email confirmation is enabled.

Do not commit these values, put them in `VITE_*` variables, or paste the password into chat. Store them in a local ignored `.env.e2e` file or protected GitHub Actions secrets. The signup test is opt-in because it creates an external account:

```sh
export E2E_BASE_URL=https://app.mathdesk.page.gd/
export E2E_AUTH_EMAIL='owner-test@example.com'
export E2E_AUTH_PASSWORD='use-a-local-secret'
export E2E_ALLOW_SIGNUP=true
export E2E_SIGNUP_NAME='MathDesk E2E'
export E2E_SIGNUP_EMAIL='disposable-test@example.com'
export E2E_SIGNUP_PASSWORD='use-another-local-secret'

npm run test:e2e:auth:headed
```

The suite first verifies that login and signup render hCaptcha. It then runs the credentialed tests only when the corresponding variables are present. The headed command pauses long enough for the owner to solve hCaptcha. Do not use `E2E_SKIP_CAPTCHA_WAIT=true` for a production authentication test; that option is only for debugging the page surface.

## Local staging

To test a local production build instead of the public site:

```sh
VITE_SUPABASE_URL='https://your-project.supabase.co' \
VITE_SUPABASE_ANON_KEY='your-public-anon-key' \
VITE_HCAPTCHA_SITEKEY='your-public-hcaptcha-site-key' \
npm run build && npm run preview

E2E_BASE_URL='http://127.0.0.1:4173/' npm run test:e2e:auth:headed
```

The hCaptcha site key must be authorized for the hostname being tested. A production key normally will not work on `127.0.0.1`; use a separate hCaptcha site key for local development if needed.

## CI recommendation

Run the surface test in CI without credentials. Keep credentialed login/signup tests owner-run or in a protected environment with repository secrets and manual approval. CAPTCHA challenges are intentionally unsuitable for unattended CI.

Recommended protected secret names:

```text
E2E_AUTH_EMAIL
E2E_AUTH_PASSWORD
E2E_SIGNUP_EMAIL
E2E_SIGNUP_PASSWORD
```

Never expose these values in workflow logs. Do not echo them or include Playwright traces from credentialed failures in public artifacts.
