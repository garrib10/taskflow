# Safe persistence recovery (#115)

This completes the recovery boundary defined by [#113](v2-persistence-schema.md) and activated by [#114](v2-data-migration.md), under parent #43. Schema 3, `taskflow-board`, legacy transformations, starter-board initialization and the explicit multi-tab reload policy are unchanged. No preferences writer, export, backup or backend is added.

## Failure-path audit

Before #115, decoding/migration failures already preserved saved bytes and suppressed writes. The application showed an explicitly unsaved empty workspace, or validated tasks for damaged order, with a warning/reload handoff. Write failure had a retry action but later edits could also trigger repeated save attempts. Read failures had no direct retry. There was no confirmed replacement or selective repair UI. Unexpected migration exceptions were classified as storage-unavailable by the outer catch; validator reasons could include private IDs.

The following maps the final behavior. All unresolved states retain usable local work and pause automatic writes. “Original preserved” means no automatic mutation during failure hydration; storage races and postflight exceptions are discussed below.

| Outcome | Hydrated state / original | Feedback and safe continuation | Meaningful action / destructive capability | Coverage |
| --- | --- | --- | --- | --- |
| Missing data | Existing starter policy; one validated initial write | Normal usable board | No replacement action | Session, migration, browser |
| Current valid schema | Saved board; no hydration rewrite | Normal usable board | None required | Storage, session, browser |
| Valid legacy migration | Fully validated migrated board; one complete write | Upgrade information after verified save | Failed writeback: explicit save retry | Migration, recovery, browser |
| Malformed JSON | Clearly unsaved empty workspace; raw preserved | Restoration error, temporary work allowed | Confirmed replacement or reload | Recovery unit/component/browser |
| Structurally invalid envelope/source/current core | Clearly unsaved empty workspace; raw preserved | Restoration error, temporary work allowed | Confirmed replacement or reload | Storage/schema/recovery |
| Unsupported legacy / conversion failure | Clearly unsaved empty workspace; original preserved | Upgrade error, temporary work allowed | Confirmed replacement or reload | Migration/recovery |
| Migration exception | Same fallback; original preserved | Upgrade error, generic diagnostic code | Confirmed replacement or reload | Mocked converter exception |
| Unknown future schema | Unsaved empty workspace; opaque raw preserved | Error recommends newer TaskFlow version | Compatible reader preferred; explicitly confirmed replacement available | Recovery/migration |
| Read exception / browser access restriction | Unsaved empty workspace; no write attempted | Read error, temporary work allowed | Confirmed read retry; no replacement while unread | Recovery unit/component |
| Write exception / quota / restricted writes | Current edited or migrated memory remains | Unconfirmed-save error; never success | Explicit save retry with latest memory; no automatic loop | Storage/session/recovery |
| Migration writeback failure | Successfully migrated memory remains; original retained on failed write | Explicitly says upgraded memory is usable but save unconfirmed | Save retry without reconversion | Migration/recovery |
| Valid core, damaged manual order | Valid tasks/links and unaffected lists; damaged lists omitted; original preserved | Priority/unsaved warning | Confirmed selective repair; no whole-board replacement | Migration, recovery unit/component/browser, hook |
| Valid over-capacity board | Hydrates normally; no trimming | Existing domain capacity feedback on further mutations | No recovery action needed | Schema, migration, repair/browser |
| Other-tab replacement/removal or stale preflight | Current local work retained; external snapshot not overwritten | Conflict warning/error, saving paused | Existing confirmed reload; no merge/adoption | Storage/session/recovery |
| Invalid live board candidate | Local memory retained; previous saved value unchanged | Save-safety error | Reload; no automatic default/reset | Storage/recovery |

## State ownership and write policy

`PersistenceSession` owns a discriminated `RecoveryState`: `ready`, `read-failed`, `invalid`, `migration-failed`, `future`, `order-recovery`, `write-failed`, `conflict`, or `invalid-board`. Its stable external-store snapshot contains the recovery state and a separate typed notice. The domain board, component dialog selection, and dismissible notification remain separate owners.

Automatic saving runs only in `ready`. Failed saves enter `write-failed`; subsequent edits remain local without repeating failed writes or announcements. Explicit retry saves the latest complete board. Successful validated hydration/migration enables writes; successful verified retry or confirmed recovery restores `ready`. Dismissing or timing out a notice does neither. Current-schema hydration, duplicate effects and restored candidate identity do not cause redundant writes.

The hook blocks Manual initialization, reordering, domain repair and Manual movement while saved order is unresolved. Priority edits may remain in memory. Its private restoration action applies only successfully read/recovered boards without changing public domain action types.

## Actions

- **Retry reading saved board:** available only after inaccessible storage. Confirmation warns that successful restoration replaces temporary work. Repeating a failed read retains local work and the paused state. If access returns but the payload is invalid/future, no board is applied; the matching recovery actions appear. Current valid restore requires no rewrite; migrated/missing restore uses the existing validated writeback/initialization policy.
- **Retry saving:** available only after failed saving. Uses current memory without re-running legacy conversion. Failed retry remains paused and never claims success. Stale source becomes a conflict.
- **Repair saved order:** available only for validated core with damaged order. Confirmation explains that local edits will be saved. Rebuild only affected columns from the full current Priority projection, including hidden tasks and stable arrival ties. Preserve tasks, relationships, unaffected valid lists, uninitialized markers, timestamps and over-capacity membership. Validate the entire result; do not select Manual automatically.
- **Replace saved board:** available only for invalid, migration-failed or future data. Confirmation explains irreversible replacement of this browser's saved board and loss of unsaved local work. Future-version messaging first recommends a compatible reader. Write the existing starter board only after confirmation. Do not offer destructive replacement for unread, healthy, conflict or order-only states.
- **Reload saved board:** retains the existing confirmation and explicit discard/reload policy. Closing a warning is only dismissal, not resolution.

## Preservation and atomicity

Normal saves cannot overwrite invalid, unsupported or damaged-order sources. Dedicated confirmed recovery checks the exact expected raw snapshot and eligible typed source outcome immediately before writing. Every candidate is projected and validated in full. Repair/replacement uses a single `setItem` on `taskflow-board`; other keys remain untouched. No `clear`, delete-first reset, partial task writes, silent defaults or automatic rollback are used.

The single replacement write refines #113's proposed remove-then-initialize reset while preserving its schema and starter policy: removing first could destroy the original before a quota failure. A failed `setItem` leaves the original value intact, and cancellation never writes. Success requires a matching postflight read. LocalStorage has no compare-and-swap: another tab can race between checks, or postflight access can fail after a complete write. Such outcomes remain explicitly unconfirmed/paused; we do not promise old bytes after every postflight failure or attempt a rollback that could erase newer work.

## Feedback, accessibility and diagnostics

Restoration failures use typed errors; damaged order and conflicts use warnings; successful migration uses information; verified recovery uses success. Migrated-memory writeback failure explicitly distinguishes usable memory from unconfirmed persistence. A persistent, wrapping storage panel retains actions after notification dismissal. It is not a second live region: the existing notification announces each actual transition once, and ordinary renders preserve notice identity.

Existing accessible `ConfirmModal` supplies dialog name/description, Cancel initial focus, focus trapping, Escape and opener focus restoration. Successful recovery removes the opener and focuses Create Task. Destructive labels explicitly say Replace; retry/repair confirmations use primary styling. Browser coverage exercises narrow touch viewports, 200% text sizing and keyboard-only cancellation/confirmation.

Collapsed troubleshooting details expose only generic codes, version numbers or affected-column counts. The decoder's smallest typed extension adds sanitized reason codes and contains migration/validation exceptions without displaying payloads, IDs, content, stack traces or exception text. No error-string matching is used.

## Verification and deferrals

New pure tests exercise preservation, explicit retries, source races, selective repair, quota failure and diagnostics. Component tests exercise dismissal, confirmation/cancellation, focus, read retry, failed replacement and stable announcements; hook coverage guards Manual actions during order recovery. Focused Chromium journeys use synthetic, isolated browser data for replacement failure/retry and filtered selective repair alongside the existing fresh/current/legacy migration checks.

[#116 now implements independent ordering-preference storage, guarded Manual restoration and preference/board failure combinations](v2-view-preferences.md). Search/filter state remains mount-local. No auto-adoption, merge, export, backup, schema redesign or board redesign is introduced. Parent #43 remains open.

### Branch verification (October 11, 2026)

- Focused new/updated recovery, hook and accessibility checks: **26 tests passed in 4 files**.
- Final unmodified `npm test`: **422 passed in 39 files**, including **22 added unit/component/hook tests**.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- `CI=1 npm run test:e2e:ci` against the production build: **22 passed**, comprising the 16 existing checks and 6 recovery executions (three journeys on desktop/mobile). Synthetic read/write restrictions are isolated to the test browser context.
- Initial full-suite validation exposed an older accessibility assertion expecting invalid data to be a warning; it now asserts exactly one restoration-error alert and no duplicate status announcement. A separate run alongside Chromium timed out in the unchanged application lifecycle journey at the existing five-second limit. That journey passed alone, then all 422 tests passed in the final full run without competing jobs. No timeout, isolation or testing-foundation changes were made; timing under heavy contention remains a limitation.
- Diff whitespace check passed. No schema transformations, dependencies, capacity rules, preference writer or unrelated feature changes.
