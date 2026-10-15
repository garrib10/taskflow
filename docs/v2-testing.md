# TaskFlow v2 testing strategy and #48 coverage audit

Audit date: **2026-10-15**. Clean `develop` baseline: `9a75830`, with #44–#47 merged. The unchanged baseline passed **480 Vitest tests / 44 files** (224.49s), **68 Chromium cases / 34 test definitions** (3.2m), and the production build. Audit and baseline runs preceded repository edits.

## Architecture and audit

- Vitest 5 merges Vite configuration, uses explicit APIs, JSDOM, per-file isolation, two bounded workers and Testing Library cleanup after every test. `--maxWorkers=1` is useful on a constrained local host; default timeouts remain unchanged.
- React Testing Library, user-event and jest-dom exercise visible behavior, accessible roles, names, focus and form associations. Pure domain/persistence contracts use Vitest without component rendering.
- Playwright runs Chromium desktop 1280×720 and touch/mobile 390×844. Optional Firefox desktop and WebKit desktop/mobile projects are available. Browser retries are **zero**; CI uses one worker.
- Development-only `@axe-core/playwright` scans representative settled states with WCAG A/AA and best-practice tags, no rule exclusions. Incomplete results are attached rather than treated as passes. See the [#47 audit](v2-accessibility.md) for manual-inspection boundaries and zoom evidence.
- `src/test/fixtures.ts` supplies fixed dates and typed factories. `currentBoardRaw` creates literal schema-3 envelopes independently of the production encoder. `migrationFixtures.ts` supplies synthetic historical checklist/v1.5 data, retained links, stable ties and over-capacity columns. No personal storage is read.
- Component storage is JSDOM-local or injected memory; tests clear storage/restore spies. Playwright contexts are isolated per test. The two-tab test deliberately shares one test context; it cannot affect other tests or the owner's browser.
- No coverage reporter/provider, coverage command or numerical gate is configured. This audit maps behavioral contracts; test counts do not imply full coverage. No new dependency or arbitrary percentage threshold is needed.

### Risk-based requirement map

Paths below are relative to `src/` unless prefixed `e2e/`.

| Area / requirement | Existing protection retained | Remaining risk and smallest addition | Level |
| --- | --- | --- | --- |
| Workflow rules | `domain/task/taskRules.test.ts`: all 16 stage pairs plus unknown/missing status values. `domain/board/boardReducer.test.ts`: missing/ambiguous tasks, source mismatch and unchanged rejected state. | None requiring a duplicate transition matrix. | Unit |
| Capacity | `domain/board/boardCapacity.test.ts`: unlimited To Do/Done, 5/3 limits, final-slot/full/over moves, hidden tasks, parents/children, same-column reorder, exits, precedence and atomic rejection. `persistence/capacity.test.ts`: over-limit data remains loadable. | Persistence boundary when Stage rejection occurs alongside an unsaved multi-field editor draft. | Full-App integration |
| Priority / Manual ordering | `taskPriority.test.ts`, `boardOrdering.test.ts`, preference hook/App tests, `e2e/preferences.spec.ts`: scores, stable ties, latent positions, mode switches, filtered restrictions and refresh. | No duplicate score/order suite. | Unit / existing integration/browser |
| Reducer / content | `boardReducer.test.ts`: immutable deterministic actions, content rejection, ID collisions, stale edits, checklist actions and full-board operations. | Inclusive accepted content bounds; malformed runtime field types and inherited-object enum names. | Unit |
| Parent-child integrity | `taskRelationships.test.ts`, `App.relationships.test.tsx`, Board tests and `e2e/details.spec.ts`: attach/reassign/detach, cycles/depth/self rejection, completion, deletion policy, progress and migration links. | Reuse these rather than replay every rejection through another UI. New draft integration also checks retained child link/manual lists. | Existing unit/integration/browser |
| Persistence and migration | `persistence/{persistence,migrationV3,ordering,capacity,session,recovery,viewPreferences}.test.ts`: supported v0/v1/v2→v3, current loads, defaults, deterministic order, repeat safety, invalid JSON/core/links, future schemas, migration/write failures, source preservation, paused autosave, conflict pre/postflight, preferences and excluded UI/capacity fields. App/hook and migration/recovery E2E cover integration. | Native browser storage-event delivery between two actual pages; earlier tests inject/dispatch boundary events. | One browser journey |
| Create / edit drafts | `App.journeys.test.tsx`, TaskDetails/Board tests: required fields, edits, dirty close, nested navigation, success and error association. #45 separates immediate Stage/relationship saves from the content draft. | Verify Stage commit survives invalid content and Discard across remount; capacity rejection writes nothing before deliberate content Save. | Two full-App integration cases |
| Controls | `boardFilters.test.ts`, `App.controls.test.tsx`, toolbar tests, `e2e/controls.spec.ts`: title/description search, filters/AND, chips, removal, clear-all, zero recovery, counts, mobile sheet, labels and preference/data preservation. | Axe scan of active chips + combined conditions + ordering description, not just default/zero states. | Extend existing browser journey |
| Notifications | Notification model/hook/component and `App.notifications.test.tsx`: four variants, urgency, expiry/manual dismissal, stale timers, repeated outcomes, migration, write retry and external warnings. Preference tests cover independent failure. | Native conflict journey additionally verifies persistent paused state and explicit recovery. No duplicate timer suite. | Existing unit/component + browser boundary |
| Drag / movement | Board keyboard/touch/presentation tests, coordinate/bounds units, `e2e/board.spec.ts`: real mouse/touch sensors, overlay, manual gap/reorder, invalid/full targets, atomic state, speech/focus; #47 adds consecutive moves and filtered fallback. | No mock recreation of dnd-kit. Retain real-browser sensor checks. | Existing unit/component/browser |
| Accessibility / responsive | `e2e/accessibility.spec.ts` + component tests: board/pickup, dialogs, relationships, filters, zero state, validation, recovery/checklists, keyboard moves and focus. | Share the settled-state axe helper for active filters; retain existing recovery-state scans. | Automated browser assertions |
| CI gate | One Node 24 job uses lockfile installation, lint, strict TS, full Vitest, build and stable Chromium tests. Playwright forbids focused tests; Vitest already rejects `.only` under CI by default. CodeQL and Dependency Review are separate checks. | Preserve machine-readable unit failure evidence, not only browser artifacts. | Existing workflow refinement |

### Duplication / historical coupling / flake review

The suite already has 34 browser definitions spanning several completed issues. Broad overlap between domain contracts, UI wiring and browser behavior is intentional; adding another generic CRUD, migration or workflow suite would duplicate protection. #48 adds only **one** browser journey and extends an existing controls journey.

Tests updated by #44–#47 already use current read-first details/editing, native movement buttons, Category/Priority order and safe discard flows. No failing v1.5 selector remains in the baseline. The README's old 294-test/six-browser-case figures and “movement group opens editor / blue title” guidance were stale documentation, not reasons to rewrite passing tests. Historical v1.5 evidence stays historical and links here for current instructions.

Baseline runs had no failures/retries. JSDOM creation accounted for 105.45s of the local unit run; this is environment overhead, not evidence of flaky behavior. Existing tests intentionally stub geometry at the JSDOM sensor boundary; browser movement waits for pickup state and rendering rather than sleeping. New tests use fixed fixtures, observable outcomes, native storage events, isolated contexts and automatic waits. The affected unit/integration files passed three focused runs (41 cases each). The native two-tab journey passed three runs per Chromium project, and the final focused journey passed twice in each optional Firefox/WebKit project. Timeouts/retry policy are not relaxed.

One initial browser repeat failed during trace cleanup with `ENOENT` because two locally launched Playwright commands shared the output directory. Subsequent browser commands run sequentially; isolated repeats passed. A combined native two-tab journey plus a redundant axe scan also exhausted desktop WebKit's 30-second budget. The native-event journey now retains all behavioral assertions and checks the warning status directly; accessibility scans remain in the dedicated recovery suite and active-filter journey. This separates expensive scanning from the multi-page workflow rather than increasing timeouts or adding retries.

## Commands and suite selection

Use Node 24 and the committed lockfile:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` runs once; `npm run test:watch` stays open. `npm test -- --maxWorkers=1` reduces local contention. Typecheck includes application code, tests, fixtures and both browser configurations.

```bash
# One unit/integration file or case
npm test -- src/domain/board/boardReducer.test.ts
npm test -- src/App.drafts.test.tsx -t "immediately saved stage"

# One browser area; use production preview automatically in CI mode
CI=1 npm run test:e2e:ci -- e2e/recovery.spec.ts
npm run test:e2e -- e2e/controls.spec.ts --project=mobile-chromium

# Repeat only the new native two-tab journey without retries
npm run test:e2e -- e2e/recovery.spec.ts -g "native cross-tab" --repeat-each=3 --workers=1

# Optional engine audit (not part of required Chromium CI)
npx playwright install firefox webkit
npm run test:e2e -- --config=playwright.crossbrowser.config.ts e2e/accessibility.spec.ts e2e/controls.spec.ts

# Local machine-readable unit results, using the same reporters as CI
npm test -- --reporter=default --reporter=junit --outputFile.junit=test-results-unit/vitest.xml
```

The default browser command starts Vite dev locally, or production preview under `CI=1`, at `127.0.0.1:4173`. Run `npm run build` first for production preview. An explicit existing server can be used with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4175 npm run test:e2e`. **Run browser commands sequentially** so they do not clear each other’s shared trace/report directories. **Do not rebuild `dist` during a production-preview run**: Vite briefly removes it, which can produce page/asset 404s unrelated to app behavior.

Failure traces/screenshots and HTML reports are ignored by Git. `npm run test:e2e:report` opens the report. `scripts/qa-browser-zoom.cjs` provides the separate actual-tab-zoom audit from #47; see its documented environment overrides. Protected Vercel previews require owner access; tests store no credentials and do not bypass protection.

## CI quality and failure evidence

`.github/workflows/frontend-ci.yml` remains one quality job for PRs targeting develop/staging/main (and pushes to those branches). It uses Node 24, cached npm downloads, `npm ci`, read-only contents permission, no required secrets, no deployment steps and no `continue-on-error`. The 20-minute timeout and zero browser retries remain.

#48 adds JUnit output alongside Vitest's normal console reporter and includes it in the seven-day failure artifact with browser traces/reports. Unit output uses its own ignored directory because Playwright clears its output directory before running. The artifact step still runs after failures, including a unit failure before browser installation. Failures continue to fail the job. An expected-negative temporary `.only` probe (removed after execution) exited nonzero under `CI=1` and produced a parseable JUnit report containing the failure, verifying the existing focused-test guard and the new reporter command.

## Limits

No percentage coverage or full WCAG certification is claimed. Axe checks rendered representative states, not every possible sequence; incomplete checks need inspection. Keyboard focus assertions do not establish spoken screen-reader behavior. JSDOM cannot establish layout or physical gestures; Chromium/WebKit touch emulation is not a physical device, and Playwright WebKit is not actual Safari/iOS. The optional broader engine audit does not expand the normal CI matrix. Fixtures deliberately avoid personal browser data.

## #48 verification record

| Check | Result |
| --- | --- |
| Baseline Vitest | 480 passed / 44 files; 224.49s |
| Baseline Chromium desktop/mobile | 68 passed / 34 definitions; 3.2m |
| Lint / strict TypeScript / production build | Passed |
| Final Vitest with CI console + JUnit reporters | **487 passed / 45 files**; 203.30s; parsed XML confirms 487 tests, zero failures/errors |
| Focused unit/integration repeats | 41 cases passed in each of three runs |
| Final native two-tab Chromium repeats | **6 passed** (3 desktop + 3 mobile); 45.4s; no retries |
| Final native two-tab optional engine repeats | **6 passed** (2 Firefox desktop + 2 WebKit desktop + 2 WebKit mobile); 2.0m; no retries |
| Active combined-filter axe checks | Desktop and mobile passed; also included in the final full browser suite |
| Final complete Chromium suite | **70 passed / 35 definitions**; 3.7m; desktop/mobile, production preview, zero retries |
| Coverage percentage report | Not configured; no provider/threshold added |
| Expected-negative CI focused-test probe | Nonzero exit and valid JUnit failure report; temporary probe removed |

Net additions: **seven unit/integration cases** (five reducer content cases and two full-App draft cases), **one browser definition** (two projects), and axe assertions in one existing controls journey. No existing tests were deleted. No product behavior change or follow-up product defect was required. GitHub CI/deployment results are recorded on the PR after push.
