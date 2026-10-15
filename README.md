# MathDesk

**MathDesk is a calmer AI math-learning workspace for students, tutors, and curious minds.** It combines step-by-step solving, concept explanations, practice prompts, image uploads, saved lessons, and shareable read-only conversations in one browser app.

**Live app:** <https://app.mathdesk.page.gd/>
**Repository:** <https://github.com/Tselseya/MathDesk>

## What it does

- Solve, learn, and practice mathematics with Desky.
- Accept typed questions and small PNG, JPEG, WebP, or GIF problem images.
- Save conversations and lessons for signed-in users.
- Share read-only conversation snapshots without exposing private history.
- Provide a particle-based MathDesk homepage with light/dark themes, reduced-motion support, and a graph-paper visual system.
- Offer a focused tools directory for graphing, symbolic calculation, textbooks, and practice.

## Production architecture

```text
Browser
  └─ Supabase Auth session
      └─ Supabase Edge Function: mathdesk-ai
          ├─ request validation and signed-in identity check
          ├─ atomic per-user and global quota RPC
          └─ Groq API (server-side secret only)
```

The browser does **not** call Groq, n8n, or ngrok directly. AI access requires an authenticated Supabase account. Provider credentials remain in Supabase Edge Function secrets.

## Local development

Requirements: Node.js 22+, npm, and a Supabase project for authenticated features.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The required public variables are:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

Never put `GROQ_API_KEY`, a Supabase service-role key, or a user password in Vite variables or committed files.

## Verification commands

```bash
npm run check
npm test -- --run
npm run build
git diff --check
```

## Deployment

- GitHub Actions builds and deploys `main` to GitHub Pages.
- Supabase migrations define the database and quota policy.
- The `mathdesk-ai` Edge Function is deployed separately to Supabase.
- Production secrets are configured in Supabase Edge Function Secrets, not GitHub Pages.

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [docs/EDGE-FUNCTION-SETUP.md](./docs/EDGE-FUNCTION-SETUP.md) for the full procedure.

## Security notes

- AI requests require a valid Supabase access token.
- Request mode, prompt size, image MIME type, image count, and image size are validated server-side.
- Private rate-limit tables are not directly readable by browser roles.
- Saved conversations and lessons are protected by owner-scoped RLS policies.
- Password signup and reset flows include a client-side Have I Been Pwned k-anonymity check.
- Production static assets are cached only when versioned by the build.

## Project map

| Path | Purpose |
| --- | --- |
| `src/` | React application, UI components, services, and tests |
| `supabase/functions/mathdesk-ai/` | Authenticated AI gateway |
| `supabase/migrations/` | Forward-only database migrations |
| `public/` | Static legal pages, metadata, icons, and tool logos |
| `.github/workflows/` | CI and GitHub Pages deployment |
| `docs/` | Deployment, redesign, and verification notes |

## Status

MathDesk is an active work in progress. Contributions and issue reports should include the browser, viewport, steps to reproduce, and whether the problem affects light mode, dark mode, authentication, or the AI workspace.
