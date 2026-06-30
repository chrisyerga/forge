import type { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { getServerSecret } from './convexServer'
import type { GenerationFinishInfo, GenerationLogger, GenerationSource } from '@/generation/executor'

// Convex-backed implementation of the GenerationLogger choke point: inserts a
// `generations` row at start and patches it on finish/error.
export function createConvexGenerationLogger(
  client: ConvexHttpClient,
  ctx: {
    source: GenerationSource
    ownerId: Id<'users'>
    apiKeyId?: Id<'apiKeys'>
    projectId?: Id<'projects'>
  },
): GenerationLogger {
  let idPromise: Promise<Id<'generations'>> | undefined

  return {
    start({ provider, model }) {
      idPromise = client.mutation(api.server.recordGenerationStart, {
        serverSecret: getServerSecret(),
        ownerId: ctx.ownerId,
        apiKeyId: ctx.apiKeyId,
        projectId: ctx.projectId,
        source: ctx.source,
        provider,
        model,
      })
    },
    async finish(info: GenerationFinishInfo) {
      if (!idPromise) return
      const generationId = await idPromise
      await client.mutation(api.server.recordGenerationFinish, {
        serverSecret: getServerSecret(),
        generationId,
        status: info.status,
        promptTokens: info.promptTokens,
        completionTokens: info.completionTokens,
        totalTokens: info.totalTokens,
        finishReason: info.finishReason,
        result: info.result,
        errorMessage: info.errorMessage,
      })
    },
  }
}
