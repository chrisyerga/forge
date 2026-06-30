import { createFileRoute } from '@tanstack/react-router'
import type { ModelMessage } from 'ai'
import { aiSdkExecutor } from '@/generation/aiSdkExecutor'
import { buildGeneratePlan, type GenerateBody } from '@/generation/requests'
import { createConvexClient } from '@/lib/convexServer'
import { resolveCaller } from '@/lib/routeAuth'
import { createConvexGenerationLogger } from '@/lib/generationLogger'
import { json } from '@/lib/http'

export const Route = createFileRoute('/v1/generate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const client = createConvexClient()
        const caller = await resolveCaller(client, request)
        if (!caller) return json({ error: 'Unauthorized' }, 401)

        const body = (await request.json()) as GenerateBody
        if (typeof body.prompt !== 'string' || body.prompt.length === 0) {
          return json({ error: 'prompt is required' }, 400)
        }

        const plan = buildGeneratePlan(body)
        const messages: Array<ModelMessage> = [{ role: 'user', content: plan.prompts.user }]
        const logger = createConvexGenerationLogger(client, {
          source: caller.source,
          ownerId: caller.ownerId,
          apiKeyId: caller.apiKeyId,
        })

        return aiSdkExecutor.streamText({ plan, messages, source: caller.source }, logger)
      },
    },
  },
})
