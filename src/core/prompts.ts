// Vendored from @lindale/generation-core (cafezoe). Pure prompt/plan builders.
import type { Entity, GenerationPlan, GenerationRequest, GenerationVariables, Style } from './types'

export function interpolateTemplate(template: string, variables: GenerationVariables): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value)
  }
  return result
}

export function buildEntityBlock(entities: Array<Entity>): string {
  if (!entities.length) return ''

  return [
    'Entities:',
    ...entities.map((entity) => {
      const details = [
        entity.kind,
        entity.relationship,
        entity.description,
        entity.visualDescription ? `Visual: ${entity.visualDescription}` : undefined,
        entity.traits?.length ? `Traits: ${entity.traits.join(', ')}` : undefined,
      ].filter(Boolean)

      return `- ${entity.name}: ${details.join('; ')}`
    }),
  ].join('\n')
}

export function buildStyleBlock(styles: Array<Style> = []): string {
  const fragments = styles
    .map((style) => {
      const description = style.promptFragment?.trim() || style.description?.trim()
      if (!description) return undefined
      return `- ${style.name} (${style.kind}): ${description}`
    })
    .filter((line): line is string => line !== undefined)

  if (!fragments.length) return ''
  return ['Styles:', ...fragments].join('\n')
}

export function buildPersonaBlock(request: GenerationRequest): string {
  const persona = request.persona
  if (!persona) return ''

  const parts = [
    `Persona: ${persona.name}`,
    persona.kind ? `Role: ${persona.kind}` : undefined,
    persona.artificial === undefined ? undefined : `Artificial: ${persona.artificial ? 'yes' : 'no'}`,
    persona.tagline,
    persona.description,
    persona.pointOfView,
    ...(persona.promptFragments ?? []),
  ].filter((part): part is string => Boolean(part?.trim()))

  return parts.join('\n')
}

export function buildDefaultSystemPrompt(request: GenerationRequest): string {
  const outputKind = request.output.kind.replaceAll('_', ' ')
  const safety = request.brief.safety?.rating === 'child_safe' ? 'Keep the content child-safe.' : undefined

  return [
    `You are generating ${outputKind} content from structured context.`,
    'Honor the persona, entities, styles, audience, and constraints without inventing unsupported identity details.',
    safety,
  ]
    .filter(Boolean)
    .join(' ')
}

export function buildDefaultUserPrompt(request: GenerationRequest): string {
  const variables = {
    ...(request.brief.variables ?? {}),
    ...(request.variables ?? {}),
  }

  const prompt = interpolateTemplate(request.brief.prompt, variables)
  const blocks = [
    request.project ? `Project: ${request.project.name}\n${request.project.description ?? ''}`.trim() : '',
    request.brief.title ? `Brief: ${request.brief.title}` : '',
    request.brief.catalyst ? `Catalyst: ${request.brief.catalyst.kind}: ${request.brief.catalyst.description}` : '',
    request.brief.audience ? `Audience: ${request.brief.audience}` : '',
    prompt ? `Prompt:\n${prompt}` : '',
    buildPersonaBlock(request),
    buildEntityBlock(request.entities),
    buildStyleBlock(request.styles),
    request.constraints?.length ? `Constraints:\n- ${request.constraints.join('\n- ')}` : '',
    request.brief.safety?.constraints?.length
      ? `Safety constraints:\n- ${request.brief.safety.constraints.join('\n- ')}`
      : '',
  ].filter(Boolean)

  return blocks.join('\n\n')
}

export function buildImagePrompts(args: { request: GenerationRequest; basePrompt?: string }): Array<string> {
  const imageSpec = args.request.output.image
  if (!imageSpec || imageSpec.count <= 0) return []

  const imageStyles = (args.request.styles ?? []).filter((style) => style.kind === 'image' || style.kind === 'multimodal')
  const styleHint = imageStyles
    .map((style) => style.promptFragment?.trim() || style.description?.trim() || style.name)
    .filter(Boolean)
    .join(' ')

  const base = args.basePrompt?.trim() || args.request.brief.prompt.trim()
  const noText = imageSpec.noText ?? true

  return Array.from({ length: imageSpec.count }, (_, index) => {
    const parts = [
      base,
      styleHint,
      imageSpec.aspectRatio ? `Aspect ratio: ${imageSpec.aspectRatio}.` : '',
      noText ? 'No text in image.' : '',
      `Variation ${index + 1}.`,
    ].filter(Boolean)

    return parts.join(' ')
  })
}

export function buildGenerationPlan(
  request: GenerationRequest,
  options: {
    models?: GenerationPlan['models']
    systemPrompt?: string
    userPrompt?: string
    metadataPrompt?: string
    imageBasePrompt?: string
    now?: Date
  } = {},
): GenerationPlan {
  return {
    request,
    prompts: {
      system: options.systemPrompt ?? buildDefaultSystemPrompt(request),
      user: options.userPrompt ?? buildDefaultUserPrompt(request),
      metadata: options.metadataPrompt,
      image: buildImagePrompts({ request, basePrompt: options.imageBasePrompt }),
    },
    models: options.models ?? {},
    createdAt: options.now?.toISOString(),
  }
}
