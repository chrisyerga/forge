# Forge API — agent instructions

Use this document when a client repo needs AI text generation without running its own
OpenAI integration. Forge is a hosted content-generation service at
**https://forge.lindale.tech**. Call its `/v1` HTTP API from your app or agent harness.

Do **not** copy Forge’s prompt-assembly or model-calling code into client repos. Send
structured requests to Forge instead.

## Setup in your repo

1. **Get an API key** — sign in at https://forge.lindale.tech, open **API Keys**, create a
   key. The plaintext is shown once; format: `forge_<prefix>_<secret>`.
2. **Store secrets in your environment** (never commit them):

   ```bash
   FORGE_API_URL=https://forge.lindale.tech
   FORGE_API_KEY=forge_xxxxxxxx_yyyyyyyyyyyyyyyyyyyyyyyy
   ```

3. **For task runs** (`/v1/tasks`), you also need a Forge **project id**. Create a project
   in the Forge UI (**Projects** page) and attach persona, styles, entities, and
   resources there. Tasks load that context automatically from `projectId`.

Local Forge dev (if you run the service yourself): use `http://localhost:3000` as
`FORGE_API_URL`.

## Authentication

Every `/v1` request must include:

```http
Authorization: Bearer <FORGE_API_KEY>
Content-Type: application/json
```

- Keys start with `forge_`. Other bearer tokens (e.g. user session JWTs) work for the
  web playground but **client repos should use API keys**.
- Missing or invalid auth → `401 { "error": "Unauthorized" }`.

## Which endpoint?

| Goal | Endpoint | Response |
| --- | --- | --- |
| One-shot structured content (blog post, story, social copy) with persona/entities/styles | `POST /v1/generate` | Streaming text (AI SDK UI message stream) |
| Multi-turn chat | `POST /v1/chat` | Streaming text (AI SDK UI message stream) |
| Long agentic pipeline (research → strategy → write → evaluate → revise) | `POST /v1/tasks` | `202` + `taskId`; poll or webhook |

Prefer **`/v1/generate`** for most agent work: it assembles prompts from structured
fields and records usage in Forge. Use **`/v1/tasks`** when you need the full SEO/article
harness with web research and quality scoring.

---

## `POST /v1/generate`

Structured generation. Forge builds system + user prompts from your payload, calls OpenAI,
and streams the result.

### Minimal request

```bash
curl -sN "$FORGE_API_URL/v1/generate" \
  -H "Authorization: Bearer $FORGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a short bedtime story about a curious cat.",
    "output": { "kind": "story", "text": { "format": "markdown" } }
  }'
```

### Full request shape

```jsonc
{
  "prompt": "Write a blog post about …",           // required
  "title": "Optional working title",
  "audience": "US dog owners",
  "output": {
    "kind": "blog_post",                           // see Output kinds below
    "text": { "format": "markdown", "wordTarget": 1200 }
  },
  "entities": [
    {
      "id": "e1",
      "kind": "pet",
      "name": "Biscuit",
      "traits": ["curious", "brave"]
    }
  ],
  "persona": {
    "id": "p1",
    "name": "Friendly vet",
    "kind": "implicit_voice",
    "description": "Warm, practical, never alarmist."
  },
  "styles": [
    {
      "id": "s1",
      "name": "Conversational",
      "kind": "text",
      "promptFragment": "Short paragraphs, plain language."
    }
  ],
  "project": {
    "id": "proj1",
    "kind": "blog",
    "name": "Pet wellness blog"
  },
  "constraints": ["Do not mention competitor brands."],
  "variables": { "season": "summer" },
  "safety": { "rating": "general" },
  "model": { "provider": "openai", "model": "gpt-4o-mini" }
}
```

**Defaults:** if omitted, `output` is `{ "kind": "story", "text": { "format": "markdown" } }`
and the model is `openai` / `gpt-4o-mini`.

### Output kinds

