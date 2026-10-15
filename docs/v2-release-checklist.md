# TaskFlow v2.0.0 release checklist and verification record

Issue [#50](https://github.com/garrib10/taskflow/issues/50), parent
[#4](https://github.com/garrib10/taskflow/issues/4). Promotion path:
**release branch → develop → staging → main**. The preparation PR uses **Refs #50**;
it does not close the issue. No promotion, production update, tag, GitHub release
or issue closure is authorized without owner review.

## Preparation record — October 15, 2026

Base: merged `develop` **9df4880**, including #49/PR #166. Source history confirms
v2 foundations/domain/persistence in PRs #149–#160, board/details/controls in
#161–#163, accessibility in #164, testing in #165, and technical QA in #166.
`main` is **6305a2d** and `staging` **797304b** at preparation; existing tag
`v1.5.0` is historical. None of those protected refs is changed by preparation.

| Item | Preparation result |
| --- | --- |
| README | Current v2 capabilities, architecture, compatibility, commands and limits |
| Architecture | Existing state-ownership guide updated to current merged implementation |
| Persistence | Current schema/migration/recovery/preference guides linked; historical implementation-stage sections labeled |
| Metadata | `package.json` and root lockfile package version 2.0.0; dependencies unchanged |
| Release notes | [Unpublished draft](releases/v2.0.0.md) |
| Portfolio | [Copy-ready text and before/after](portfolio.md); external site not edited |
| Images | Current production-build captures in [screenshot guide](../screenshots/v2/README.md) |
| Lint / strict TypeScript / unit tests / build | Passed; `npm test`: **487 / 45 files**, 79.69s, default settings; build 92 modules, no warnings |
| Chromium desktop/mobile suite | **70 passed**, 2.8m, production preview 4189, zero retries; includes migration/recovery/preferences |
| Link/image checks | Local links and fragments verified; six PNGs/hash/viewport sizes verified and visually inspected; capture driver passed Node syntax check and real execution |
| Staging / production / tag / GitHub release | **Pending owner review and later phases** |

#49's [QA report](v2-performance-regression.md) is the source for large audits,
Lighthouse, bundle, browser/zoom and timing results. No new Lighthouse or workload
audit is needed for unchanged application code and release documentation. Release
verification must still pass the normal commands on this branch:

```bash
npm run lint
npm run typecheck
npm test
npm run build
CI=1 npm run test:e2e:ci
```

The actual local browser verification uses an existing production preview:

```bash
npm run preview -- --host 127.0.0.1 --port 4189 --strictPort
# In another terminal; keep dist unchanged during the run:
CI=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4189 npm run test:e2e:ci
```

## Remaining owner-reviewed steps

1. **Review the release PR and its exact-commit Vercel preview.** Confirm the
   intended SHA, current README/images/version, and green Frontend CI, Dependency
   Review and CodeQL. Smoke-test the board, details/edit/dirty close, parent-child
   navigation, filters/reset and keyboard movement. A branch preview is not production.
2. **Merge the preparation PR into develop after review.** Do not close #50.
3. **Verify develop's updated Vercel preview.** Record URL/SHA and smoke results.
4. **Open a develop→staging PR.** Include release notes, checks and the exact
   release candidate. Review required checks and preview deployment.
5. **Merge into staging after approval.** Record the staging merge SHA and its
   actual deployment URL; validate the deployed commit, not an older cached preview.
6. **Perform final staging regression.** Fresh profile: create/edit/delete,
   details/subtasks, workflow rejection, full-capacity rejection, pointer/touch and
   keyboard moves, Priority/Manual/positions, combined filters/reset, notifications,
   dirty drafts, refresh, focus, narrow/short viewports and readable footer actions.
7. **Validate v1.x migration on that exact staging origin in isolated test contexts.**
   Exercise unversioned/schema1 checklists, v1.5/schema2 tasks/links/order, repeated
   refresh without duplicates, current schema3 no rewrite, damaged order, corrupt/
   future-byte preservation and recovery. Preserve IDs/content/dates/ties, parent
   navigation and valid over-limit boards. Never seed test data into a personal tab.
8. **Resolve blockers through a new short-lived branch and normal PR flow.**
   Merge reviewed fixes into develop, promote to staging and rerun affected checks;
   do not patch protected branches directly or waive failing assertions.
9. **Open a staging→main PR** only after the candidate is validated. Link staging
   evidence, compatibility notes and remaining accepted limitations.
10. **Review and merge the production promotion.** Obtain owner approval and green
    required checks; this document does not authorize an automatic merge.
11. **Verify the production Vercel deployment.** Check its exact main commit,
    application response/assets, current UI, console/network behavior, and live URL
    `https://taskflow-garrib10.vercel.app/`. Review analytics/robots/metadata findings
    on production; do not infer them from localhost or a protected login page.
12. **Confirm preserved v1.x functionality on production**, including CRUD,
    forward-only stages, parent/child completion, filtering, stable priority and
    saved refresh. Exercise migration/recovery with synthetic data in isolated
    contexts on this origin. Returning users' actual origin/profile remains local;
    another preview's storage is not evidence of their production data.
13. **Create an annotated v2.0.0 tag from the verified production commit.** Check
    that it is the main commit deployed and tested and that the tag does not exist.
14. **Push that tag** only after review. Do not use the preparation-branch SHA.
15. **Publish the GitHub v2.0.0 release** from the tag using the prepared notes.
    Replace the unpublished banner with verified SHA, URL, results and accepted
    limitations; verify the published release targets the correct tag/commit.
16. **Update the external portfolio description and imagery** using
    [portfolio materials](portfolio.md). These external files are not in this repo.
17. **Close #50 as completed only after production, tag and GitHub release are
    verified.** Record their URLs and final evidence in this checklist/issue.
18. **Review parent #4's required subissues.** Close it as completed only if no
    required work remains; do not infer completion from a child PR alone.

### Deployed browser commands for later phases

Replace `EXACT_STAGING_PREVIEW_URL` with the tested candidate's real accessible URL.
The existing journeys isolate browser storage; authentication/protection still
requires normal owner access. Do not audit a sign-in page as TaskFlow.

```bash
PLAYWRIGHT_BASE_URL=EXACT_STAGING_PREVIEW_URL npm run test:e2e
PLAYWRIGHT_BASE_URL=EXACT_STAGING_PREVIEW_URL npx playwright test e2e/migration.spec.ts e2e/recovery.spec.ts e2e/preferences.spec.ts
```

For production, use the verified production URL with the same isolated-context
commands. Browser emulation does not replace physical mobile/on-screen keyboard,
actual Safari or spoken VoiceOver review. Formal #97 M1-class performance
certification remains outside the Intel-host observations.

After review and verification, substitute the exact verified production SHA in
this **future manual** tag command:

```bash
git fetch origin
git show --no-patch --oneline VERIFIED_PRODUCTION_SHA
git tag -a v2.0.0 VERIFIED_PRODUCTION_SHA -m "TaskFlow v2.0.0"
git push origin refs/tags/v2.0.0
```

### Final release evidence — not yet completed

| Gate | Record when actually verified |
| --- | --- |
| Develop candidate | SHA, exact preview URL, checks and reviewer |
| Staging | Merge SHA, deployment URL, date, regression/migration results |
| Production | Main SHA, deployment URL, date, preserved-workflow results |
| Annotated tag | v2.0.0 tag object and verified target SHA |
| GitHub release | Published URL and tag |
| Portfolio / issues | External update confirmation, #50 and parent #4 review |
