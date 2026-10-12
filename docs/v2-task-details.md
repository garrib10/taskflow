# Task details and focused drafting

Issue #45 completes the detail boundary left by #44. Board titles open a read-first desktop drawer or a mobile sheet (600px and below). Full titles and descriptions, stage, priority, category, creation time, parent navigation and complete child lists live here. The board retains its compact scanning surface.

## Interaction decisions

- Details initially focus the full task heading. Edit task deliberately opens the existing draft owner; Create Task opens the drafting form directly. Saving or cancelling a root edit returns to the board. Related-task navigation opens that task's details. Closing restores its board title or Search if filters hide it.
- Form headings explain the action and distinguish draft content from related operations. Description uses the application font, stage labels use existing stage tokens, and primary actions remain reachable in the scrolling form. Required labels, character counts, domain validation, field-error association and invalid-field focus remain intact.
- Parent and child management remains available in both details and the editor. Children sort oldest first and retain full titles and textual stages. Child creation inherits parent priority/category, saves independently and returns to refreshed parent details with focus on Add SubTask. Editor child operations preserve an unfinished parent draft. A note explicitly explains that related work saves separately.
- Escape and Cancel protect dirty content and parent-selection drafts with a discard confirmation. Keep Editing retains the draft/selection and restores focus. Dirty task and relationship forms register a native beforeunload guard and remove it on cleanup; browsers control whether a page-leaving prompt is shown. No automatic draft persistence or history routing is introduced.
- Deletion remains explicit in details and the editor, with the existing safe default confirmation. Parent deletion explains that children survive independently. Draft-discard consequences remain in deletion copy. Cancellation restores the destructive action trigger; successful deletion focuses surviving work.
- Completed parents cannot create new children. Existing legacy checklists remain distinguishable and manageable with their existing domain policies. Status movement remains a board operation, rather than a free-form editor field.

`TaskDetails` owns presentation mode only. `TaskForm` retains content drafts; `TaskRelationshipForm` retains its parent selection. Board dispatch/validation, relationship selectors, capacity, ordering, notifications, storage and schema are unchanged. The shared modal focus/isolation hook is reused. The hidden details container has no dialog role or content while another view is active, preventing duplicate dialog/label queries.

## Verification and review

- Full unit/component baseline: **462 tests in 43 files** passed.
- Full production-browser baseline: **38 Chromium checks** passed across desktop and mobile projects.
- Final full unit/component suite (462/462) and four details browser checks passed after the parent-selection refresh guard and helper-copy refinement. An overlapping component/browser run hit the existing 5000ms family-completion timeout once; sequential full verification passed without timeout/configuration changes.
- Lint, strict TypeScript checking and production build passed.
- New coverage verifies read-first entry, related navigation, explicit editing, validation focus, unsaved-content/relationship cancellation, refresh guards, child creation, updated progress, deletion cancellation and focus return.
- Browser containment/reachability checks use 150-character titles, 300-character descriptions and 30-child lists at 1440×900, 768×1024, 390×844, 375×667, 320×568, 375×300 and 844×390. All child rows and Save Changes remain reachable without page-level horizontal overflow. Existing lifecycle, movement, migration/recovery and preferences browser coverage also passes.
- Screenshots use isolated synthetic storage and a local production preview: [desktop details](images/v2-task-details/desktop-details.png), [mobile details](images/v2-task-details/mobile-details.png), [desktop editor](images/v2-task-details/desktop-editor.png), [mobile editor](images/v2-task-details/mobile-editor.png).

These checks use Chromium and mobile emulation. Physical device keyboards, actual browser zoom, spoken VoiceOver and Safari/Firefox remain targeted #47/release verification. The board branding/palette and alternate themes discussed during #44 review remain a separate visual pass; #46 owns toolbar redesign.
