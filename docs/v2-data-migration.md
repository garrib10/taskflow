# v2 data migration implementation

Issue #114 implements the [#113 persistence contract](v2-persistence-schema.md). The production key remains `taskflow-board`; the internal current schema is **3**, independently of the application release number. This work does not introduce a second board key, a backup/reset feature, a preference writer or Manual UI controls.

## Audit and implemented pipeline

Before #114, runtime schema 2 supported unversioned boards and schema-1 envelopes. Existing `migrateV0ToV1` restored documented missing legacy fields and columns; `migrateV1ToV2` converted checklist entries into linked child tasks. Schema 2 stored optional manual lists, while old v1.5 readers could omit them on re-save. The original validation, session, notification, retry and external-change policy remain the baseline.

The [storage boundary](../src/utils/storage.ts) reads and parses without writing. It identifies an unversioned board or a positive safe-integer envelope version. Invalid versions fail; versions above 3 return `future` before their payload is interpreted. Schema 2 and 3 require nonblank revisions; schema 1 retains its existing revision-free compatibility path.

| Source | Path and result |
| --- | --- |
| Missing key | Existing sample-board initialization; first save uses schema 3. |
| Unversioned board | v0 → v1 → v2 → v3. |
| Schema-1 envelope | v1 → v2 → v3. |
| Valid schema-2 envelope, including v1.5 data | v2 → v3; no checklist reconversion. |
| Valid schema-3 envelope | Current; no migration or initialization write. |
| Known schema 2/3 with valid core but damaged order | `order-recovery`; restore safe core in Priority, preserve original and pause writes. |
| Invalid JSON/version/core | `invalid`; preserve original, use existing empty paused workspace. |
| Failed legacy conversion | `migration-failed`; preserve original, use existing empty paused workspace. |
| Future version | `future`; preserve original and pause writes. |
| Read unavailable | `unavailable`; no default-board write. |

[migrations.ts](../src/persistence/migrations.ts) contains the pure staged orchestrator. [schema.ts](../src/persistence/schema.ts) defines the current JSON DTO, trusted encoder and separate core/order validation. The complete migrated candidate is validated against schema 3 before becoming hydrated domain state. No migration step reads React state, clocks, random values, visible tasks or LocalStorage.

Legacy conversion keeps existing IDs, inherited creation time/priority/category, and the completed-to-Done / incomplete-to-To-Do mapping. Missing legacy descriptions/checklists use their documented defaults; missing board timestamp derives from task timestamps or the epoch. Invalid present values are rejected. An already-linked converted child retains its newer content without duplication. Missing parents, self-links, cycles, unsupported depth, ID collisions and unfinished children under completed parents remain invalid.

Schema-2-to-3 migration preserves every recognized valid core field, task-array arrival ties, column order/titles, existing links and checklist arrays. Full and over-capacity columns remain intact: no truncation, relocation or serialized capacity policy. Known-format extras are projected away rather than retained as undocumented data.

## Manual order and preferences

The wire DTO requires each column's `manualOrder` to be a complete ID list or `null`. Valid schema-2 lists are copied exactly, independently per column; absent fields become `null`. Domain objects retain their existing optional property, with `null` decoded as absence. Empty initialized lists remain `[]`.

Migration deliberately **does not assign positions to never-initialized columns**. This is #113's exact decision: the first explicit Manual switch must reflect the full Priority display at that later time. Priority is High → Medium → Low with stable arrival-array ties. Intervening edits/arrivals remain eligible for that first switch. Repeating a pure migration gives the same result; a saved schema-3 board follows the current no-op path on refresh.

Missing required schema-3 order, duplicate/stale/foreign IDs, invalid list values or schema-2 `null` are damaged order. Core validation runs first, so malformed relationships or content are not exposed as safe order-only recovery. A valid core retains all tasks and unaffected valid lists; damaged lists are omitted from the usable domain projection. `PersistenceSession.orderRecovery` retains the raw source, source version and affected columns. All board writes are paused, and the storage boundary independently refuses overwrite even when given the original raw snapshot. Priority edits can remain in memory with an unsaved warning.

