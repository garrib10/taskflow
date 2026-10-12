# Kanban board experience

Issue #44 builds on the merged #94/#19 scanning and mobile decisions, #97 workloads, #98 ordering, #99 capacity, #101 tokens, #102 primitives, #103 shell, #104–#108 domain/state selectors and #113–#116 persistence. No domain rule, capacity limit, schema, or stored preference changes here.

## Board audit and preserved behavior

| Before #44 | Decision and resulting behavior |
| --- | --- |
| Board coordinates forms, criteria, sensors, validated reducer operations, notifications and focus | Retain those owners and shared domain boundaries; add presentation state for active mobile stage and drag feedback only. |
| Four independent tall rounded panels; mobile vertically stacks all stages | Use a connected four-stage workflow, intentional tablet board scrolling, and one selected stage on mobile. |
| Cards contain full descriptions, checklist editors, repeated Edit/Delete and large ordering buttons | Title-first cards with plain priority/category metadata, concise relationship summaries, a separate grip and a movement disclosure. Description-only search matches include a contextual excerpt. |
| Parent progress scans the board for each card | Build complete-board relationship summaries together, including hidden relatives. No persistent index or speculative memoization. |
| Moving the source card provides feedback and movement returns focus to the title | Keep the source in place, show a lightweight overlay, announce destination/outcome, and restore the movement grip so repeated moves remain fluent. |
| Mouse distance threshold, deliberate touch hold, and real keyboard sensor | Retain sensor policies. Register the dedicated activator separately from the article; keyboard targets stages, pointer/touch can target manual card gaps. |
| Shared validation rejects reverse/skipped moves, full destinations and unfinished parents | Retain it for drag and explicit actions; render textual reasons and preserve state/order on rejection. |
| Priority/manual selectors and persisted Manual preference | Continue using the domain selector and atomic operations. Unfiltered manual pointer arrivals use indicated gaps; keyboard/explicit/filtered arrivals use the approved full-list policy. Filtered same-stage reorder remains unavailable. |
| Empty columns only say “No tasks” | Distinguish no work from no matches; show complete count/capacity even when no occupants are visible. |
| Existing shell, native controls, token focus styles, polite announcements and dialog isolation | Reuse them. No toolbar replacement, UI library, backend or theme work. |

## Structure and interaction

`Board` owns full/filtered context, ordered visible lists, validated actions, sensors, overlay, live feedback and transient mobile navigation. `Column` receives full-board capacity from `getColumnCapacity`, so it never recomputes domain limits. `TaskCard` receives compact information and renders its movement actions only while the disclosure is open. This avoids validating every card's next action during ordinary scanning.

Stage headers show the full count, limited-column ratio and textual availability. To Do and Done remain unlimited; In Progress has five places and In Review three. Near, full and recovered-over-limit states use text as well as color. Outgoing movement remains available from full/over-limit stages.

The title is the primary opener; the body stays selectable. A named, separately focusable grip supports mouse, touch and Space/Enter pickup, Left/Right stage selection, Space/Enter drop and Escape/Tab cancellation. The movement disclosure supplies the next-stage action and, in Manual, Earlier/Later controls. Invalid attempted moves use the same rejection feedback as drag. Manual gap markers show Before/After placement; filtered same-stage reorder explains the restriction.

Cards preserve the full title in their accessible name while clamping the visual preview. Parent cards show “N of M subtasks complete”; children show their parent title. Done cards retain priority metadata. Legacy checklist counts are distinct from independent linked tasks. Full descriptions, relationship management and checklist editing remain reachable through the current editor.

On mobile (600px and below), a labeled native Workflow stage selector changes the single rendered stage. It starts in To Do on a fresh mount and does not persist or change search/status criteria. Stage choices include shown and full totals. Successful movement selects its destination and focuses the moved grip; filtered-out tasks fall back to the destination heading. A sticky destination tray appears during dragging, with accepted/rejected reasons. Explicit movement does not require off-screen targets or dragging.

