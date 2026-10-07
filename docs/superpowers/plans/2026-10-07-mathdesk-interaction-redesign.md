# MathDesk Interaction Redesign and Staging Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the current MathDesk `main` implementation with the handoff requirements, refine homepage and chat interactions, add persistent app-wide theming, tighten reload behavior, and validate conversation sharing against the existing Supabase project without publishing to production.

**Architecture:** Keep the existing React/Vite application and its current component boundaries. Add a small app-level theme controller that owns `data-theme`, localStorage persistence, system-default initialization, and the portfolio-inspired view-transition sweep; use CSS tokens for the two themes rather than duplicating component markup. Keep homepage effects layered independently: graph-paper background, Desky particle canvas, cursor trail, and background-only ripple. Refactor the chat sidebar into one semantic navigation model with desktop/tablet collapsed-rail behavior, phone drawer behavior, icon tooltips, a scroll-only history/lessons region, and an account popover. Treat the Supabase sharing migration and hardening as a separately reviewable staging phase; no production deployment occurs in this branch.

**Tech Stack:** React 19, TypeScript, Vite, CSS custom properties, `lucide-react`, Supabase JS/MCP, existing GitHub Pages deployment files.

**Spec:** User decisions in the current conversation plus the handoff audits in `MathDesk Handoff/MathDesk Current Additions Audit — 7 October 2026.md`, `MathDesk Handoff/MathDesk post-hardening audit update.md`, and `MathDesk Handoff/MathDesk Conversation Sharing — Security Review.md`.

## Global Constraints

- Work on branch `redesign/interaction-and-staging`; do not push or publish until the user reviews a preview.
- Preserve MathDesk’s blue/cyan brand and Desky identity; borrow BrewedOps’ interaction and spatial feel only.
- The light/dark toggle controls the entire app, persists across reloads, and follows the device system theme when no preference exists.
- Remove floating math-symbol decorations only; retain the cursor trail unless validation shows it is materially noisy.
- The click ripple fires only on empty homepage background, never on buttons, cards, Desky, links, or other interactive elements.
- Desky stays anchored in the hero; dragging corrects rotation/orbit direction rather than translating the logo.
- Collapsed sidebar icons remain directly actionable and expose labels through hover/focus tooltips.
- Phones use a slide-over chat sidebar drawer; tablets and desktop use a collapsed icon rail.
- Sidebar tool controls fit without their own scrolling; scrolling is reserved for saved lessons/history content.
- Account controls use a popover containing Profile, Settings, Help, and Log out; outside click and Escape close it.
- Reload optimization caches only versioned static assets; do not broadly cache dynamic/user/config responses.
- Supabase validation uses the existing MathDesk project as staging with explicit production-risk awareness; never expose service-role credentials.
- Authenticated sharing tests require two disposable accounts created and signed in by the user through the browser; credentials must not be sent in chat.

## Review Focus

- Pointer drag direction and release return: a horizontal/vertical drag must rotate Desky in the same intuitive direction and return cleanly without moving the stage anchor.
- Background interaction targeting: ripple coordinates must align with the click and must not appear after activating controls or clicking cards.
- Theme initialization and persistence: system preference applies only when no saved preference exists; a saved choice wins across route changes and reloads, including chat/tool dialogs.
- Sidebar overflow and touch behavior: no tool controls disappear below the fold; history/lessons alone can scroll; phone drawer closes on selection, scrim, and Escape.
- Account/privacy boundaries: switching identity remounts/clears account-scoped UI, and sharing tests prove anonymous denial, owner isolation, token replacement/revocation, expiry, and sanitized rendering.

---

### Task 1: Establish the reviewable branch, plan tracking, and diagnostics

**Files:**
- Create: `TODO.md` if native todo is unavailable
- Modify: `webdev.config` or runtime diagnostic registration only if the Webdev runtime reports missing TypeScript diagnostics

**Interfaces:**
- Consumes: this plan and the handoff audit files.
- Produces: a branch-local outcome checklist and confirmed TypeScript diagnostics.

- [ ] Create outcome items that preserve the exact behavior clauses from this plan and the user request.
- [ ] Inspect the Webdev runtime post-edit registration and enable TypeScript diagnostics if missing.
- [ ] Run the baseline `npm ci`, `npm run check`, `npm run build`, and `git diff --check`; record the baseline before implementation.

