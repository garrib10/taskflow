# Task details and focused drafting

Issue #45 completes the detail boundary left by #44. Board titles open a read-first desktop drawer or a mobile sheet (600px and below). Full titles and descriptions, stage, priority, category, creation time, parent navigation and complete child lists live here. The board retains its compact scanning surface.

## Interaction decisions

- Details initially focus the full task heading. Edit task deliberately opens the existing draft owner; Create Task opens the drafting form directly. Saving or cancelling a root edit returns to the board. Related-task navigation opens that task's details. Closing restores its board title or Search if filters hide it.
- Form headings explain the action and distinguish draft content from related operations. Description uses the application font, stage labels use existing stage tokens, and primary actions remain reachable in the scrolling form. Required labels, character counts, domain validation, field-error association and invalid-field focus remain intact.
- Child navigation/creation remains in details and editing; Manage Parent is available only in editing. The parent badge uses the same component directly below the header title in both views. Children sort oldest first and retain full titles and textual stages. Child creation inherits parent priority/category, saves independently and returns to refreshed parent details with focus on Add SubTask. Editor child operations preserve an unfinished parent draft. A note explicitly explains that related work saves separately.
- Escape and Cancel protect dirty content and parent-selection drafts with a discard confirmation. Keep Editing retains the draft/selection and restores focus. Dirty task and relationship forms register a native beforeunload guard and remove it on cleanup; browsers control whether a page-leaving prompt is shown. No automatic draft persistence or history routing is introduced.
- Deletion remains explicit in details and the editor, with the existing safe default confirmation. Parent deletion explains that children survive independently. Draft-discard consequences remain in deletion copy. Cancellation restores the destructive action trigger; successful deletion focuses surviving work.
- Completed parents cannot create new children. Existing legacy checklists remain distinguishable and manageable with their existing domain policies. Stage changes use the labeled selector in task/subtask editing; details show a stage badge, while retaining the shared validated movement operation. Dragging remains available on the board.

`TaskDetails` owns presentation mode only. `TaskForm` retains content drafts; `TaskRelationshipForm` retains its parent selection. Board dispatch/validation, relationship selectors, capacity, ordering, notifications, storage and schema are unchanged. The shared modal focus/isolation hook is reused. The hidden details container has no dialog role or content while another view is active, preventing duplicate dialog/label queries.

## Verification and review

- Full unit/component baseline: **467 tests in 43 files** passed.
- Full production-browser baseline: **46 Chromium checks** passed across desktop and mobile projects.
- The reviewed implementation passed the full unit/component suite (467/467) and full production-browser suite (46/46). Final metadata alignment was also checked with the long-content desktop/mobile browser journeys. The initial #45 implementation had one existing 5000ms family-completion timeout in an overlapping component/browser run; sequential full verification passed without timeout/configuration changes.
- Lint, strict TypeScript checking and production build passed.
- New coverage verifies read-first entry, related navigation, explicit editing, validation focus, unsaved-content/relationship cancellation, refresh guards, child creation, updated progress, deletion cancellation and focus return.
- Browser containment/reachability checks use 150-character titles, 300-character descriptions and 30-child lists at 1440×900, 768×1024, 390×844, 375×667, 320×568, 375×300 and 844×390. All child rows and Save Changes remain reachable without page-level horizontal overflow. Existing lifecycle, movement, migration/recovery and preferences browser coverage also passes.
- Screenshots use isolated synthetic storage and a local production preview: [desktop details](images/v2-task-details/desktop-details.png), [mobile details](images/v2-task-details/mobile-details.png), [desktop editor](images/v2-task-details/desktop-editor.png), [mobile editor](images/v2-task-details/mobile-editor.png).

These checks use Chromium and mobile emulation. Physical device keyboards, actual browser zoom, spoken VoiceOver and Safari/Firefox remain targeted #47/release verification. The board branding/palette and alternate themes discussed during #44 review remain a separate visual pass; #46 owns toolbar redesign.

## Visual review revisions (October 13, 2026)

The first creation-form pass retained too much of the old layout. Owner review requested a substantive compact composer, removal of board movement clutter, restored blue completion marks and a top-right ×.

