# Forge

A central **AI content-generation service**. One TanStack Start (Nitro) app serves
both a management web UI and a streaming `/v1` generation API, backed by a single
Convex deployment for data, auth, API keys, and generation records. OpenAI calls run
on the app server (flat VPS compute), keeping Convex on its cheap, reactive sweet spot.

Other apps consume `https://forge.lindale.tech/v1` instead of copying generation code.

## Architecture

```
Browser / other apps
      │  (session JWT  |  Bearer API key)
      ▼
Caddy edge ──► TanStack Start / Nitro (:3000)
                 ├─ web UI (React + shadcn-style UI + AI SDK chat)
                 ├─ /v1/chat, /v1/generate  (server routes)
                 ├─ src/core/        pure prompt assembly (buildGenerationPlan)
                 └─ src/generation/  GenerationExecutor → Vercel AI SDK → OpenAI
                          │ onFinish: usage/result + telemetry
                          ▼
                       Convex (DB, Auth, API keys, generation records)
```

- **`src/core`** — framework-agnostic domain types + prompt builders, vendored from
  `@lindale/generation-core`. No Convex / TanStack / AI-SDK imports.
- **`src/generation`** — the edge: a one-method `GenerationExecutor` interface with a
  default `aiSdkExecutor`. This is the single choke point for the AI SDK call,
  Convex generation logging, and OpenTelemetry (`experimental_telemetry`).
- **`convex/`** — schema modeled on the core types (`projects`, `entities`,
  `personas`, `styles`, `apiKeys`, `generations`), Convex Auth, authed wrappers,
  and secret-guarded server functions for the Node routes.

## Stack

- TanStack Start + Nitro (Vite 8, React 19)
- Convex + Convex Auth
- Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) — pinned
- Tailwind v4 + shadcn-style UI components
- pnpm

## Local development

```bash
pnpm install

# Terminal 1 — Convex (dev deployment + codegen + watch)
pnpm convex:dev

# Terminal 2 — the app
pnpm dev   # http://localhost:3000
```

Set environment variables (see `.env.example`). `npx convex dev` writes
`VITE_CONVEX_URL` / `CONVEX_DEPLOYMENT` into `.env.local`. For generation you also need
`OPENAI_API_KEY` and a matching `FORGE_SERVER_SECRET` on both the app and the Convex
deployment (`npx convex env set FORGE_SERVER_SECRET <value>`).

To wire Convex Auth keys against a real deployment, run `npx @convex-dev/auth` once.

## The `/v1` API

Authenticate with `Authorization: Bearer <key>` where `<key>` is a Forge API key
(created in the **API Keys** page) or a logged-in user's session token.

### `POST /v1/chat`

```jsonc
{ "messages": [{ "role": "user", "parts": [{ "type": "text", "text": "Hi" }] }] }
```

Returns an AI SDK UI message stream (consumable by `@ai-sdk/react`'s `useChat`).

### `POST /v1/generate`

```jsonc
{
  "prompt": "Write a short bedtime story",
  "entities": [{ "id": "e1", "kind": "pet", "name": "Biscuit", "traits": ["curious"] }],
  "output": { "kind": "story", "text": { "format": "markdown" } },
  "model": { "provider": "openai", "model": "gpt-4o-mini" }
}
```

Assembles a `GenerationRequest` → `buildGenerationPlan()` → streams the result. Every
call is recorded in the `generations` table (usage, finishReason, status, result).

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm build` | Build client + Nitro server (`.output/server/index.mjs`) |
| `pnpm start` | Run the built server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm convex:dev` | Convex dev deployment + codegen |
| `pnpm convex:deploy` | Deploy Convex (production) |

## Deployment

See [PORCH.md](./PORCH.md). Pushes to `main` build the image, register the service
with Porch on milo, and deploy Convex.