### Task 2: Add app-wide persistent theme state and portfolio-style toggle

**Files:**
- Create: `src/components/ThemeProvider.tsx` or `src/context/theme.tsx`
- Modify: `src/App.tsx`, `src/components/MotionToggle.tsx` (or its current theme/motion control source), `src/styles.css`, `index.html`
- Test: add the project’s available TypeScript/unit test harness or a focused browser-verifiable helper test if no test runner exists

**Interfaces:**
- Produces: `ThemeProvider`, `useTheme()`, `theme` (`'light' | 'dark'`), and `toggleTheme(origin?: HTMLElement)`.
- Theme state is applied to `document.documentElement.dataset.theme`; storage key is namespaced to MathDesk.

- [ ] Write failing tests for system-default initialization, saved-preference precedence, and persistence after toggling.
- [ ] Implement the minimal theme controller with a guarded localStorage read/write, `matchMedia('(prefers-color-scheme: dark)')` fallback, and a `document.startViewTransition` sweep centered on the toggle when available.
- [ ] Add the toggle to the homepage and chat-level shell without duplicating state; update CSS tokens for surfaces, text, borders, cards, messages, modals, sidebar, and graph-paper contrast.
- [ ] Respect `prefers-reduced-motion` by disabling the sweep while still applying the theme immediately.
- [ ] Run the focused tests and `npm run check`.

### Task 3: Correct homepage effects and Desky drag semantics

**Files:**
- Modify: `src/components/DeskyParticleLogo.tsx`, `src/components/BackgroundClickWave.tsx`, `src/components/CursorParticleField.tsx`, `src/App.tsx`, `src/styles.css`
- Test: focused interaction tests/helpers for pointer delta sign, background target filtering, and reduced-motion behavior

**Interfaces:**
- `DeskyParticleLogo` keeps the existing anchored stage and exposes no new public prop.
- `BackgroundClickWave` remains a passive canvas layer and accepts only background clicks.

- [ ] Write a failing regression test for positive pointer movement producing the matching yaw/pitch direction, with no position translation.
- [ ] Fix the drag delta/sign calculation and release interpolation without changing the stage’s screen anchor; verify pointer capture and touch release cleanup.
- [ ] Write a failing target-filter test covering the homepage shell, navigation, cards, Desky stage, and buttons.
- [ ] Keep only graph-paper decoration plus Desky and the existing cursor trail; remove/suppress all floating math-glyph/orbit layers and ensure ripple coordinates use the fixed viewport canvas correctly.
- [ ] Tune ripple duration/opacity/radius toward the BrewedOps reference while preserving the background-only target rule and reduced-motion suppression.
- [ ] Run focused tests, `npm run check`, and a built preview smoke test.

### Task 4: Rebuild the chat sidebar interaction model

**Files:**
- Modify: `src/components/ChatWorkspace.tsx`, `src/components/AuthPanel.tsx` only where needed for the account menu contract, `src/styles.css`
- Create: `src/components/AccountPopover.tsx` if the existing compact auth control cannot own the menu cleanly
- Test: focused sidebar keyboard/selection tests

**Interfaces:**
- Sidebar state remains local to `ChatWorkspace`: expanded/collapsed desktop state and mobile drawer state.
- Tool buttons remain directly actionable in collapsed mode.
- Account popover exposes Profile, Settings, Help, and Log out actions and closes on outside click/Escape.

- [ ] Write failing tests for direct action from collapsed icons, tooltip labels, Escape/scrim drawer dismissal, and account popover dismissal.
- [ ] Refactor the sidebar markup so every icon-only control has an accessible name and tooltip, while labels are visually hidden only in collapsed mode.
- [ ] Separate fixed navigation/tools/account controls from the scrollable recent-chat/saved-lesson region; ensure tool controls fit inside the available rail height.
- [ ] Make phone layout a slide-over drawer with focusable close behavior and no permanent horizontal tool strip; retain the collapsed rail at tablet/desktop widths.
- [ ] Add the account popover with outside-click and Escape handling, preserving existing AuthPanel sign-in/sign-out behavior and account isolation.
- [ ] Run focused tests and inspect the 320px, 375px, 768px, and desktop layouts in preview.

