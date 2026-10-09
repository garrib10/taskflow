# TaskFlow Branching and Release Workflow

TaskFlow uses a staged Git workflow to keep development work separate from the production application.

## Branches

| Branch       | Purpose                                   | Vercel Deployment |
| ------------ | ----------------------------------------- | ----------------- |
| `main`       | Stable released code                      | Production        |
| `staging`    | Release-candidate testing                 | Preview           |
| `develop`    | Integration of completed development work | Preview           |
| `feature/*`  | Individual features                       | Preview           |
| `fix/*`      | Bug fixes                                 | Preview           |
| `test/*`     | Testing changes                           | Preview           |
| `refactor/*` | Code cleanup and refactoring              | Preview           |
| `docs/*`     | Documentation changes                     | Preview           |
| `release/*`  | Release preparation from develop          | Preview           |

## Development Workflow

1. Update the local `develop` branch.
2. Create a focused working branch from `develop`.
3. Implement and validate the change locally.
4. Push the working branch and open a pull request into `develop`.
5. Review the pull request and its Vercel Preview Deployment.
6. Merge approved work into `develop`.

## Release Workflow

1. Open a pull request from `develop` into `staging`.
2. Perform release-candidate testing using the `staging` Preview Deployment.
3. Fix release-blocking defects through focused branches.
4. Merge approved fixes through `develop` and promote them to `staging`.
5. Open a pull request from `staging` into `main`.
6. Verify the production deployment.
7. Create the Git tag and GitHub release.

## Production Rule

The `main` branch is the Vercel production branch. Changes should reach `main` only after validation through `develop` and `staging`.

## Quality checks before promotion

Frontend CI runs on pull requests into `develop`, `staging`, and `main`, and on
pushes to those three branches. Its existing required **Lint and build** job now
includes lint, strict TypeScript, unit/component/integration tests, production
build, and the desktop/mobile Chromium smoke suite. **Dependency review** remains
an existing required PR check. Keeping these names preserves the current branch
rules; browser or integration failures fail the required frontend job.

Review the Vercel deployment status and its exact commit preview before merging.
Normal free-plan previews are used for feature branches, `develop`, and `staging`;
`main` is the production branch. Deployment protection may require signing in to
Vercel to inspect a preview. A successful deployment status alone does not prove
that its application works in a browser. No automated promotion or paid
pre-production environment is configured by the integration-testing work.

## v1.5 preparation boundary

`release/v1.5.0-prep` prepares documentation, version metadata and QA in a draft PR to `develop` (#88–#90). It does not change `staging` or `main`, create a tag, publish a GitHub release, or deploy production. After review/merge and readiness approval, #91 handles promotion and publishing. No paid Vercel custom pre-production environment is required.

LocalStorage is origin-specific. Feature previews, the staging preview and production do not transfer boards automatically, even when they run identical source. Returning-user tests use controlled fixtures on the exact tested origin.
