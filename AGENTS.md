<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Cursor Cloud specific instructions

Forge is a single TanStack Start (Nitro) app + a single Convex deployment. Standard
scripts and the `/v1` API are documented in `README.md`; only cloud-specific caveats
are captured here.

### Services (both must run together for the web UI to work)

- Convex backend + codegen watch: `CONVEX_AGENT_MODE=anonymous npx convex dev`
  (serves at `http://127.0.0.1:3210`, dashboard-less). The `CONVEX_AGENT_MODE=anonymous`
  env var is required — without it the CLI tries to log in and fails in a non-interactive
  shell.
- App dev server: `pnpm dev` (http://localhost:3000). It needs the Convex backend
  running first, since `VITE_CONVEX_URL` points at the local deployment.

### Local Convex deployment (no Convex cloud account)

- This VM uses an **anonymous local Convex deployment**. It was initialised once with
  `CONVEX_AGENT_MODE=anonymous npx convex init`, which downloaded the backend binary and
  wrote `CONVEX_DEPLOYMENT` / `VITE_CONVEX_URL` / `VITE_CONVEX_SITE_URL` into `.env.local`
  (gitignored). The backend binary + data live in the VM snapshot, so normally you just
  run the two services above.
- If `.env.local` or the local deployment is missing on a fresh VM, re-run
  `CONVEX_AGENT_MODE=anonymous npx convex init`, then re-set the deployment env vars below.

### Environment variables

- `.env.local` (app side, gitignored) holds `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`,
  `CONVEX_URL`, `FORGE_SERVER_SECRET`, and `FORGE_SEARCH_PROVIDER=fake`.
- The Convex deployment has `FORGE_SERVER_SECRET` (must match `.env.local`), plus Convex
  Auth keys `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` set via `npx convex env set ...`.
  These enable email/password sign-up. To regenerate auth keys use `npx @convex-dev/auth`
  or generate an RS256 keypair manually and set `JWT_PRIVATE_KEY` (PKCS8 PEM with newlines
  replaced by spaces) and `JWKS`.
- `OPENAI_API_KEY` powers AI generation (`/v1/generate`, `/v1/chat`, the playground, and
  the task harness `generate` stage; default model `gpt-4o-mini`). It is provided as a
  cloud-agent secret, so a **fresh** shell has it in `process.env` and `pnpm dev` inherits
  it automatically. Gotcha: a long-lived tmux/server shell started *before* the secret was
  injected will have a stale env — restart the dev server from a fresh shell, or run
  `set -a; . ./.env.local; set +a; pnpm dev` (the key is also mirrored into gitignored
  `.env.local`). Without the key, only auth/projects/entities/API-keys work.
  `TAVILY_API_KEY` is not needed because `FORGE_SEARCH_PROVIDER=fake` returns canned
  search results.

### Lint / typecheck

- There is no ESLint config; `pnpm typecheck` (`tsc --noEmit`) is the type/lint gate.