`blog_post` · `social_post` · `story` · `image_set` · `shirt_art` · `audio_narration` ·
`multimodal`

Text format: `markdown` · `plain_text` · `json`

### Entity kinds

`person` · `animal` · `pet` · `fictional_character` · `brand` · `place` · `object` ·
`other`

### Errors

| Status | Meaning |
| --- | --- |
| `400` | `{ "error": "prompt is required" }` |
| `401` | Unauthorized |
| `500` | Upstream model failure (logged in Forge) |

### Reading the stream (Node)

Responses use the [Vercel AI SDK UI message stream](https://sdk.vercel.ai/docs). With the
`ai` package:

```typescript
import { readUIMessageStream } from 'ai'

const res = await fetch(`${process.env.FORGE_API_URL}/v1/generate`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.FORGE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'Write a tweet about coffee.',
    output: { kind: 'social_post', text: { format: 'plain_text' } },
  }),
})

if (!res.ok) throw new Error(await res.text())

let text = ''
for await (const chunk of readUIMessageStream({ stream: res.body! })) {
  if (chunk.type === 'text-delta') text += chunk.delta
}
// `text` is the full generated content
```

If you cannot use the AI SDK, treat the body as an SSE-style stream and parse
`data: …` lines, or buffer the response and extract assistant text parts from the final
UI message payload.

---

## `POST /v1/chat`

Multi-turn chat. Conversation history lives in `messages`; Forge adds a fixed system
prompt.

### Request

```jsonc
{
  "messages": [
    { "role": "user", "parts": [{ "type": "text", "text": "Hi" }] }
  ],
  "model": { "provider": "openai", "model": "gpt-4o-mini" }  // optional
}
```

Message shape matches [AI SDK UI messages](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)
(`role`, `parts[]` with `{ "type": "text", "text": "…" }`).

### Example

```bash
curl -sN "$FORGE_API_URL/v1/chat" \
  -H "Authorization: Bearer $FORGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "parts": [{ "type": "text", "text": "Summarize Forge in one sentence." }] }
    ]
  }'
```

Errors: `400` if `messages` is missing; `401` if unauthorized. Stream format is the same
as `/v1/generate`.

---

## `POST /v1/tasks` — async agentic runs

Submits a multi-stage harness (research → strategy → generate → evaluate → optional
revise). Returns immediately; work runs on the Forge server.

### Request

```jsonc
{
  "projectId": "<Convex projects id from Forge UI>",
  "recipe": "seo_article",
  "brief": {
    "keywords": ["how to calm dog during fireworks"],
    "audience": "US dog owners",
    "objective": "Publishable blog post",
    "voice": "Warm expert vet",
    "notes": "Optional extra context"
  },
  "maxIterations": 2,
  "callbackUrl": "https://your-app.example/webhooks/forge"
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `projectId` | yes | Must belong to the API key owner |
| `recipe` | yes | Currently: `seo_article` |
| `brief` | yes | Validated per recipe (see below) |
| `maxIterations` | no | Default from recipe (`2` for `seo_article`) |
| `callbackUrl` | no | POST JSON webhook when task reaches `complete` or `failed` |

### `seo_article` brief schema

```jsonc
{
  "keywords": ["required", "array", "of strings"],  // min 1
  "objective": "optional string",
  "audience": "optional string",
  "voice": "optional string",
  "notes": "optional string"
}
```

Invalid brief → `400` with `{ "error": "Invalid brief for recipe", "issues": [...] }`.

### Response

```http
HTTP/1.1 202 Accepted
```

```json
{ "taskId": "jd7…", "status": "queued" }
```

Unknown recipe → `400`. Project not found or not owned → `404`.

---

## `GET /v1/tasks/:taskId`

Poll task status. Same API key must own the task.

### Response (abbreviated)

```jsonc
{
  "taskId": "jd7…",
  "status": "running",           // queued | running | needs_input | complete | failed | canceled
  "recipe": "seo_article",
  "currentStage": "research",    // null when queued
  "iteration": 1,
  "maxIterations": 2,
  "pendingInput": null,          // or [{ "key": "voice", "question": "…", "why": "…" }]
  "errorMessage": null,
  "createdAt": 1710000000000,
  "finishedAt": null,
  "deliverable": null,           // populated when status === "complete"
  "artifacts": [ /* stage outputs */ ]
}
```

When `status === "complete"`, `deliverable` is the final artifact (for `seo_article`, a
structured object with `title`, `slug`, `metaDescription`, `bodyMarkdown`, `tags`, etc.).

### Agent polling pattern

```typescript
async function waitForTask(taskId: string): Promise<unknown> {
  const base = process.env.FORGE_API_URL!
  const headers = { Authorization: `Bearer ${process.env.FORGE_API_KEY!}` }

  for (;;) {
    const res = await fetch(`${base}/v1/tasks/${taskId}`, { headers })
    const body = await res.json()

    if (body.status === 'needs_input') {
      // Answer questions, then keep polling
      const q = body.pendingInput[0]
      await fetch(`${base}/v1/tasks/${taskId}/input`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: { [q.key]: 'Your answer here' } }),
      })
    } else if (body.status === 'complete') {
      return body.deliverable
    } else if (body.status === 'failed') {
      throw new Error(body.errorMessage ?? 'Task failed')
    }

    await new Promise((r) => setTimeout(r, 5000))
  }
}
```

---

## `POST /v1/tasks/:taskId/input`

Resume a task paused at `needs_input`.

### Request

```json
{ "answers": { "voice": "Friendly veterinarian, second person, calm tone." } }
```

Keys must match `pendingInput[].key`. Values must be strings.

### Responses

| Status | Body |
| --- | --- |
| `200` | `{ "taskId": "…", "status": "queued" }` — task resumes |
| `400` | Invalid `answers` shape |
| `404` | Task not found |
| `409` | Task is not waiting for input |

---

## Webhooks (`callbackUrl`)

When a task finishes, Forge POSTs to `callbackUrl`:

```jsonc
{
  "taskId": "jd7…",
  "status": "complete",           // or "failed"
  "errorMessage": null,
  "deliverable": { /* same as GET when complete */ }
}
```

No signature header is attached today. Treat the webhook as a notification and fetch
`GET /v1/tasks/:taskId` to verify state if you need stronger guarantees.

---

## Agent checklist

Before calling Forge from another repo:

1. [ ] `FORGE_API_URL` and `FORGE_API_KEY` are set in the environment.
2. [ ] You chose the right endpoint (`/generate` vs `/chat` vs `/tasks`).
3. [ ] For tasks: project exists in Forge UI and `projectId` is correct.
4. [ ] For tasks: you handle `needs_input` (answer via `/input`) or set `voice` in the
       brief / project persona upfront.
5. [ ] Streaming endpoints: you parse the AI SDK UI message stream or use `readUIMessageStream`.
6. [ ] Errors: check HTTP status and JSON `{ "error": "…" }` before assuming success.

## Limits and notes

- **Models:** only `provider: "openai"` is supported for text today.
- **Tasks research stage** uses Tavily on the Forge server; callers do not need a search
  API key.
- **Generation logging:** every `/generate` and `/chat` call is recorded in Forge (usage,
  finish reason, result text).
- **Id ownership:** tasks and projects are scoped to the API key’s Forge user; you cannot
  read another user’s `taskId`.

## Quick reference

```text
POST   /v1/generate              → stream structured generation
POST   /v1/chat                  → stream chat
POST   /v1/tasks                 → 202 + taskId
GET    /v1/tasks/:taskId         → status + artifacts + deliverable
POST   /v1/tasks/:taskId/input   → resume needs_input
```

Base URL (production): **https://forge.lindale.tech**