- Creation/editing now use a compact 520px composer: a single heading, quiet header surface, ×, counters beside labels, tighter content spacing, side-by-side metadata, a separately scrolling body and a fixed action footer. Description stays in the application font. The extra “New work” eyebrow is removed. The × follows the same dirty-draft guard as Cancel/Escape.
- Board cards no longer render the “…” movement disclosure. Their dedicated drag grip is retained. A labeled Stage selector in details saves immediately through the same validated operation; sequential stages, full-board capacity, unfinished-parent completion and manual arrival policies are preserved. Errors appear beside the selector without closing details or changing the saved stage. Manual Earlier/Later controls live only in details and remain unavailable under filters.
- Completed linked subtasks have a blue completion mark in the parent’s child list and on their board card. The mark supplements textual stage/context. Decorative card icons do not alter the full title’s accessible name.
- Details use an accessible 44px × control instead of a text Close button, with unchanged Escape and focus-return behavior. Editor and creation headers use the same control.

Updated screenshots include the [desktop composer](images/v2-task-details/desktop-create.png) and [mobile composer](images/v2-task-details/mobile-create.png), plus the refreshed details/editor images above. Validation results below cover the reviewed implementation.

Review-revision verification: 465 unit/component tests in 43 files, 42 production Chromium browser checks, lint, strict TypeScript, production build and diff checks passed. The two long-content browser checks were repeated after the final metadata alignment adjustment. Screenshots use synthetic data; no owner storage was inspected.

## Parent context and editor consistency

Follow-up review aligned the parent badge beneath the title area in both details and the editor using one `TaskParentLink` component and its owned CSS. Plain child titles gain link styling only on hover or visible keyboard focus. Details no longer expose Manage Parent or an empty related-work section for a linked child; parent assignment/detachment stays in the editor.

The editor now provides Stage for every existing task/subtask, including nested subtask editors. Stage changes save immediately through the same Board movement callback as details and update the board/mobile destination stage. Text and metadata drafts remain untouched until Save Changes. A failed move preserves both the current stage and any content draft, associates the error with Stage and focuses that control. The helper text makes this separate-save behavior explicit. Existing workflow/capacity/parent-completion rules are retained.

Consistency verification: 466 unit/component tests in 43 files and 44 Chromium browser checks passed, including identical badge styling, editor-only parent management, hover/focus child links, immediate editor stage movement with draft preservation, rejection and refresh. Lint, strict TypeScript and production build passed. [Mobile subtask details](images/v2-task-details/mobile-subtask-details.png) · [Mobile subtask editor](images/v2-task-details/mobile-subtask-editor.png) · [Desktop subtask details](images/v2-task-details/desktop-subtask-details.png) · [Desktop subtask editor](images/v2-task-details/desktop-subtask-editor.png).

## Final control-layout review

Details are read-only for Stage; only the editor provides the selector. The editor groups Stage, Priority and Category in that order on one compact row. Creation retains its two metadata fields. The stage helper sentence is removed. Delete task shares the fixed footer row with Cancel and Save Changes, including narrow mobile widths. Existing confirmation and draft protection are retained.

Only completed child tasks render a blue checkmark in parent lists. Incomplete children retain blank alignment space, without an empty circle, in both details and editing. Stage changes in editing still use the shared validated movement operation and persist immediately; the domain rules, data model and content-draft behavior are unchanged.

Final layout verification: 467 unit/component tests in 43 files passed; the final affected component checks passed 30/30. The focused details browser checks passed 12/12 and the full production Chromium suite passed 46/46. New layout assertions verify read-only details, only completed child marks, one dropdown row and one three-button footer row at 1440, 390, 375 and 320px, with no page-level overflow. Lint, strict TypeScript, production build and diff checks passed. Screenshots above were refreshed from the final production build.

## Compact related-work actions

When an edited task can both create a child and manage its parent, Add SubTask and Manage Parent share a compact row with natural button widths. Eligibility remains unchanged: existing parents retain child creation within their list, and linked subtasks retain parent management only. Verified alignment, 44px targets and both dialog actions at 1440, 390 and 320px against the production build; the 21 existing Board relationship tests, lint, strict TypeScript, build and diff checks passed. [Desktop row](images/v2-task-details/desktop-related-actions.png) · [Mobile row](images/v2-task-details/mobile-related-actions.png).
