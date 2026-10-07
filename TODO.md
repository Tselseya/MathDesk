# MathDesk Redesign and Staging Validation Outcomes

- [ ] Reconcile the current `main` implementation on branch `redesign/interaction-and-staging`; preserve MathDesk’s blue/cyan brand and Desky identity while borrowing BrewedOps’ interaction and spatial feel only.
- [ ] Add an app-wide light/dark toggle that persists across reloads and follows the device system theme when no saved preference exists.
- [ ] Correct Desky’s anchored drag behavior so pointer movement produces intuitive rotation/orbit direction without translating the logo.
- [ ] Remove all floating math-symbol decorations while retaining the cursor trail unless validation shows it is materially noisy.
- [ ] Make the homepage click ripple fire only on empty graph-paper background, never on buttons, cards, Desky, links, or other interactive elements.
- [ ] Keep collapsed chat-sidebar icons directly actionable and expose their labels through hover/focus tooltips.
- [ ] Make the phone chat sidebar a slide-over drawer and keep a collapsed icon rail on tablets and desktop.
- [ ] Keep sidebar tool controls visible without tool-area scrolling; reserve scrolling for recent chats/saved lessons content.
- [ ] Add an account popover containing Profile, Settings, Help, and Log out, closed by outside click and Escape.
- [ ] Optimize reloads by caching only versioned static assets and excluding dynamic, auth, user, and configuration responses from broad service-worker caching.
- [ ] Apply and validate the conversation-sharing migration against the existing MathDesk Supabase project with anonymous denial, two-account isolation, token replacement/revocation, expiry, deletion, limits, race, and sanitization checks; do not expose service-role credentials.
- [ ] Have the user create and sign in with two disposable test accounts through the browser for authenticated sharing validation; do not request credentials in chat.
- [ ] Run the integrated responsive, accessibility, security, build, and preview checks and stop before push/merge/deployment for user review.
