# Current v2.0 release-candidate screenshots

Captured on October 15, 2026 from the production build in the #50 preparation
branch. These are real Playwright browser captures, not generated mockups.

- Desktop states use **1440×900**, DPR1; mobile states use **390×844**, DPR1,
  Chromium touch/mobile emulation. Each device group has a consistent viewport.
- Eight synthetic tasks show normal capacities, a parent and two children (one
  completed), realistic titles/descriptions and all four stages. Dates are fixed;
  locale is en-US with America/New_York time. No personal profile/data is used.
- PNG captures use reduced motion and wait for active animations to settle.
  No CSS injection, compositing or image editing changes the application view.
  File sizes and SHA256 hashes are retained in [the manifest](manifest.json).
- Mobile is browser emulation, not physical-device or spoken-screen-reader proof.
  Modals use their actual scrollable content and fixed actions; these are viewport
  captures, not stitched full-form images.

| Image | State / meaningful use |
| --- | --- |
| [Desktop board](desktop-board.png) | Current warm clay interface, complete-board capacity and related-work cards |
| [Desktop details](desktop-details.png) | Parent detail drawer with subtask progress, completion cue and compact actions |
| [Desktop editor](desktop-editor.png) | Explicit content editing, Category/Priority/Stage and collapsible subtasks |
| [Desktop filters](desktop-filters.png) | Combined query/category/priority scope, chips and whole-board result count |
| [Mobile board](mobile-board.png) | Search/ordering/filter disclosure and single-stage navigation |
| [Mobile details](mobile-details.png) | Task sheet, metadata, linked work and wrapped/reachable actions |

These replace the v1.x illustrations in the main README. Earlier images remain
where historical documentation and the [portfolio comparison](../../docs/portfolio.md)
use them; they are not silently relabeled as v2.

## Reproduce

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4189 --strictPort
# In another terminal, from the repository root:
node scripts/qa/release-screenshots.cjs
```

`TASKFLOW_QA_URL` overrides the production-preview URL;
`TASKFLOW_SCREENSHOT_OUTPUT` overrides the output directory. Keep `dist` unchanged
during capture. The script uses isolated synthetic LocalStorage, verifies named
states/counts, checks page overflow and captures without application exceptions.
It does not modify the app's default sample data or runtime code.
