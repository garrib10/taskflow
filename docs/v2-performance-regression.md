# v2.0 performance and regression QA — #49

Audit: **2026-10-15**, clean `develop` base `ce21773` (PR #165). This is a
technical QA record for the existing product, not a redesign or a claim of full
accessibility certification. No application optimization or dependency change
was justified by this audit. One browser-test platform correction is described below. The diagnostic instrumentation never enters `dist`.

## Environment and repeatability

Local production preview: `npm run build`, then
`npm run preview -- --host 127.0.0.1 --port 4189 --strictPort`.
Node **24.21.0**, npm **11.19.0**; installed Google Chrome **155.0.8059.40**,
headless, isolated profiles, extensions disabled, no CPU/network throttling for
interaction measurements. Playwright 1.63.0 uses bundled Chromium 153.0.8010.12,
Firefox 155.0 and WebKit 26.6 for the configured suites (separate from installed
Chrome used for timing/Lighthouse). The installed stable-channel version was recorded;
latest-channel currency was not independently certified.

Host: Intel **MacBookAir9,1**, i5-1030NG7 1.10GHz, **8GB**, macOS **15.8.1
(24H32)**, AC power (100% at setup). **Off-reference:** [#97](https://github.com/garrib10/taskflow/issues/97)
specifies M1-class or newer. These are observational comparisons to its budgets,
not certification on the approved reference hardware. Measurement, profiling,
tracing and Lighthouse jobs ran sequentially, without concurrent test/build jobs.

The existing deterministic [fixtures](../e2e/boardFixtures.ts) provide:

| Tasks | Children / parents / standalone | Stage distribution | Largest family | Stored bytes |
| ---: | --- | --- | ---: | ---: |
| 20 | 5 / 3 / 12 | 8 / 5 / 3 / 4 | 2 | 6,021 |
| 100 | 30 / 10 / 60 | 45 / 25 / 15 / 15 | 3 | 43,361 |
| 300 | 90 / 15 / 195 | 135 / 75 / 45 / 45 | 30 | 137,827 |

Fixed dates/IDs, stable arrival ties, all priorities/categories, long content and
reserved title/description search tokens make comparisons reproducible. Stage
labels are humanized in timing fixtures; data and policy are unchanged. The two
larger tiers are deliberately over capacity: accepted movement uses Review→Done,
not an invalid arrival into a full column. Search expectations independently
check IDs, order and whole-board counts, including hidden mobile stages.

Each tier uses **1280×720** and touch-emulated **390×844**, DPR1. Cold startup has
10 fresh contexts with cache disabled, storage seeded before the first navigation.
Warm restoration and each interaction have **two excluded warmups + ten retained
samples**, resetting the fixture between mutations. The supplementary warm-start
set ran separately after the main timing set. All 810 production observations
(60 cold, 60 warm, 690 interactions), ranges and fixture hashes are retained in
[compact evidence](qa/v2-performance-evidence.json).

Startup runs from navigation time origin to verified restored cards and an
enabled Create action, plus two animation frames. Interactions run from browser
capture-phase input to correct DOM, required focus/announcement and saved state,
plus two animation frames. This is a **conservative paint-opportunity upper-bound
proxy**, not Playwright wall time or proof of physical compositor presentation.
The separate CDP trace includes input/DOM/frame markers, Paint events and
screenshots for search, reset, details, keyboard and pointer moves. It is diagnostic
and excluded from the production timing set. All 15 traced windows (two warmups
plus one retained trace per action) contain one or two Paint events before the
verified-frame marker; tracing overhead is not used to assess budgets. Pointer timing measures accepted
release response; it does not time the human drag gesture. Mobile has keyboard
movement timing, while existing sensor tests cover touch correctness.

## Production response observations

Medians in **milliseconds**, rounded to one decimal. All individual values and
ranges remain in the evidence file; these are not CI timing assertions.

| Tasks / width | Cold restore | Warm restore | Reset | Open details | Edit save | Keyboard move | Pointer release |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 / 1280 | 267.4 | 65.5 | 23.3 | 25.3 | 25.2 | 21.3 | 27.1 |
| 20 / 390 | 274.4 | 58.0 | 23.5 | 25.5 | 25.9 | 28.8 | — |
| 100 / 1280 | 329.5 | 118.5 | 47.6 | 27.3 | 36.0 | 36.2 | 28.4 |
| 100 / 390 | 298.1 | 67.0 | 24.8 | 24.6 | 25.3 | 27.8 | — |
| 300 / 1280 | 469.6 | 201.7 | 151.9 | 70.5 | 86.1 | 82.0 | 83.1 |
| 300 / 390 | 348.1 | 126.1 | 49.3 | 26.6 | 40.6 | 32.3 | — |

Title/description search, combined filtering and zero-result medians span
19.6–43.6ms. Manual-order initialization spans 16.2–56.9ms; child creation spans
25.9–100.1ms. Desktop reset remounts all visible cards and is the heaviest common
interaction: **141–171.8ms** at 300 tasks. The largest retained cold startup is
**1,626.8ms**, also at 300/1280; its other cold samples range 401.1–911.3ms.

Observed medians and retained maxima meet the applicable #97 targets: small/medium
startup ≤1s, search/filter/reset/movement ≤100ms, details ≤150ms; large startup
≤2s, search/filter/reset ≤200ms, movement/details ≤250ms. Save-pipeline timing is
separately instrumented below; overall edit response is not substituted for it.
An excluded one-sample setup pilot had a 6.2s first cold start; it did not recur in
the ten retained small-desktop cold contexts (235.8–295.6ms). It is disclosed as an
unattributed setup outlier, not silently included in a favorable median or used
to justify an application change.

## React, browser and persistence profiling

A separate `react-dom/profiling` production build wraps App in React Profiler and
records component entries plus context/filter/order/validation/decode/save calls.
Three retained samples per scenario/tier follow two warmups at desktop width.
Diagnostic overhead means these numbers are **not production budget results**.

- Warm restoration renders 20/100/300 cards once. Aggregate React actual-duration
  medians are approximately 14.0/63.4/64.6ms across its root commits.
- Search renders only matching cards (2/10/30); combined filtering renders 1/1/3.
  Reset renders all 20/100/300 cards, with React actual-duration medians
  5.9/19.1/36.6ms. DOM/layout work explains additional browser response cost.
- Opening/closing details and content edits rerender the visible board. Accepted
  move completion renders two card passes (40/200/600 component entries), covering
  board state and drag cleanup. This is a future optimization opportunity if
  measured budgets tighten, not evidence requiring broad memoization now.
- Derived context, filtering and ordering are recalculated on Board renders.
  At 300 tasks the maximum per-sample totals are 0.4ms for context, 0.3ms for
  filtering and 0.6ms for ordering; these selectors are not the dominant cost.
  Per-sample call counts/durations are retained; do not interpret React duration
  alone as total input latency or double-count nested profiler measurements.
- Read-only actions and current-schema hydration write **zero board records**.
  Accepted edits, child creation and moves write **one**. First Manual activation
  intentionally persists initialized positions; later mode switches retain them.
- The full normal `saveBoard` boundary includes validation, serialization,
  preflight read, write, postflight verification and revision processing. Across
  diagnostic mutation samples it spans about **0.7–1.3 / 2.6–4.1 / 9.7–13.0ms**
  for 20/100/300 tasks, below the small/medium 100ms guidance with no multi-second
  large-board freeze. This excludes the outer session guard and subsequent React
  rendering. Raw `setItem` duration is captured only as a separate sub-operation.
- Diagnostic 300-task runs contain 50–135ms main-thread long tasks, especially
  restoration/reset and mutations. They are retained rather than called zero
  jank. Production response results do not indicate a release-blocking stall.

## Bundle review

Production build succeeds with **92 modules**, no size/build warnings, one eager
JS chunk and one stylesheet; no dynamic chunks. Vite reports **327.18KB JS /
99.73KB gzip**, **48.93KB CSS / 8.36KB gzip**, HTML .53KB/.31KB gzip.
Independent Node gzip/Brotli values and SHA256 hashes are retained and labeled
separately because compression settings differ.

Compared with the original v1.5 local baseline (280.05KB JS /87.14KB gzip,
20.71KB CSS /4.48KB gzip), shipping JS grows ~16.8% raw/~14.4% Vite gzip and CSS
~136% raw/~87% gzip. v2 includes linked work, ordering, persistence recovery,
notifications, controls and accessible responsive dialogs; this is a scope/size
comparison, not an isolated performance attribution. React DOM and dnd-kit are
the main expected library contributors. The module inventory contains no axe,
Playwright or test framework runtime. Pre-minification rendered module lengths
are attribution hints, not additive minified chunk sizes. No library replacement,
chunk split or dependency upgrade is justified by this result.

## Regression and accessibility

| Check | Result |
| --- | --- |
| `npm run lint` / `npm run typecheck` | Passed |
| `npm test -- --run --maxWorkers=1` | **487 passed / 45 files**, one worker, unchanged timeouts, 174.96s |
| `npm run build` | Passed, no warnings |
| Full production Chromium suite | **70 passed**, desktop/mobile; initial 3.2m, final 2.3m, no retries |
| Practical scripted browser inspection | **17 cases passed**, installed Chrome |
| Optional Firefox/WebKit audit | **60 passed**, 20/project, final 3.6m; recovery **9 focused repeats passed** |
| Actual browser zoom | **100%, 200%, 400% passed**; effective CSS widths 1280/640/320 |

The practical script exercises independent CRUD; Priority/Manual and positional
controls; combined search/filter/reset; raw-storage-preserving invalid workflow
and full/over-capacity rejections; keyboard focus/announcements; confirmation
cancel/confirm; and refresh without reseeding storage. For each tier a separate
valid correctness fixture places one family in Review, verifies parent completion
is blocked while children are hidden by filtering, completes every unfinished
child through the UI, then completes the parent and refreshes. This variant is
explicitly separate from the approved-distribution timing fixtures.

Viewport inspection uses 320×568, 360×800, 390×844, 768×1024, 1024×768, 1280×720,
1440×900, 1920×1080, coarse 844×390, fine 1280×375 and coarse 375×300. It checks
expected mobile-stage presentation, no page overflow, create-dialog focus trap/
return, reduced-motion card transitions and 200% root text. Screenshots at four
widths were inspected; desktop's board scroller is intentional. These scripted
browser inspections supplement, rather than replace, the existing sensor,
relationship, form-validation, notification, corruption recovery, migration and
cross-tab conflict journeys described in the [risk map](v2-testing.md).

The new QA driver initially had a duplicate-label selector (board filter versus
editor field); it was scoped to the dialog and rerun successfully. The optional audit then exposed a separate keyboard-test platform assumption:
macOS WebKit skips ordinary buttons with native Tab on this host. A minimal plain
HTML two-button page reproduced it without TaskFlow (Tab→body; Option-Tab→second
button); Chromium/Firefox native Tab reached the second button. Waiting for the
reopened dialog did not fix it: three focused repeats passed in Firefox and all
six WebKit repetitions still failed. The recovery journey now uses native
Option-Tab only on macOS WebKit and explicitly asserts both initial Cancel focus
and subsequent Confirm focus. It still activates recovery with Enter and checks
quota failure, untouched bytes, successful replacement and refresh. No assertion,
application behavior, retry policy or timeout was weakened. No product defect
was established and no application fix was made.

## Lighthouse and v1.5 comparison

Lighthouse **13.5.0**, installed Chrome **155.0.8059.40**, local production
`http://127.0.0.1:4189/`, fresh Chrome process/profile per run, cleared storage,
repository **nine-task first-use board**. These audits are separate from the
20/100/300-task interaction budgets. Three mobile then three explicit desktop
runs, sequentially, all valid with **no Lighthouse run warnings**.

| Profile | Performance runs → median | Accessibility | Best Practices | SEO |
| --- | --- | ---: | ---: | ---: |
| Mobile | 94 / 99 / 99 → **99** | **100** each | 96 each | 82 each |
| Desktop | 100 / 100 / 100 → **100** | **100** each | 96 each | 82 each |

Independent metric medians (all samples/ranges/configuration/report hashes retained):

| Profile | FCP | LCP | TBT | CLS | Speed Index |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mobile | 1.355s | 1.679s | 90ms | 0 | 1.355s |
| Desktop | .365s | .413s | 0ms | 0 | .365s |

Mobile run 1 retains **190ms TBT / 4.390s Speed Index**, versus 88–90ms /
1.353–1.355s in runs 2/3. It is an observed lab outlier with no established
application cause; it is neither discarded nor replaced by a fourth run.
Desktop LCP spans .411–.421s. No numerical Lighthouse gate is added to CI.

Settings match the original [v1.5 local baseline](v1.5-quality-baseline.md):
mobile 412×823/DPR1.75, simulated RTT150ms/1638.4Kbps/CPU4×; desktop
1350×940/DPR1, RTT40ms/10240Kbps/CPU1×. That baseline used Chrome154, the same
Lighthouse version and nine sample tasks. Relative to its independent medians,
mobile Performance is 90→99, FCP 1.436→1.355s, LCP 1.887→1.679s, TBT299.5→90ms,
CLS .03888→0; desktop Performance remains100, LCP .398→.413s, CLS .02370→0.
Accessibility96→100 reflects the later accessibility work and sampled audit
results, not a new full-WCAG certification. Best Practices96/SEO82 are unchanged.

The later [v1.5 local release candidate](v1.5-release-qa.md#lighthouse-comparison--local-only)
already measured mobile99/desktop100, mobile LCP1.702s/TBT39ms and desktop
LCP.404s/TBT0. Against that closer reference, current mobile LCP is ~23ms lower,
TBT ~51ms higher; desktop LCP is ~9ms higher. Browser-version changes, v2 feature
scope, shared-host and simulated-lab variance prevent causal attribution from
these small sets. Historical deployed Preview scores include toolbar cookies
and indexing headers and are **not** substituted for local baselines. No
reproducible release-blocking regression is established by this comparison.

Retained findings: Best Practices reports only the local
`/_vercel/speed-insights/script.js` **404** console error; SEO reports the missing
meta description and `/robots.txt` receiving SPA HTML (15 syntax errors).
Lighthouse also estimates ~51KiB unused initial JavaScript and 150ms mobile
render-blocking savings. These are documented review opportunities, not evidence
requiring a library replacement or score-driven redesign. Analytics/deployed
routing and search metadata remain release/deployment follow-up work; nothing is
stubbed, blocked, hidden or changed to improve scores.

## Reproduce and interpret

Baseline commands executed:

```bash
npm run lint
npm run typecheck
npm test -- --run --maxWorkers=1
npm run build
CI=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4189 npm run test:e2e:ci
```

One Vitest worker reduces contention on this 8GB host; no test/assertion timeout
was changed. Keep `dist` unchanged during browser work.
Then, **sequentially**, from the repo root with installed Chrome and Playwright:

```bash
TASKFLOW_QA_OUTPUT=/private/tmp/taskflow49-production node scripts/qa/performance.cjs
# Set TASKFLOW_QA_OUTPUT to retain a new set; defaults under /private/tmp.
# TASKFLOW_QA_TIERS=100 TASKFLOW_QA_WIDTHS=1280 limits an exploratory set.
# TASKFLOW_QA_SCENARIOS=warmReload TASKFLOW_QA_SKIP_COLD=1 repeats only warm starts.

node scripts/qa/profile-build.mjs
npm run preview -- --host 127.0.0.1 --port 4190 --strictPort --outDir /private/tmp/taskflow49-profile
# In another terminal after preview starts:
TASKFLOW_QA_PROFILE=1 TASKFLOW_QA_RUNS=3 TASKFLOW_QA_WIDTHS=1280 \
  TASKFLOW_QA_URL=http://127.0.0.1:4190 \
  TASKFLOW_QA_OUTPUT=/private/tmp/taskflow49-profile-results node scripts/qa/performance.cjs

TASKFLOW_QA_TRACE=1 TASKFLOW_QA_RUNS=1 TASKFLOW_QA_TIERS=100 \
  TASKFLOW_QA_WIDTHS=1280 TASKFLOW_QA_SKIP_COLD=1 \
  TASKFLOW_QA_SCENARIOS=titleSearch,reset,detailsOpen,keyboardMove,pointerMove \
  TASKFLOW_QA_OUTPUT=/private/tmp/taskflow49-trace node scripts/qa/performance.cjs
node scripts/qa/regression.cjs
CI=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4189 npx playwright test \
  --config=playwright.crossbrowser.config.ts e2e/recovery.spec.ts \
  -g 'unresolved data survives' --repeat-each=3
CI=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4189 npx playwright test \
  --config=playwright.crossbrowser.config.ts e2e/accessibility.spec.ts \
  e2e/controls.spec.ts e2e/recovery.spec.ts e2e/taskflow.spec.ts
TASKFLOW_PREVIEW_URL=http://127.0.0.1:4189 \
  TASKFLOW_QA_OUTPUT=/private/tmp/taskflow49-zoom node scripts/qa-browser-zoom.cjs
node scripts/qa/bundle.mjs

# Separate temporary tooling; no package.json/lockfile change:
npm install --prefix /private/tmp/taskflow49-tools --no-save --package-lock=false lighthouse@13.5.0
node scripts/qa/lighthouse.mjs
```

`TASKFLOW_QA_URL` overrides the preview URL for all new browser drivers;
`TASKFLOW_REGRESSION_OUTPUT`, `TASKFLOW_LIGHTHOUSE_OUTPUT`, `TASKFLOW_LIGHTHOUSE_DIR`
and `TASKFLOW_PROFILE_DIR` override their corresponding paths. Stop preview
processes after use. Timing failures are observable-state assertions, not machine-
dependent latency gates. Raw report/trace/profile paths and hashes are recorded
in compact evidence; ephemeral files are not durable downloadable artifacts.
Regenerate them with the scripts for trace-level inspection.

Remaining verification limits: approved M1-class reference host; physical iOS/
Android and on-screen keyboards; actual Safari; spoken VoiceOver/screen-reader
output; protected/deployed-origin behavior and real-user/network telemetry.
Existing browser focus, live-region, axe, zoom and touch assertions cannot certify
these. Recommended follow-up is owner device/speech smoke testing and deployment
QA during release work, plus a reference-host rerun if formal #97 certification
is required. No speculative performance refactor or new feature is included.