### Task 5: Tighten reload performance and service-worker behavior

**Files:**
- Modify: `public/sw.js`, `sw.js` if both remain deployed, `src/styles.css`, `vite.config.ts`, `DEPLOYMENT.md`
- Test: service-worker route/cache smoke tests or deterministic static inspection checks

**Interfaces:**
- Cache only hashed/versioned static assets and the app shell required for install/offline bootstrap.
- Never cache Supabase, n8n, auth, visitor-counter, or other dynamic/user-specific responses.

- [ ] Write failing checks for dynamic-response exclusion and exact static-asset cache matching.
- [ ] Replace broad same-origin GET caching with an immutable-asset allowlist and network-first navigation fallback that does not serve the SPA shell for privacy/terms/404 errors incorrectly.
- [ ] Remove duplicate service-worker source ambiguity or document one canonical deployment source.
- [ ] Add preload/code-splitting or defer changes only where the existing build evidence shows a real cost; avoid speculative dependencies.
- [ ] Run build, inspect bundle output, and verify first-load/reload behavior against the local preview.

### Task 6: Apply and validate conversation-sharing migration in the existing MathDesk project

**Files:**
- Review/modify: `supabase/migrations/20261006000000_conversation_sharing.sql` and related hardening migrations only after SQL review
- Modify: `src/services/sharing.ts`, `src/components/ShareConversationDialog.tsx`, `src/components/SharedConversationPage.tsx`, policy text only where tests reveal mismatch
- Create: staging validation notes under `docs/verification/`

**Interfaces:**
- Preserve the sharing contract: signed-in creator and recipient, read-only fixed snapshot, 30-day expiry, owner revoke/replace, text-only transcript, excluded attachments, hashed bearer token.

- [ ] Review the migration and run static SQL checks for `SECURITY DEFINER`, empty `search_path`, explicit authenticated execution grants, RLS, ownership predicates, and direct-table privilege revocation.
- [ ] Apply the reviewed migration to the existing MathDesk Supabase project only after recording the exact SQL payload and the user’s acknowledged production-risk boundary.
- [ ] Verify object existence and grants with explicit, limited metadata queries; do not read user content.
- [ ] Have the user create/sign in with two disposable accounts through the browser; execute the required anonymous, owner, link-holder, isolation, replacement/revocation, expiry, deletion, limit/race, and sanitization matrix.
- [ ] Fix only evidenced client/SQL defects using TDD/regression tests; never weaken the security contract to make a test pass.
- [ ] Record passed checks, pending checks, and any production-risk caveat in `docs/verification/conversation-sharing-staging.md`.

### Task 7: End-to-end responsive and accessibility verification

**Files:**
- Modify only files implicated by evidence from Tasks 2–6.
- Create: `docs/verification/2026-10-07-redesign-validation.md`

**Interfaces:**
- No new product behavior; this task verifies the integrated surface.

- [ ] Run `npm run check`, `npm run build`, `git diff --check`, and the project test command if present.
- [ ] Verify homepage drag, ripple targeting, symbol removal, theme persistence, reduced-motion behavior, and mobile hero composition.
- [ ] Verify chat collapsed rail, direct icon actions/tooltips, phone drawer, account popover, fixed tools, scroll-only histories/lessons, and no document-level horizontal overflow.
- [ ] Verify auth/account switching does not retain another identity’s tabs/drafts/lessons.
- [ ] Verify service-worker cache behavior and route manifest consistency.
- [ ] Run the Supabase sharing matrix and attach evidence, explicitly listing anything that could not be verified.
- [ ] Build and serve a preview on the dedicated branch; do not push or publish.

### Task 8: Review handoff and release boundary

**Files:**
- Create/update: `docs/verification/2026-10-07-redesign-validation.md`, `REDESIGN.md`, `DEPLOYMENT.md` as needed

- [ ] Review the full diff against current `main` and ensure no credentials, temporary preview hosts, or generated caches are tracked.
- [ ] Confirm the preview URL and exact branch name for user review.
- [ ] Stop before push/merge/deployment and present the user with the preview, verification evidence, unresolved issues, and the exact release payload for separate approval.
