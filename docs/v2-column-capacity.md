# Column capacity domain contract

Issue #106 implements the fixed policy approved in #99 under #21. `COLUMN_CAPACITY` in `src/domain/board/boardCapacity.ts` intentionally represents every status: To Do and Done are unlimited (`null`), In Progress has five slots, and In Review has three. Configuration is frozen application data, never a user preference or persisted field.

## Source audit and mutation authority

The domain board owns four columns and their task records. No legacy WIP enforcement was present; the toolbar's optional capacity slot was unused. The full board remains separate from `filterBoardColumns`, ordered visible projections and responsive presentation.

| Current path | Occupancy effect and enforcement |
| --- | --- |
| Pointer, touch and keyboard drag movement | All dispatch `MOVE_TASK`; full-board validation and reducer validation share the capacity decision. |
| Priority or Manual cross-column movement | The same `MOVE_TASK` action checks capacity before committing task status, source removal and destination ordering together. |
| Independent or linked task creation | `CREATE_TASK` / `CREATE_CHILD_TASK` require To Do and evaluate its unlimited capacity after identity and relationship eligibility. No direct creation in another status exists. |
| Task editing | `TaskEdits` contains title, description, priority and category only. `updateTask` copies those fields explicitly; neither the form nor reducer accepts an edited status. |
| Parent reassignment | `SET_PARENT` changes links only; it never changes status or occupancy. Each parent and child remains a separately counted task. |
| Deletion | Removes only the requested record; confirmed parent deletion detaches surviving children without moving or deleting them. Slots become available immediately. |
| Manual initialization, repair and same-column reorder | Only ordering metadata changes. Eligible reorder remains allowed at or above capacity. |
| Persistence load, migration and recovery reload | Hydration is restoration, not an incoming mutation. Existing schema validation/migrations preserve valid over-limit boards. Recovery retry saves the current board; it does not create tasks or add occupancy. There is no user import or destructive board reset action. |

All current status-changing board actions therefore pass through one authority. Task-level constructors/movement helpers do not commit board membership. Future direct-to-status creation, status editing, imports or compound arrivals must validate eligibility and use the shared capacity policy against the complete proposed board before committing; they must not directly replace reducer state or reuse a visible projection as the domain board.

## Semantic results and validation order

`getColumnCapacity(fullBoard, status)` counts actual column membership, including hidden tasks, parents and children. Limited results contain status, count, limit, clamped remaining slots and `available`, `near` (one slot remains), `full` or `over`. Unlimited results carry `null` limit/remaining and `unlimited` state. `evaluateIncomingCapacity` distinguishes allowed decisions from blocked arrivals, and reports whether an operation adds occupancy. A same-status placement consumes no slot.

Existing action eligibility takes precedence over capacity. Move validation resolves identity and existing child-parent integrity first, then source/destination consistency, workflow transition, incomplete-child/completed-parent restrictions and manual metadata/placement eligibility. Capacity is last. Creation validates identity, To Do placement, existing manual metadata and the proposed relationship before evaluating To Do capacity. Count-neutral edit/reassignment/reorder actions keep their existing validation. Regression tests establish precedence for missing identity/parent, invalid workflow and stale placement over a full destination.

`capacity-exceeded` extends the existing discriminated operation error with task ID and a structured limited-column result. The policy itself has no notification dependency or wording. The existing validation message explains the destination, total count/limit, unchanged task and hidden-task counting. The existing warning variant supplies manual dismissal and one polite announcement; no new notification variant or timer is introduced.

## Recovery and ordering guarantees

A valid saved board at or above a limit loads without task loss, automatic relocation or rewriting. Count-neutral edits and eligible same-column reorders remain available. Eligible exits/deletions reduce occupancy; an exit still requires space if its destination is limited. New incoming work is blocked until the destination has a free slot. Malformed core/order data retains the existing safe recovery behavior rather than being silently repaired by capacity checks.

Rejected actions return the identical board reference, preserving every task, priority, timestamp and manual ID position. Accepted movement commits membership, status and source/destination order atomically through the existing reducer. Priority ties and latent Manual positions keep the #105 rules. Search, combined filters and both ordering projections never enter capacity calculations.

## Persistence and deferred presentation

Derived counts and configuration are excluded by the existing persistence whitelist. Valid current schema-2 and v0/v1 migrated over-limit boards retain all tasks; optional valid manual metadata still round-trips. No schema/version/migration code changes are needed here.

#44/#46 own visible capacity indicators, board redesign and controls; the current UI still displays Priority with no Manual mode control. Same-column Manual reorder and selector switching are therefore verified at the domain boundary. #113–#115 remain responsible for the formal v2 persistence, migration and recovery rollout; fixed limits and derived capacity state do not belong in those saved boards.

## Verification coverage

Domain/reducer tests cover both limits, unlimited columns, full-board search/filter/order independence, parent/child counting, all movement input contexts, immutable rejection, validation precedence, edits, deletion, same-column reorder and eligible full/over-limit exits. Persistence tests restore current and legacy over-limit boards without loss and verify that configuration/counts are omitted from serialized data. A desktop/mobile browser journey blocks a filtered keyboard arrival without saving a partial update, then frees a slot, accepts the move and restores it after refresh. Existing application, relationship, ordering and persistence journeys remain the regression baseline.

All 366 Vitest tests in 36 files passed with default settings; the focused capacity/persistence/notification files passed 29 cases. Lint, strict TypeScript checking and the production build passed. All ten desktop/mobile Chromium cases passed against the built app. Separate pointer checks verified below-limit arrivals with latent manual metadata and full-column rejection with/without combined filters, preserving storage and order after refresh. Explicit type-import extensions in `Board.ts` and `Task.ts` let Playwright's Node ESM checking reuse the exact policy without duplicating limits. No new dependencies or compiler settings were introduced.
