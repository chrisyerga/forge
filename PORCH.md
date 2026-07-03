# Forge — Porch deployment

Forge deploys to the shared **milo** VPS via [Porch](https://github.com/lindale/porch),
served behind the shared Caddy edge at **https://forge.lindale.tech**.

## Service shape

- **Kind:** `node` (TanStack Start / Nitro server)
- **Container:** `forge-web`
- **Internal port:** `3000` (listens on `0.0.0.0`)
- **Network:** external `porch` (no published host ports)
- **Image:** `ghcr.io/chrisyerga/forge:<sha>`
- **Deploy path:** `/opt/forge`

## CI/CD

`.github/workflows/deploy.yml` runs on push to `main`:

1. `deploy` job — install, typecheck, `pnpm build`, push image to GHCR, then SSH to
   the Porch host and run `porch service register ... --json`, which writes the app
   compose file, pulls the image, starts `forge-web` on the `porch` network, updates
   DNS, renders + reloads Caddy.
2. `convex` job — `convex deploy --yes` to push schema + functions.

## Required GitHub secrets

| Secret | Purpose |
| --- | --- |
| `PORCH_HOST` / `PORCH_USER` / `PORCH_SSH_KEY` | SSH into milo |
| `VITE_CONVEX_URL` | Convex client URL (public; build arg + runtime) |
| `FORGE_SERVER_SECRET` | Shared secret for Node → Convex server functions |
| `OPENAI_API_KEY` | OpenAI key used by the generation edge |
| `TAVILY_API_KEY` | Tavily key used by the task harness research stage |
| `CONVEX_DEPLOY_KEY` | Deploy Convex schema + functions |

## Runtime env (injected by Porch `--env`)

- `CONVEX_URL`, `VITE_CONVEX_URL`
- `FORGE_SERVER_SECRET`
- `OPENAI_API_KEY`
- `TAVILY_API_KEY`

## Convex deployment env (set once with `npx convex env set`)

- `FORGE_SERVER_SECRET` (must match the value injected into the container)
- Convex Auth: `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` — generate via `npx @convex-dev/auth`.

## Manual register (from the host)

```bash
npx --yes @lindale/porch service register \
  --service-id forge \
  --domain forge.lindale.tech \
  --container forge-web \
  --port 3000 \
  --image ghcr.io/chrisyerga/forge:<sha> \
  --deploy-path /opt/forge \
  --env CONVEX_URL=... \
  --env VITE_CONVEX_URL=... \
  --env FORGE_SERVER_SECRET=... \
  --env OPENAI_API_KEY=... \
  --env TAVILY_API_KEY=... \
  --health-url https://forge.lindale.tech \
  --json
```
