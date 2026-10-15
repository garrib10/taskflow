# TaskFlow v2 persistence contract

## Status and ownership

Issue [#113](https://github.com/garrib10/taskflow/issues/113) defines this contract under [#43](https://github.com/garrib10/taskflow/issues/43). [#114's implementation](v2-data-migration.md) now reads and writes schema 3 with supported legacy migration and paused order-recovery handoff. [#115 recovery](v2-persistence-recovery.md) now provides confirmed repair/replacement and explicit retries. [#116 implements independent ordering preferences](v2-view-preferences.md). Application release numbers and persistence schema numbers are independent.

This contract builds on the completed [state ownership](v2-state-ownership.md), [manual ordering](v2-manual-ordering.md) and [capacity](v2-column-capacity.md) work (#104–#108), and the approved [ordering decisions in #98](https://github.com/garrib10/taskflow/issues/98). The completed application includes Manual controls and independent preferences through #116; this contract does not introduce a backend or multiple boards. Parent #43 is closed. The implementation-stage audit and original test counts below are historical, not the current release status.

## Historical implementation audit at #113 (schema 2)

The single-board key is `taskflow-board`, scoped to browser origin and profile. [storage.ts](../src/utils/storage.ts) owns storage access and serializes the validator's trusted projection. At #113 the envelope was `{ schemaVersion: 2, revision, board }`. Dates become canonical UTC ISO strings on serialization and return to domain `Date` values on hydration.

[validation.ts](../src/persistence/validation.ts) validates the board, enum values, IDs, dates, column membership and relationships. Current schema 2 permits an absent column `manualOrder`; a present list must contain exactly the column's task IDs once each. Malformed lists currently reject the whole board. Valid optional lists round-trip; older v1.5 readers omit this metadata on re-save.

[migrations.ts](../src/persistence/migrations.ts) handles unversioned boards and schema 1. The former fills supported legacy omissions; the latter converts legacy checklist entries to linked tasks. Current schema-2 checklist arrays still round-trip unchanged. [session.ts](../src/persistence/session.ts) and [useBoardReducer.ts](../src/hooks/useBoardReducer.ts) own hydration, autosave, retry and conflicts. Missing storage initializes the existing sample board. Invalid, future, failed-migration or unavailable storage produces a paused workspace without replacing the original.

Search and filters are mount-local in [useBoardViewPreferences.ts](../src/hooks/useBoardViewPreferences.ts). At that stage there was no durable ordering-mode preference or Manual mode control. Capacity limits are domain policy, not saved configuration; over-limit boards remain loadable.

## Version decision

Use **board schema 3**, retaining `taskflow-board`. Schema 3 requires explicit manual-order initialization metadata. This also establishes a safe compatibility boundary: an older reader must classify schema 3 as future data and preserve it, rather than recognize schema 2 and silently discard manual positions on saving.

Do not change the runtime version constant independently of the migration and safe recovery implementation. Do not create a second fallback board key that lets old and new readers edit competing copies.

## Board payload

The following describes the JSON DTO, not replacement domain types:

```ts
type PersistedBoardV3 = {
  schemaVersion: 3;
  revision: string;
  board: {
    id: string;
    name: string;
    lastUpdated: string; // canonical UTC ISO date
    columns: Array<{
      id: "todo" | "in-progress" | "in-review" | "done";
      title: string;
      tasks: Array<{
        id: string;
        title: string;
        description: string;
        priority: "high" | "medium" | "low";
        category: "feature" | "ui" | "bug" | "testing" | "refactor" | "devops";
        status: "todo" | "in-progress" | "in-review" | "done";
        createdAt: string; // canonical UTC ISO date
        subtasks: Array<{ id: string; title: string; completed: boolean }>;
        parentId?: string;
      }>;
      manualOrder: string[] | null;
    }>;
  };
};
```

Every column must contain `manualOrder`. **`null` means never initialized**, and decodes to the existing absent domain property. An array means initialized: it must list every task in that full column exactly once. `[]` is valid for an initialized empty column. Omission in schema 3 is damaged metadata, not another spelling of `null`.

The task array retains independent arrival order, including stable Priority ties. Priority display orders High before Medium before Low, preserving task-array order within each tie and workflow column. Manual lists do not reorder this array or change priorities. Preserve saved column order and titles; validate exactly one column per known workflow status. Store relationships through `parentId`, not a second derived child-ID list. No parent means the property is omitted; `null` is invalid. Keep valid legacy checklist arrays in schema-2-to-3 migration; do not run the schema-1 conversion on already-current data.

Example empty column:

```json
{ "id": "todo", "title": "To Do", "tasks": [], "manualOrder": null }
```

For a column with task IDs `a` and `b`, `["b", "a"]` is valid initialized order. `["a"]`, `["a", "a"]`, `["a", "foreign"]`, a string, or a missing property is invalid schema-3 order. A preference cannot supply missing positions.

## Validation boundary

Treat parsed values as `unknown`. Validate the envelope, core board, relationships and ordering separately before building domain objects. Project recognized fields; never spread an unchecked object into state or a saved DTO.

- Require a positive safe-integer schema version. Explicit `0`, strings, fractions and negative values are invalid. Only an envelope without a version qualifies as unversioned legacy data.
- Classify a version above the reader's maximum as future **before interpreting its board or revision**. Preserve its exact raw value; do not project or downgrade it.
- Schema 2 and 3 require a nonblank revision. Schema 1 retains its existing migration behavior without requiring one. Generate a fresh revision only at successful save preparation, not pure decoding/migration.
- Require nonblank board/task/checklist IDs and names/titles. IDs need not be UUIDs; do not trim identities or generate replacement IDs. Require valid priority, category and status values, and task status matching its column.
- Require globally unique task IDs and globally unique checklist IDs, with disjoint namespaces for current data. Preserve the existing narrowly validated legacy conversion exception for an already-linked child sharing its checklist entry ID.
- Require string descriptions (empty is valid persisted data), checklist arrays with boolean completion, and canonical date strings whose parsed date serializes back to the exact same string. Do not introduce timestamp ordering constraints or new task timestamps.
- Validate parent existence, self-reference, cycles, supported one-level depth and completion consistency. A completed parent with an incomplete child is invalid regardless of filters.
- Do not apply new-task form length/required-description restrictions retroactively during hydration. Historical valid content must remain readable. Creation/edit intents retain their separate content validation.
- Accept full and over-capacity columns. Limits and counts are derived domain policy; loading must not truncate or move tasks.

Unknown fields in supported formats are omitted from the trusted projection and subsequent serialization. Compatibility preserves recognized valid data, not arbitrary extensions. Future-version bytes are preserved without this projection.

## Compatibility and migration contract (#114)

| Input | Required result |
| --- | --- |
| No saved key | Existing initial-board policy; first schema-3 save explicitly encodes uninitialized columns as `null`. |
| Unversioned legacy board | Existing v0 → v1 → v2 behavior, then v2 → v3. |
| Schema 1 | Existing checklist-to-linked-task conversion, then v2 → v3. |
| Valid schema 2, order absent | Preserve core data; encode the affected column's order as `null`. |
| Valid schema 2, valid optional lists | Copy lists exactly; absent lists in other columns become `null`. |
| Known schema 2/3, valid core but invalid order | Order-recovery classification; preserve raw original and pause persistence. |
| Valid schema 3 | Hydrate without migration or a mount-time rewrite. |
| Malformed JSON, invalid core or failed legacy conversion | Paused recovery state; preserve raw original. |
| Version above reader maximum | Future-version state; preserve raw original and block writes. |
| Storage inaccessible | Unavailable state; do not report missing data or a successful save. |

Migration is pure, deterministic and repeat-safe. Preserve IDs, recognized content, timestamps, membership, links, array order, valid positions and valid schema-2 checklist arrays. Keep existing legacy defaults: absent description becomes `""`, absent checklist becomes `[]`, missing legacy columns are filled, and absent board timestamp derives from the newest task or the epoch. Present malformed values must not become defaults. Existing schema-1 child conversion retains inherited metadata and completion mapping, checks collisions and relationships, and clears legacy entries only in a successfully validated candidate.

**Do not eagerly initialize absent order during migration.** The first explicit Priority-to-Manual switch must use the full Priority display at that time, including intervening edits and arrivals. Persist an upgraded candidate only after complete validation, using the existing conflict-aware boundary. Upgrade feedback must describe a format upgrade accurately even when no checklist conversion occurred.

## Recovery contract (#115)

Core validity and order validity need distinct outcomes. For supported schema 2/3 with a valid core but damaged order, expose the validated tasks and relationships in Priority mode, retain valid lists in unaffected columns, and omit damaged lists from the usable domain projection. Carry source version, raw original and affected status IDs in session recovery state, never in the board DTO.

Pause **all board persistence** while order recovery is outstanding. Otherwise an ordinary edit could overwrite damaged saved order as uninitialized `null`. Disable Manual initialization, reordering and Manual movement. Priority edits/moves may remain available in memory with explicit unsaved feedback.

An explicitly confirmed repair rebuilds only affected columns from the complete current Priority projection with stable arrival ties. Preserve other valid lists, `null` initialization markers and core data. Validate the whole candidate and write it through the normal conflict-aware boundary. Repair is deterministic and repeat-safe. Do not select Manual automatically after repair; a deliberate valid mode selection is still required. Conflicts and failed writes retain local work and must not claim success.

Invalid core data and unknown future schemas are not order-only repair cases. Preserve the original and keep saving paused. No reset feature is introduced by #113. #115 requires explicit confirmation explaining saved/local work loss and uses the existing missing-board starter policy. It replaces only the board key with one validated complete write instead of deleting first: a failed replacement write must retain the original value. This refines the earlier remove-then-initialize instruction to avoid a destructive gap; it changes no schema or initialization policy. Never call origin-wide `localStorage.clear()` or reset independent preferences automatically. Recommend a compatible reader for future-version data; do not treat an upgrade mismatch as corruption.

Diagnostics may contain versions, generic reason codes and field/index paths. Do not log raw payloads, task IDs, titles, descriptions, drafts or unknown values. Recovery UI must accurately distinguish unavailable access, invalid data, future data, conflicts and unsaved changes.

## Ordering preference contract (#116)

[Implementation and verification](v2-view-preferences.md) follow this contract.

Use a separate `taskflow-view-preferences` key with its own version:

```ts
type PersistedViewPreferencesV1 = {
  schemaVersion: 1;
  orderingMode: "priority" | "manual";
};
```

Only ordering mode is approved for persistence here. Both fields are required. Missing, invalid or inaccessible preferences fall back to Priority without changing board data. Unknown fields in a supported preference format are projected away; an unsupported future preference is preserved and falls back to Priority.

Recognize preference versions as positive safe integers, independently of board versions. For preference schema 1, validate `orderingMode` against the two exact values above. Do not coerce strings, invent preferences from board extras or copy invalid/future preference bytes into the board.

Restore Manual only when the full board has valid initialized order for every column and no pending order recovery. Any `null` column requires Priority until the user explicitly initializes Manual. Do not initialize positions merely because a saved preference requests it. Save the preference after any required board initialization has been successfully persisted. Two LocalStorage keys are not transactional: a stale Manual preference must never bypass these guards after a partial failure or crash. Preference failures are independent of board failures.

Do not silently adopt another tab's mode or change existing board conflict handling. No revision, timestamp, board ID or speculative toolbar settings are needed in this preference payload.

## Excluded state and save guarantees

Neither payload includes search/filter criteria, filtered/sorted task collections, child counts/progress, capacity limits/counts, open dialogs/panels, drag state/previews/sensors, drafts/errors, notifications/timers, focus/DOM references, viewport/scroll/mobile state or loading/recovery flags. Storage listeners, known raw snapshots and last-saved references remain session infrastructure. Styling maps are not persisted. No authentication, backend, backup, import/export or cross-device synchronization is implied.

Keep the existing single-snapshot writer: validate/project/serialize the complete candidate, preflight the expected raw snapshot, then perform one `setItem` with a new revision. Do not save a partial migration/repair or use per-task writes. Known current snapshots do not rewrite merely on hydration; duplicate effects are guarded. Other-tab replacement/removal pauses saving and requires the existing explicit resolution flow; do not auto-merge or auto-adopt.

LocalStorage provides no compare-and-swap transaction. Preserve the existing post-write replacement check and document its limitation: a postflight failure can occur **after** a complete candidate was written. Do not promise that every failed save leaves old bytes untouched or attempt an unsafe automatic rollback. Retry keeps local work; explicit reload may discard it with confirmation.

## Implementation history and verification

- **#114 completed:** schema-3 DTO boundary and pure migration chain; coverage includes v1.5 schema-2 fixtures, absent/partial/valid order, repeated conversion, checklist preservation and future-version refusal.
- **#115 completed:** separate invalid core/damaged-order recovery; coverage includes raw preservation, unsaved local edits, selective confirmed repair, conflict/write failures and sanitized diagnostics.
- **#116 completed:** independent preferences, Priority fallbacks, guarded Manual restoration and board/preference failure coverage.
- **#43:** closed after its implementation and acceptance review; release promotion remains #50.

At #113, existing [ordering persistence tests](../src/persistence/ordering.test.ts), [capacity tests](../src/persistence/capacity.test.ts), [relationship storage tests](../src/utils/storage.relationships.test.ts), session tests and reducer tests provided the schema-2 regression baseline. #113 changed documentation only. #114 adds schema-3 implementation and verification in the linked migration guide; the original specification did not claim completion of those later implementations. Their current behavior is documented in the linked migration, recovery and preference guides.

Representative fixture review covered schema-2 linked parent/child records with canonical dates, schema-2 boards without positions, valid optional lists with independent arrival ties, retained current checklist data, unversioned/schema-1 checklist conversion and already-converted children. The compatibility matrix preserves each recognized valid field and retains existing malformed-data rejection; it does not promise support for unidentified external formats. Serialization tests already verify projection of UI extras, while capacity tests verify that restored over-limit boards remain loadable.

Verification on October 11, 2026: the focused persistence/relationship-storage/reducer run passed **117 tests in 6 files**; default `npm test` passed **376 tests in 36 files**. `npm run lint`, `npm run typecheck` and `npm run build` passed. Local documentation links and `git diff --check` passed. These checks record the original #113 documentation baseline, not the final v2 suite. The completed implementation and current release checks are linked from the [release checklist](v2-release-checklist.md).