There are no Manual UI controls yet. Explicit repair/reset, sanitized recovery diagnostics and corresponding controls remain #115 work. The minimal warning/reload handoff here makes activating schema 3 safe without claiming that repair UX is complete.

The independent future `taskflow-view-preferences` contract remains #116 work. Board migration neither reads nor writes that key, so malformed/future preferences cannot corrupt or alter the board. No new preference migration is necessary because the current application has never persisted that format. Search/filter criteria remain mount-local.

## Writeback and failure guarantees

Hydration itself never writes. The existing reducer effect asks the session to save one completely migrated board. It preflights exact original bytes, validates the complete live domain projection and schema-3 DTO, and performs one `setItem` with a fresh revision. It never writes an intermediate version or marks invalid data as current. A successful migration save shows generic format-upgrade feedback; it does not claim checklist conversion when only the schema-2 marker changed.

Successful writeback updates the known snapshot and board-identity guard. Repeated effects and subsequent current-schema mounts do not rewrite the board. Invalid input, failed conversion and order-recovery data remain unchanged. A preflight external change pauses saving and retains local work; the existing explicit reload policy is unchanged.

`saveBoard` returns distinct `saved`, `conflict`, `invalid-board`, `unavailable` and `save-failed` results. A migration write exception leaves the original available and triggers existing retry feedback; success is announced only after confirmation. The session retains the complete migrated board for retry. LocalStorage has no compare-and-swap: an external writer can race, and a postflight access failure can occur after a complete write. There is no unsafe rollback or promise that every postflight failure leaves the old bytes intact.

No automatic clearing, reset, backup or import/export is introduced. #115 owns the richer recovery flow; #116 owns independent preferences. Parent #43 remains open.

## Fixtures and verification

[Synthetic fixtures](../src/test/migrationFixtures.ts) represent v1.5 parent/child records, current checklist data, canonical timestamps, all categories, stable ties and over-limit columns, plus unversioned/schema-1 checklist data with supported omissions. They contain no personal browser data.

[Migration tests](../src/persistence/migrationV3.test.ts) cover every supported path, frozen-input preservation, complete writeback/current no-op, partial saved lists, explicit first-switch timing, malformed required order, invalid core, future data, write retry, preference independence and external-change rejection. Existing validation, relationship, session, capacity, reducer and application tests remain the regression baseline. Current-load setup now uses a shared schema-3 envelope helper; historical schema-2 fixtures remain explicit migration coverage.

[Browser checks](../e2e/migration.spec.ts) exercise fresh launch, v1.5 upgrade and refresh, retained Priority display/manual metadata, over-capacity data, parent navigation and completion blocking, damaged-order local edits without saving, invalid JSON and future-version preservation. Manual mode itself is verified through domain selectors and initialization tests because no mode control is implemented yet.

Verification on October 11, 2026:

- The new migration file passed 24 focused cases; the initial focused persistence/application regression run passed 129 cases in 9 files.
- Final default `npm test` passed **400 tests in 37 files**, retaining all 376 previous cases. No timeout, isolation setting or assertion was weakened. Two earlier full runs each hit a five-second timeout in a different existing application journey; the lifecycle file passed three consecutive focused runs. Ordinary application fixtures were updated to represent current schema 3, preventing incidental upgrade notices; explicit legacy migration coverage remains separate. A single environmental cause for the earlier timeouts is not established.
- Chromium against the production build passed the **10 existing desktop/mobile checks** and **6 new migration checks**. The initial new recovery check incorrectly assumed capitalization in an existing message; its corrected assertion and every migration browser case passed in the focused rerun. No application exceptions occurred in the migration checks.
- Lint, strict TypeScript checking, production build, local documentation links and `git diff --check` passed.

All browser storage was synthetic and scoped to disposable contexts on the local preview origin. This verifies controlled migration behavior, not access to personal browser data, cross-device synchronization or a Manual UI that does not exist yet.