Movement feedback uses one polite live region, repeated outcomes remain announceable, and unchanged drag-over messages are deduplicated. Rejected drops restore the source grip. Reduced motion removes transitions; controls retain token focus rings and 44px targets. Movement disclosures expand within the card instead of creating clipped popovers in the scrolling board.

## Integration boundary

The [#45 task details implementation](v2-task-details.md) now supplies read-first desktop drawers/mobile sheets and deliberate editing. Title activation opens details; Delete and legacy checklist management are reachable there and inside the editor, retaining existing confirmation/detachment behavior. **#46** retains toolbar/control redesign ownership. The verification below records the original #44 baseline.

## Verification

All checks use isolated synthetic storage, never the owner's saved board. #97's deterministic 20/100/300 tiers are test-only fixtures. Numeric production performance budgets remain #49 work; browser-automation wall time is not application latency.

- Unit/component suite: **458 tests in 42 files**, including full/filtered counts, capacity states, compact content/context, manual placement/rejection, native mobile navigation and real keyboard/touch sensor coverage.
- **34 Chromium production-browser checks**, desktop/mobile projects. New journeys cover the responsive matrix, 200% root text scaling, reduced motion, explicit movement, pointer manual gaps and real browser touch events through the mobile tray. Existing lifecycle, keyboard, filters, migration, recovery and preference journeys remain covered.
- Lint, strict TypeScript checking, production build and diff whitespace checks passed.
- Adapted tests use title activation and editor deletion instead of removed card actions. The existing long app lifecycle test was split into focused lifecycle and restored rejection/deletion journeys after repeatedly exceeding 5000ms in the full run while passing alone. Assertions, isolation and default timeouts remain intact; the browser lifecycle remains continuous. Creation helpers paste the description as a real input interaction while retaining title typing, reducing unnecessary per-character event work in multi-task tests.
- Controlled production-browser inspection restored **20/100/300 records**, with **5/30/90 children** and the approved column distributions. The large board's **30-child family** remains navigable; all 30 description-only matches show excerpts and Reset restores all 300 cards. Existing over-capacity data remains visible.
- Additional pointer inspection verified reverse/skipped movement, full and over-limit destinations, and an unfinished parent with its child hidden by Search. Each rejection retained the stored board byte-for-byte and restored the source grip.
- Containment checks covered **1920×1080, 1440×900, 1280×720, 1024×768, 768×1024, 390×844, 375×667, 360×800, 320×568, 375×300, 844×390 and 1280×375** without page-level horizontal overflow. Tablet scrolling stays inside the board. No application exceptions were observed.

[Desktop screenshot](images/v2-kanban/desktop-1440.png) · [Mobile In Progress screenshot](images/v2-kanban/mobile-390.png) · [Synthetic inspection evidence](v2-kanban-evidence.json)

These are local production-build checks using Playwright's Chromium and mobile emulation. Root text scaling is not actual browser zoom. Physical iOS/Android, native on-screen keyboards, Safari/Firefox, spoken VoiceOver and actual browser-zoom checks remain targeted #47/release verification; no new certification is claimed. #49 retains repeated numeric performance-budget measurement.


## Files changed

- Board/Column/TaskCard components and owned CSS: workflow structure, compact records, drop adapter, grip and mobile presentation.
- `boardPresentation.ts` and `StageDropTarget.tsx`: complete-data card summaries/search excerpts and mobile destinations.
- `keyboardCoordinates.ts`: stage metadata and mobile tray targeting.
- TaskForm and its CSS: narrow Delete/checklist bridge only.
- Board/application/keyboard/touch tests and journey helpers: changed entry points, focus, counts, ordering and retained domain/persistence journeys.
- `e2e/board.spec.ts`, test-only `boardFixtures.ts` and adapted existing browser journeys: responsive/touch/manual behavior plus migration/recovery/preferences.
- README, this audit, inspection evidence and two screenshots: implementation and review record.
