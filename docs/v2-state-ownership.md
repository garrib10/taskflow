# v2 state ownership

Issue #104 preserves the typed domain reducer, persistence session and local interaction owners. No context hierarchy, external state library, URL state or additional storage key is introduced.

## Current ownership map

| Values | Category and owner | Lifetime / storage |
| --- | --- | --- |
| Board identity/name, columns, task IDs/content, priority/category, status, timestamps, checklist data and `parentId` | Domain: `useBoardReducer` owns the board; `boardReducer` and validation apply atomic operations against the full board | Schema 2 envelope at LocalStorage `taskflow-board` |
| Query and Priority/Category/Status filters | View preferences: Board mounts `useBoardViewPreferences`, passing only values/setters to controls | Mount-local; reset on reload/unmount. No URL or LocalStorage backing |
| Current priority ordering | Existing deterministic presentation policy, not a user-selected state value | No mode selection exists yet; #105/#116 own implementation and independent preference persistence |
| Visible columns, matching count, active-criteria flag, filter count | Derived view values: pure `filterBoardColumns`, Board and the preference hook | Computed from full domain data and criteria; never persisted or copied into state |
| Parent/candidates/children, completion progress | Derived domain values: relationship helpers; TaskForm/TaskRelationshipForm render them from the full board | Never a second stored relationship/progress source |
| Task-form visibility, task-to-edit, task-pending-deletion | Interaction: Board | Local. Selected task snapshots identify interaction context; TaskForm resolves current task/relationships against the latest board |
| Form title/description/priority/category drafts, staged parent ID, inline checklist text | Interaction drafts: TaskForm, TaskRelationshipForm and SubtaskList respectively | Local until their existing explicit submit action; not autosaved |
| Nested subtask editor, relationship editor, related-task destination, discard confirmation, validation error/field/attempt | Interaction: the corresponding form | Local to its dialog lifecycle. Dirty state remains derived |
| Operation notifications and polite announcement sequence | Interaction: Board and form instances of `useNotification` | Local. Notification timers and dismissal do not resolve persistence restrictions |
| Storage notification display/dismissal, reload confirmation, retry focus | Interaction: App and its notification instance | Local; distinct from the underlying persistence recovery state |
| Hydrated initial board, known raw bytes, last-saved board identity, paused/migration status, recovery notice, subscribers | Persistence coordination: `PersistenceSession`, exposed through `useBoardReducer` | In memory. Only the validated board and envelope revision are written; notices/coordination are not domain fields |
| Active drag, over destination and keyboard sensor coordinates | Interaction: dnd-kit within Board; existing coordinate/bounds helpers | Temporary. Successful movement dispatches one validated domain action; cancellation does not save movement state |
| Focus targets, dialog stack/inert bookkeeping, last-task focus | Interaction: Board refs and existing modal-focus hook | Temporary DOM context, never persistent board data |
| Responsive media match and mobile filter-sheet visibility | Interaction: BoardToolbar; FilterSheet owns each opening's modal focus lifecycle | Local; widening closes disclosure without resetting criteria |
| Future read-first details, navigation trail, mobile active stage, scroll anchors | Not yet implemented. Current task presentation is the existing TaskForm | Future interaction/presentation ownership belongs to #44/#45/#47; no speculative fields added |
| Storage-backed UI preferences | None currently | Future selected Order preference belongs to #116; no automatic persistence of query, filters, dialogs or drafts |

Search and filters are presentation choices even though their current lifetime is transient. Keeping them reset-on-reload preserves existing behavior and avoids retaining a hidden restrictive view without an approved persistence requirement. No saved views or URL/shareable filter requirement exists.

## Contracts and changes

`useBoardViewPreferences` is the single owner of the four criteria. It takes no board, domain dispatch or persistence controller. Typed field setters retain other criteria, and `resetCriteria` restores the shared default factory. `filterCount` excludes Search; `isFiltering` ignores whitespace-only queries. Board derives matching columns/count on every render rather than storing copies. Focus after reset remains an interaction decision in Board (or local to the open filter sheet).

Previously Board had four separate criterion states and repeated default/reset wiring. This was already separate from domain data; the focused hook clarifies that boundary without replacing a working architecture. No dialog, form, notification or reducer owner was moved merely to create another abstraction.

Persistence already accepts `Board`, hydrates once per mount, validates unknown data and protects rejected originals/stale tabs. TypeScript's structural typing nevertheless permits variables with extra properties. Previously `saveBoard` validated serialized input but wrote that original input, including extras. It now writes the validator's explicit trusted domain projection. This excludes UI extras at board/column/task/checklist levels while preserving legitimate fields, IDs, dates, relationships, revision/schema format and conflict/retry behavior. The validator remains the single field whitelist; no parallel serializer schema was added. An approved new durable field must be included in that validator as well as its domain type before it can be saved.

External storage changes pause saving and expose recovery rather than automatically replacing the current reducer board. Consequently active criteria and drafts stay in memory until deliberate reload. Hydration on a new mount restores domain data while newly mounted preference/dialog owners use their defaults. Dismissing the displayed notice does not clear the persistence restriction.

## Contributor decisions and deferred work

Put durable facts/rules in domain entities/actions only when required by approved behavior. Keep display choices separate and give them an explicit lifetime; persistence requires an approved benefit and independent validation. Keep incomplete edits, dialog/drag/focus context and feedback local to the interaction owner. Compute projections, counts and dirty flags from their sources. New controls should receive only their required values/actions, not a general-purpose global state object.

#105 owns durable manual positions and typed ordering operations; #106 owns capacity rules/counts; #107 owns further atomic operation work; #108 owns justified selector consolidation. #113 decides any future schema change and related migration work. #116 owns independent ordering-preference persistence. Existing persistence validation's priority/category presentation-map dependency is unchanged here and remains scoped domain/persistence alignment work under #21/#43; it is not a UI-state serialization problem.

No behavior, visuals, schema version, initialization policy, form lifecycle or recovery policy is redesigned by #104.

## Verification

Focused tests exercise independent criterion updates, derived counts/matches, criteria-only reset, preference survival across domain operations, unchanged saved bytes for view actions, and default preferences with preserved domain data after remount. A storage regression test supplies structurally compatible objects with UI extras at every nesting level and verifies an exact domain-only envelope and valid restoration. An application test verifies that an external storage notice preserves a real open draft and filters, and that remount restores external domain data without persisting interaction context.

Existing reducer/relationship, migration/recovery, form/dialog, notification, responsive toolbar and browser journeys remain the behavioral baseline. Lint, strict TypeScript checking and the production build passed. The focused preference/persistence tests passed 87 cases, and the real draft/conflict application test passed. All eight desktop/mobile Chromium journeys passed; a separate filtered pointer movement check preserved criteria, reset focus, domain-only storage and the moved task after reload.

The default two-worker `npm test` run passed 311/314 cases: two existing long application journeys timed out at 5000ms and a following filter test showed mixed typing after a timeout. An untouched `develop` checkout at `f89cddf` also timed out in both affected journeys, with follow-on failures. This reproduces pre-existing timing/isolation symptoms; it does not establish an application defect or a single environmental cause. Running the complete branch suite with `npm test -- --maxWorkers=1` passed all 314 cases in 32 files. No timeout, assertion, isolation setting or test configuration was changed. The default concurrency remains a local verification limitation, documented in the #104 PR.
