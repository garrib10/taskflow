# Responsive application shell and board toolbar

Issue #103 uses the #101 semantic tokens and #102 Button primitive. The former floating header and controls cards are replaced with a compact identity/header, feedback area, toolbar and named workflow region on the page canvas.

## Ownership

`AppShell` owns the banner, timestamp, primary Create Task action, named main landmark, feedback slot, toolbar slot, board boundary and overlay boundary. Fixed overlays have no transformed or clipped ancestor; #45 can supply the approved desktop detail panel or mobile presentation through that boundary.

`BoardToolbar` owns responsive presentation and its filter sheet. Board retains criteria, reset semantics, ordering, workflow operations, keyboard/pointer movement, notifications and task dialogs. App retains storage recovery and reload confirmation. Domain and persistence logic are unchanged.

Optional ordering and capacity slots can receive #46's real controls once implemented. No static ordering label is rendered in the current toolbar.

## Responsive behavior and accessibility

- Above 1100px: search, three labeled selectors and Reset share a row.
- 601–1100px: search and selector groups take separate rows; Reset follows. Workflow columns retain their existing horizontal board scroll.
- At 600px and below: search stays visible; Filters (N) and Reset share the next row. N counts non-All selectors, excluding Search. Filters opens a modal sheet with immediate changes; Done, Escape or backdrop dismissal keep criteria. Clear all criteria clears Search and the three selectors and keeps focus inside the sheet. Closing restores focus to Filters; widening closes the sheet and preserves values.
- Primary controls have at least 44px targets. The filter sheet scrolls within short viewports, uses the existing modal focus/inert machinery, and mounts fresh on each opening. Result feedback appears once, inside the sheet while open.
- Header and toolbar use native labeled controls and semantic landmarks. Existing notifications and dialogs retain their behavior and focus treatment. Existing reduced-motion styles remain active.
- A minimal wrapping correction to the existing card footer keeps badges and Edit/Delete reachable with enlarged text. This is not the #44 card redesign.

The existing mobile vertical column stack is retained. #44 owns the approved one-stage-at-a-time board, compact cards and drag affordances; #45 owns read-first details and form navigation; #46 owns ordering/capacity/control behavior. No sidebar, accounts, routing or new dependency was added.

## Verification

Focused tests cover shell landmarks/creation/overlay placement and desktop/mobile toolbar labels, immediate filtering, single result feedback, reset, focus trapping/restoration, reopening and resizing. Playwright adds a desktop/mobile shell and filter journey and adapts the existing filter journey to mobile disclosure.

Lint, strict TypeScript checking and production build passed. The full suite passed 309 tests in 30 files; all eight Chromium journeys passed across desktop and mobile. Browser inspection covered 1920×1080, 1280×800, 1024×768, 768×1024, 390×844, 375×667, 320×568 and 375×400, plus doubled root text size at 375×667. No page-level horizontal overflow remained. Short-sheet actions, empty-title focus and storage-recovery confirmation layering were also checked. These are Chromium checks, not a new real-device or VoiceOver certification. An existing full application journey initially exceeded 5000ms both on this branch and in an unchanged develop checkout; the complete branch suite subsequently passed with unchanged timeouts and assertions. That timing observation does not establish an application defect.
