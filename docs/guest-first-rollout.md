# Guest-first rollout notes

This branch changes the frontend to allow core MathDesk use without a named account, stores guest conversations and lessons in browser-local storage, adds JSON backup import/export, and makes shared snapshots viewable by anyone holding the high-entropy share URL.

## Required Supabase project setting before enabling guest AI

1. Open Supabase Dashboard → Authentication → Sign In / Providers (wording may vary).
2. Enable **Allow anonymous sign-ins** for the MathDesk project.
3. Do not enable public table access for chat or lesson tables. Guest chats and lessons stay in browser storage.
4. The existing `mathdesk-ai` Edge Function already validates Supabase sessions and applies server-side UUID quotas. No Edge Function source change is needed for anonymous sessions; verify the currently deployed function remains active.
5. Apply `supabase/migrations/20261023000000_public_share_links.sql` only after reviewing it. It grants `anon` execution on the token-only getter; it does not grant table access. Create/status/revoke remain authenticated owner operations.
6. Verify an anonymous browser can solve a problem, a public share works without signing in, and an expired/revoked link returns unavailable.

## Data behavior

- Local chat and lesson data is partitioned by browser/account scope.
- Export from Workspace → Saved lessons → **Export chats & lessons**.
- Import the JSON backup from the same dialog. Import merges by conversation ID and keeps existing local records.
- Browser-local data is not a server backup and does not automatically move to another browser/device.
- Existing cloud records and auth users are not deleted by this branch.
- Share creation, replacement, and revocation still require the owner to sign in; only reading a share snapshot is public.

## Validation status

The GitHub Actions workflow runs type-check, Vitest, and production build on pull requests. Deployment is skipped for pull requests and only runs on non-PR workflow events. Review the resulting checks before merging. No production deployment or Supabase migration is performed by this branch change.
