# Contributing to Forge

Thank you for contributing. This repository uses branch protection on `main` so changes
land through reviewed pull requests.

## Workflow

1. Fork or clone the repo and create a branch from `main`.
2. Make your changes and run `pnpm typecheck`.
3. Open a pull request against `main`.
4. Wait for CI (`typecheck`) to pass.
5. A code owner must approve the PR before it can merge.

Direct pushes to `main` are not allowed.

## Local development

See [README.md](./README.md) for setup. You need:

- Node.js 22+
- pnpm 11+
- A Convex dev deployment (`pnpm convex:dev`)
- Environment variables from `.env.example`

## Code ownership

All changes require review from `@chrisyerga` (see [.github/CODEOWNERS](./.github/CODEOWNERS)).
Sensitive paths include Convex backend code, CI/deploy workflows, and Docker config.

## Repository protection setup (maintainers)

Branch rules are defined in [.github/rulesets/main-protection.json](./.github/rulesets/main-protection.json)
and applied with:

```bash
chmod +x .github/scripts/apply-rulesets.sh
./.github/scripts/apply-rulesets.sh
```

Or configure the same settings manually under **Settings → Rules → Rulesets** in GitHub.
