import { createFileRoute } from '@tanstack/react-router'
import { convertToModelMessages, type UIMessage } from 'ai'
import { aiSdkExecutor } from '@/generation/aiSdkExecutor'
import { buildChatPlan } from '@/generation/requests'
import { createConvexClient } from '@/lib/convexServer'
import { resolveCaller } from '@/lib/routeAuth'
import { createConvexGenerationLogger } from '@/lib/generationLogger'
import { json } from '@/lib/http'
import type { ModelSpec } from '@/core/types'

export const Route = createFileRoute('/v1/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const client = createConvexClient()
        const caller = await resolveCaller(client, request)
        if (!caller) return json({ error: 'Unauthorized' }, 401)

        const body = (await request.json()) as {
          messages?: Array<UIMessage>
          model?: ModelSpec
        }
        if (!Array.isArray(body.messages)) {
          return json({ error: 'messages[] is required' }, 400)
        }

        const messages = await convertToModelMessages(body.messages)
        const plan = buildChatPlan(body.model)
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
