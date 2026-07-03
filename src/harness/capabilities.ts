import { generateObject } from 'ai'
import type { ConvexHttpClient } from 'convex/browser'
import type { z } from 'zod'
import type { Id } from '../../convex/_generated/dataModel'
import type { ModelSpec } from '@/core/types'
import { DEFAULT_TEXT_MODEL, resolveTextModel } from '@/generation/models'
import { createConvexGenerationLogger } from '@/lib/generationLogger'
import type { GenerationSource } from '@/generation/executor'

// Effectful services injected into recipe stages. Stages stay pure functions
// of (context, artifacts, capabilities), so providers are swappable and stage
// logic is testable without the network.

export type UsageTotals = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type LlmCapability = {
  /** Structured generation: returns a value matching the zod schema. */
  generateObject<T>(args: {
    schema: z.ZodType<T>
    system?: string
    prompt: string
    model?: ModelSpec
  }): Promise<T>
}

export type SearchResultItem = {
  title: string
  url: string
  /** Short snippet/summary from the search provider. */
  snippet?: string
  /** Full page content when requested. */
  content?: string
  score?: number
}

export type SearchProvider = {
  search(
    query: string,
    opts?: { maxResults?: number; includeContent?: boolean },
  ): Promise<Array<SearchResultItem>>
}

export type Capabilities = {
  llm: LlmCapability
  search: SearchProvider
  /** Accumulated LLM usage for the current stage (for the step rollup). */
  usage(): UsageTotals
}

export type StageAttribution = {
  ownerId: Id<'users'>
  apiKeyId?: Id<'apiKeys'>
  projectId?: Id<'projects'>
  taskId: Id<'tasks'>
  stage: string
  source: GenerationSource
}

// One Capabilities instance per stage execution: every LLM call is logged to
// the `generations` table with task/stage attribution, and usage accumulates
// for the taskSteps rollup.
export function createStageCapabilities(args: {
  client: ConvexHttpClient
  search: SearchProvider
  attribution: StageAttribution
}): Capabilities {
  const totals: UsageTotals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  const llm: LlmCapability = {
    async generateObject({ schema, system, prompt, model }) {
      const spec = model ?? DEFAULT_TEXT_MODEL
      const logger = createConvexGenerationLogger(args.client, args.attribution)
      logger.start({ provider: spec.provider, model: spec.model })
      try {
        const result = await generateObject({
          model: resolveTextModel(spec),
          schema,
          system,
          prompt,
          experimental_telemetry: {
            isEnabled: true,
            functionId: `forge.task.${args.attribution.stage}`,
          },
        })
        totals.promptTokens += result.usage.inputTokens ?? 0
        totals.completionTokens += result.usage.outputTokens ?? 0
        totals.totalTokens += result.usage.totalTokens ?? 0
        await logger.finish({
          status: 'complete',
          promptTokens: result.usage.inputTokens,
          completionTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          finishReason: result.finishReason,
          result: JSON.stringify(result.object),
        })
        return result.object
      } catch (error) {
        await logger.finish({
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  }

  return {
    llm,
    search: args.search,
    usage: () => ({ ...totals }),
  }
}
