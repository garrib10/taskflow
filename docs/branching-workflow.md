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
