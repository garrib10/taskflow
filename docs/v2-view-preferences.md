# Approved view-preference persistence (#116)

## Audit and ownership

Merged #98 approves Priority (default) and optional Manual display, independent of task priority and stable per-column arrival order. #104 separates board data, view choices and temporary interactions. #105 already represents durable manual positions with column `manualOrder` ID lists and provides initialization/reorder/movement actions and pure selectors. #113 defines schema-3 nullable positions and a separate preference contract; #114 migrates boards; #115 owns board recovery and paused writes.

Before #116, the UI rendered Priority only. `useBoardViewPreferences` owned mount-local search/filter criteria; no mode selector or preference-storage reader/writer existed. Only `taskflow-board` was written. Startup restored valid manual positions but never activated Manual. Existing ordering and migration tests verified domain positions and selectors, while browser tests exercised Priority, refresh, filters, dialogs and recovery.

| State | Classification / final owner |
| --- | --- |
| Tasks, workflow membership, links, priorities, arrival arrays, manual ID lists, board timestamp | Durable domain facts; existing board reducer and schema-3 board storage |
| Selected Priority/Manual mode | Only approved persisted view preference; `useOrderingPreference`, independent preference boundary |
| Search, priority/category/status criteria | Session-only view state; `useBoardViewPreferences`; reset on remount |
| Mobile filter disclosure | Temporary toolbar state; resets on remount |
| Selected task/editor/parent management, create/edit/subtask drafts, errors, delete/repair/reset confirmations | Temporary interaction/form state; existing Board/TaskForm/App owners |
| Drag state, keyboard movement, announcements, focus targets, notices and recovery panel | Temporary interaction/session infrastructure; never serialized |
| Filtered/sorted projections, progress, counts, capacity limits | Derived/configuration data; never serialized |

No additional approved preference was found. Saved filter views, dark mode, capacity settings and a generic settings page remain excluded.

## Contract and validation

Key: **`taskflow-view-preferences`**. Its independent schema version follows #113 exactly:

```json
{"schemaVersion":1,"orderingMode":"priority"}
```

Both fields are required. Version must be a positive safe integer; recognized version 1 accepts only exact `priority` or `manual` values, reusing the domain `OrderingMode` type. Default is Priority. Unknown fields in a supported envelope are projected away. Missing storage, malformed JSON, invalid structure/values, and inaccessible reads use Priority. Future versions are recognized without interpreting their fields, preserved, and use Priority. No older preference format exists or is invented.

`src/persistence/viewPreferences.ts` has its own narrow storage interface, decoder, load results (`missing`, `valid`, `invalid`, `future`, `unavailable`) and write results (`saved`, `unconfirmed`). It does not import board validators or write the board key. Preference payloads contain neither task IDs nor manual positions, revision, timestamp, board identity or filters. The preference version is independent of board version 3.

Invalid/future/raw preference values are **not rewritten on startup**. Only an explicit user selection may replace them. Non-sensitive warnings explain fallback when useful. No board reset/repair panel appears solely for preference failure.

## Hydration, switching and write order

App first mounts the existing board hook, then the independent ordering hook. Preference loading occurs once per mount in the state initializer; there is no default-saving effect. Current hydration—including repeated StrictMode effects—does not rewrite either valid snapshot.

Saved Manual is usable only if every full-board column has valid initialized order and no order recovery is pending. Missing/uninitialized/damaged positions use Priority; reading a Manual choice does not fabricate positions or erase the saved choice. Repair/replacement does not automatically activate a previously rejected Manual choice.

The small Ordering select uses the existing toolbar slot/Field primitive. First explicit Manual selection with uninitialized positions asks the session to initialize the **complete** board from Priority with stable ties. The candidate must pass normal board validation and verified persistence before the hook applies it and writes the Manual preference. On board failure, keep Priority, the previous live board and the old preference. Board recovery remains authoritative and cannot be bypassed by a preference selection. Existing valid positions require no board write when switching modes.

