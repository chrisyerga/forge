import { buildGenerationPlan } from '@/core/prompts'
import type {
  Brief,
  Entity,
  GenerationPlan,
  ModelSpec,
  OutputSpec,
  Persona,
  Project,
  Style,
} from '@/core/types'

const DEFAULT_OUTPUT: OutputSpec = { kind: 'story', text: { format: 'markdown' } }

// Chat playground / chat API: the conversation lives in the messages, so the
// plan only contributes the system prompt (and a place to inject entities later).
export function buildChatPlan(model?: ModelSpec): GenerationPlan {
  return buildGenerationPlan(
    { brief: { prompt: '' }, entities: [], output: DEFAULT_OUTPUT },
    {
      models: model ? { text: model } : {},
      systemPrompt:
        'You are Forge, a helpful AI assistant for content generation. Respond clearly and concisely.',
    },
  )
}

export type GenerateBody = {
  prompt: string
  title?: string
  audience?: string
  output?: OutputSpec
  entities?: Array<Entity>
  persona?: Persona
  styles?: Array<Style>
  project?: Project
  constraints?: Array<string>
  variables?: Record<string, string>
  safety?: Brief['safety']
  model?: ModelSpec
}

// Structured /v1/generate path: assemble a full GenerationRequest from the body
// and run it through core's buildGenerationPlan (single prompt-assembly path).
export function buildGeneratePlan(body: GenerateBody): GenerationPlan {
  const brief: Brief = {
    prompt: body.prompt,
    title: body.title,
    audience: body.audience,
    safety: body.safety,
    variables: body.variables,
  }
  return buildGenerationPlan(
    {
      project: body.project,
      brief,
      entities: body.entities ?? [],
      persona: body.persona,
      styles: body.styles,
      output: body.output ?? DEFAULT_OUTPUT,
      constraints: body.constraints,
    },
    { models: body.model ? { text: body.model } : {} },
  )
}
