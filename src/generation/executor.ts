import type { ModelMessage } from 'ai'
import type { GenerationPlan } from '@/core/types'

export type GenerationSource = 'api' | 'playground'

export type GenerationFinishInfo = {
  status: 'complete' | 'error'
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  finishReason?: string
  result?: string
  errorMessage?: string
}

// The observability choke point. Implementations (see src/lib/generationLogger.ts)
// persist a `generations` row at start and patch it on finish/error. Kept free of
// Convex types so the generation edge stays framework-agnostic.
export interface GenerationLogger {
  start(info: { provider: string; model: string }): void
  finish(info: GenerationFinishInfo): Promise<void>
}

export type ExecuteArgs = {
  plan: GenerationPlan
  messages: Array<ModelMessage>
  source: GenerationSource
}

// One method, intentionally. Swap the implementation (e.g. raw OpenAI) without
// touching core, the /v1 contract, or the web UI.
export interface GenerationExecutor {
  streamText(args: ExecuteArgs, logger: GenerationLogger): Response
}