Manual → Priority changes only the preference. Returning to Manual uses existing positions rather than rebuilding them. Filtering computes visible IDs from the full domain column and projects the selected ordering afterward, preserving hidden positions and stable priority ties. Mode changes never clear criteria, alter task priorities or sort the stored arrival arrays.

Small named Move earlier/later buttons exercise the existing domain ordering actions, retain task identity/focus, and persist positions through board storage. They are disabled at boundaries and whenever search/filter criteria are active. Cross-column movement supplies the actual input/mode/filter policy to the existing domain rules (top placement when no gap is indicated). This is minimal persistence integration, not completion of #44/#46/#47's broader card/drag-preview/interface redesign or accessibility program.

## Independent failures and conflicts

Preference writes occur only on an explicit mode selection, serialize only the contract, and skip an exact already-saved value. A matching readback is required to report success. Quota/read/write restrictions or a mismatching postflight return `unconfirmed`; the selected mode remains usable in this tab and a typed warning says it may not survive refresh. A later explicit selection can retry. No automatic retry loop, origin-wide clearing or board rollback is introduced.

Board and preference failures are independent: a failed preference save does not pause board autosave; a failed board save does not invalidate a valid preference or claim the preference failed. First-switch initialization is deliberately gated on board durability because the preference must not restore positions that were never saved. Two keys are not a transaction; a stale Manual preference always passes the full-board readiness guard on the next startup.

The existing board multiple-tab policy remains unchanged: exact-snapshot preflight/postflight, local work retained, stale writes paused, explicit confirmed reload, no merging or auto-adoption. Preference events are ignored by the board listener; other tabs' mode choices are not silently adopted. An explicit selection writes this origin's preference (latest explicit selection wins). LocalStorage provides no transactional compare-and-swap and postflight failure can follow a complete write; feedback stays unconfirmed rather than attempting unsafe rollback.

## Verification and parent review

Unit tests cover every shape/version/mode, projection, absent/inaccessible storage, deduplicated writes, quota/readback failures and board-key isolation. Application tests cover guarded Manual restoration/initialization, unchanged board bytes on mode changes, invalid/future preferences, independent failures, saved positions, filtering, drafts and remount. Browser journeys use synthetic isolated data on desktop/mobile, exercise keyboard reorder, both modes through reload, malformed/unsupported/future choices, preference-only quota failure and interaction reset.

After this PR is merged, #113–#116 will be complete. Parent #43 still requires an acceptance/checklist review before closure: typed boundaries, UI/storage separation, versioning, supported migrations, retained relationships, missing/invalid/future data, safe recovery and regression coverage. LocalStorage remains adequate for the approved single-user workload; IndexedDB solves no demonstrated requirement. Do not close #43 before this PR merges or if its live acceptance criteria have changed.

### Verification results — October 12, 2026

- New preference boundary/application tests: **26** meaningful cases. Focused preferences/recovery/Board/filter-owner run: **53 passed in 5 files**; final Board/preferences run after announcement/focus refinements: **30 passed in 2 files**.
- Default full `npm test`: **448 passed in 41 files**, with no timeout/isolation/configuration changes.
- `npm run lint`, strict `npm run typecheck`, `npm run build`: passed.
- Final production-build `CI=1 npm run test:e2e:ci`: **26 passed**, retaining 22 existing checks and adding four desktop/mobile preference executions. Controlled browser checks verified mode/positions through repeated refresh, stable Priority ties, return to prior Manual positions, hidden ordering guards, malformed/unsupported/future preference preservation, preference-only quota failure, and non-persisted draft/disclosure/search state.
- Separate isolated 375 × 667 browser inspection verified the toolbar and Manual actions visually and confirmed no horizontal overflow. No irreplaceable/personal browser data was used.
- Live #43 review found no additional technical blocker: source search confirms no direct storage use in UI components; typed versioned boundaries, supported board migrations, relationship preservation, missing/corrupt/future handling and safe recovery remain tested. Keep #43 open until #116 merges and the final parent checklist/completion review is recorded.
- Diff/whitespace review passed. No dependencies, schema-3 migration transformations, capacity rules, multi-tab policy or testing foundation changed.
