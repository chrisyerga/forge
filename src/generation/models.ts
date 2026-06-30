import { openai } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import type { ModelSpec } from '@/core/types'

// Text generation default. Override per-request via the GenerationPlan's ModelSpec.
export const DEFAULT_TEXT_MODEL: ModelSpec = {
  provider: 'openai',
  model: 'gpt-4o-mini',
}

export function resolveTextModel(spec: ModelSpec): LanguageModel {
  switch (spec.provider) {
    case 'openai':
      return openai(spec.model)
    default:
      throw new Error(`Unsupported text provider: ${spec.provider}`)
  }
}
