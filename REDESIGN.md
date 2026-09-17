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
