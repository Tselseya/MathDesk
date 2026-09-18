# MathDesk Redesign

This branch contains the Phase 1 React/Vite foundation for the MathDesk redesign. The stable single-file application is preserved at `legacy/index.html` on this branch and remains unchanged on `main`.

## Branch safety

- `main` remains the current stable deployment branch.
- `redesign` contains the new React application.
- The old interface is archived at `legacy/index.html` in this branch for reference during migration.
- Do not merge this branch into `main` until the existing feature set has been reconnected and tested.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_N8N_WEBHOOK_URL` in `.env.local` to the currently reachable n8n webhook. Do not commit `.env.local` or a real endpoint containing private infrastructure details.

## AI adapter

The UI should use `src/services/mathdeskAI.ts` rather than calling `fetch` directly. The adapter currently preserves the existing n8n contract:

```json
{
  "message": "Explain this problem",
  "mode": "solve",
  "hasImages": false,
  "images": []
}
```

Supported modes are `solve`, `learn`, `practice`, and `deskbot`. The existing workflow returns `text/plain`; the adapter validates HTTP errors, empty responses, network failures, caller cancellation, and the existing 60-second timeout.

Endpoint precedence is:

1. `VITE_MATHDESK_API_URL` — future stable API gateway
2. `VITE_N8N_WEBHOOK_URL` — current local n8n / tunnel endpoint

This allows the endpoint to migrate without changing React components or packaged clients.

## Validation

```bash
npm run check
npm run build
```

## Phase 4 capabilities

The redesign now includes a camera capture modal with permission/error fallback, camera switching, capture preview, retake, and upload-to-chat behavior. Camera tracks are stopped when the modal closes or unmounts.

The app shell is installable as a PWA. `public/sw.js` caches the local app shell and same-origin static assets. AI requests remain online-only; the offline shell does not pretend to provide local AI.

Chat drafts are stored under `mathdesk:draft:main` in browser storage and cleared only after a successful send attempt is accepted into the local conversation. The chat shows online/offline status and prevents new AI requests while offline.

The Motion toggle persists under `mathdesk:reduce-motion` and applies an explicit reduced-motion mode in addition to the system `prefers-reduced-motion` media query.

## Phase 5 capabilities

Authentication remains optional for guests, while authenticated users receive session-aware loading of chat history. The active workspace refreshes its cloud history when a user signs in without requiring a page reload.

Saved lessons use a local-first model. Lessons are available immediately in browser storage and are synchronized to Supabase when an authenticated session and network connection are available. The library supports creating, listing, and deleting lessons and clearly distinguishes device-local records from cloud-synced records.

The SQL required for the cloud layer is stored in `supabase/migrations/20260918_phase5_cloud_sync.sql`. It is additive and compatible with the legacy `chat_history` table, including its identity key and existing unique `user_id` constraint.

## Phase 6 readiness

The Supabase migration has been applied to the healthy MathDesk project and both `chat_history` and `saved_lessons` have row-level security enabled. The pre-existing chat table was detected and preserved; the compatibility update is recorded in `supabase/migrations/20260919_phase6_chat_history_compat.sql`. The production bundle builds successfully and the local preview serves the app shell, manifest, and service worker. The main JavaScript bundle is approximately 273 KB raw / 86 KB gzip, while the redesign no longer ships the former 1.9 MB embedded-PNG favicon.

The branch is ready for review, but merging should still be followed by a staging smoke test against the deployed n8n endpoint, Supabase authentication, chat-history save/load, saved lessons, camera permission flow, and PWA install behavior.
