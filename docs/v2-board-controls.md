# Board controls (#46)

## Audit of merged develop

The starting point is `af7f0b0`, including merged #44 (board) and #45 (details/forms). Search is an immediate, case-insensitive substring match on task titles and descriptions. Priority, Category and Status selects combine with search using AND. Their native labels work, but desktop search has a side label and emoji icon while the other controls use top labels. The toolbar wraps into several uneven rows at tablet widths.

`useBoardViewPreferences` owns session-only criteria; each setter preserves the other conditions. `resetCriteria` clears only those criteria. Board owns focus after reset. The visible action says “Reset,” without explaining its scope. No active values are shown outside the selects; mobile only exposes their count in “Filters (n).” Search has the browser's platform-dependent clear affordance but no consistent named clear action.

Board derives matching columns/count from `filterBoardColumns`. A live “n tasks found” appears only while filtering, separately from the total in the Workflow heading. Columns already distinguish genuine emptiness from hidden results and retain full-board capacity counts. There is no whole-board zero-result recovery action.

Priority ordering is High → Medium → Low with stable per-stage arrival ties (`taskPriority`, `selectOrderedTasks`). There is no dynamic age/due-date score. Manual uses the independent complete-column ID order; filtering projects visible IDs after ordering, never repairs or rewrites positions. Same-stage manual reordering is disabled whenever any search/filter is active; cross-stage movement keeps the existing validation/top-insertion policy. `useOrderingPreference` persists the selected mode independently; first Manual selection follows its existing initialization/durability gate. The toolbar currently labels the mode but does not explain these rules.

Desktop exposes every select. At 600px and below, BoardToolbar owns the temporary filter-sheet disclosure, exposing expanded state; `useModalFocus` handles initial focus, containment, background inertness, Escape and restoration. Search and ordering stay outside the sheet. Native controls, shared Button/Field primitives, existing tokens and focus/reduced-motion rules can be reused; no new library or state owner is needed.

Existing coverage includes domain title/description/multi-filter selectors, the view-state hook's independence from saved board data, toolbar mobile sheet/focus/resize behavior, Board hidden-capacity/description excerpts, application mode persistence and filtered-reorder restrictions, and desktop/mobile lifecycle/filter/reset journeys. The redesign will extend these behavior checks instead of replacing them with snapshots.

## Implemented interaction

Search now has the same top-label rhythm as the selectors, an SVG search cue, explicit Clear search control and keyboard Escape clearing (including composition protection). Filtering is still immediate. Category → Priority → Status sit in a named native-control group. On wide screens the controls fit one row; intermediate widths wrap intentionally; phones retain visible Search/Ordering plus the established Filters (N) sheet. No filter form is duplicated behind the sheet.

A named list shows only the active query and non-All filters. Search is explicitly distinguished from category/priority/status. Each condition has a specific removal name and full tooltip; long labels truncate visually without losing their accessible name. Removal focuses the next/previous condition or the corresponding native control/mobile Filters trigger. Clear all is named “Clear all search and filters” and disabled when inactive. Clearing the whole scope returns focus to Search; within the modal it stays in the sheet on Priority. Both actions preserve Order, mobile stage, task records, priorities, positions and unrelated preferences.

A single result summary distinguishes total board records from matches across every stage. The separate Workflow total was removed. The immediate visual count is hidden from the accessibility tree to avoid reading it again alongside the settled status. Visible counts update immediately; the dedicated Search results status settles for 300ms to avoid speaking each keystroke, independently of operation announcements. The sheet renders the same result summary while the background copy is absent. Priority help describes only the existing High/Medium/Low and stable arrival behavior. Manual help describes preserved placement and the filtered same-stage restriction; the existing mode selector, initialization, persistence and domain operations are unchanged.

A board-wide zero-result region keeps the stages and active conditions, explains that existing tasks remain, and offers Show all tasks. It is separate from a genuinely empty board and does not use error notifications or steal focus. On mobile, matches in other stages produce a distinct notice and a deliberate View [stage] action; the native stage selector remains independent of Status filtering, and navigation does not clear the query/filters.

## State and scope

The existing `useBoardViewPreferences` remains the only criteria owner; `filterBoardColumns` and `selectOrderedTasks` remain the selectors. Toolbar owns disclosure, removal focus and delayed speech only. Search owns its input focus. Board derives counts and active-condition labels from current state and owns full-scope reset and deliberate stage navigation. No stored result copies, persisted criteria, board schema, domain reducer, capacity, priority algorithm, positions, dependencies or task-form/detail behavior changed.

Native inputs/selects/buttons and shared Button/Field/token styling are retained. The separate polite results and Board updates statuses serve distinct purposes; the notification regression now verifies exactly one of each rather than assuming all statuses represent movement. Labels, grouping, expanded/modal semantics, modal inertness, focus containment/restoration, visible focus and reduced motion remain in place. Existing journey assertions changed only where the visible/accessible Search, clear-all and result labels intentionally changed.

## Review screenshots

Captured from the production build with isolated synthetic representative data (all priorities/categories/stages, equal priorities, parent/child tasks, and full limited columns), not the owner's saved browser data:

- [Desktop, default scope](images/v2-board-controls/desktop-default.png)
- [Desktop, combined conditions](images/v2-board-controls/desktop-active.png)
- [Tablet](images/v2-board-controls/tablet-active.png)
- [Mobile, active conditions outside the sheet](images/v2-board-controls/mobile-active.png)
- [Mobile filter sheet](images/v2-board-controls/mobile-sheet.png)
- [Zero-result recovery](images/v2-board-controls/desktop-zero-results.png)

## Verification

- All **479 unit/component tests in 44 files** passed with the existing timeouts/assertions. Twelve new application checks cover query/description search, combined conditions, each removal/focus fallback, scope-only clearing, independent Manual preference/positions, genuine empty vs filtered empty, capacity, result speech, composition-safe Escape and mobile matching-stage navigation. Existing domain tests retain each independent filter, priority/tie and ordering coverage.
- After the final help-copy/accessibility-tree adjustment, all **16 controls/toolbar checks** passed again.
- All **50 production Chromium desktop/mobile journeys** passed, including four new combined-scope/zero-result executions. The first browser run exposed a stale-coordinate assumption in the existing pointer test when the taller toolbar triggered page autoscroll. That test now follows the live card gap within the same default assertion timeout; its exact placement, reverse-movement and saved-data assertions remain intact. Both focused pointer checks and the entire final browser suite passed.
- Lint, strict TypeScript checking, production build and whitespace/diff review passed.
- Production inspection at **1440, 768, 390 and 320px** confirmed usable wrapped controls, no page overflow, 44px targets, preserved final wordmark and no application exceptions. At 320px, **200% root text** plus a long query and the filter sheet remained within the viewport. Keyboard-only combined-filter/removal/reset and sheet Escape/focus flows are covered by the production journeys; ordering reload and hidden-capacity behavior remain covered by the full suite.

 Real VoiceOver/speech, physical mobile keyboards, Safari/Firefox and browser zoom remain assembled verification in #47; Chromium keyboard, text enlargement and accessibility-name checks do not certify those environments.

The approved #19/#96/#98 contracts were rechecked against the merged source: no fuzzy matching or dynamic score is implied, search speech alone is coalesced, Escape respects composition, the sheet-clear fallback remains Priority, and changing scope preserves the independent mobile stage. Clear all's accessible name includes its visible wording (“Clear all search and filters”) for speech-input consistency.
