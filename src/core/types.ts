// Vendored from @lindale/generation-core (cafezoe). Pure, zero-dependency
// domain model for AI content generation. No convex/tanstack/ai-sdk imports.

export type GenerationId = string

export type GenerationModality = 'text' | 'image' | 'audio'

export type EntityKind =
  | 'person'
  | 'animal'
  | 'pet'
  | 'fictional_character'
  | 'brand'
  | 'place'
  | 'object'
  | 'other'

export type PersonaKind = 'explicit_creator' | 'implicit_voice' | 'narrator' | 'character_voice'

export type StyleKind = 'text' | 'image' | 'audio' | 'multimodal'

export type GenerationOutputKind =
  | 'blog_post'
  | 'social_post'
  | 'story'
  | 'image_set'
  | 'shirt_art'
  | 'audio_narration'
  | 'multimodal'

export type ProviderName = 'openai' | 'openrouter' | 'elevenlabs' | (string & {})

export type GenerationVariables = Record<string, string>

export type ReferenceAsset = {
  id: GenerationId
  uri?: string
  mediaType?: string
  description?: string
  role?: 'avatar' | 'reference' | 'source' | 'output'
}

export type Entity = {
  id: GenerationId
  kind: EntityKind
  name: string
  aliases?: Array<string>
  description?: string
  visualDescription?: string
  relationship?: string
  traits?: Array<string>
  referenceAssets?: Array<ReferenceAsset>
  metadata?: Record<string, unknown>
}

export type Style = {
  id: GenerationId
  slug?: string
  name: string
  kind: StyleKind
  description?: string
  promptFragment?: string
  providerProfile?: {
    provider: ProviderName
    externalId?: string
    settings?: Record<string, unknown>
  }
  metadata?: Record<string, unknown>
}

export type Persona = {
  id: GenerationId
  slug?: string
  name: string
  kind: PersonaKind
  artificial?: boolean
  tagline?: string
  description?: string
  pointOfView?: string
  promptFragments?: Array<string>
  defaultStyleIds?: Array<GenerationId>
  modelPreferences?: Partial<Record<GenerationModality, string>>
  speechStyleId?: GenerationId
  metadata?: Record<string, unknown>
}

export type BriefCatalyst = {
  kind: 'memory' | 'topic' | 'trend' | 'event' | 'schedule' | 'episode' | 'manual_prompt'
  description: string
  occurredAt?: string
  sourceUrl?: string
  metadata?: Record<string, unknown>
}

export type Brief = {
  id?: GenerationId
  title?: string
  prompt: string
  catalyst?: BriefCatalyst
  audience?: string
  safety?: {
    rating?: 'general' | 'child_safe' | 'teen' | 'adult'
    constraints?: Array<string>
  }
  variables?: GenerationVariables
  metadata?: Record<string, unknown>
}

export type Project = {
  id: GenerationId
  kind: 'blog' | 'social_account' | 'story_series' | 'commerce_collection' | 'workspace' | 'other'
  name: string
  description?: string
  metadata?: Record<string, unknown>
}

export type TextOutputSpec = {
  format: 'markdown' | 'plain_text' | 'json'
  wordTarget?: number
  schemaHint?: string
}

export type ImageOutputSpec = {
  count: number
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9'
  noText?: boolean
}

export type AudioOutputSpec = {
  narration?: boolean
  format?: 'mp3' | 'wav' | 'aac'
}

export type OutputSpec = {
  id?: GenerationId
  kind: GenerationOutputKind
  text?: TextOutputSpec
  image?: ImageOutputSpec
  audio?: AudioOutputSpec
  metadata?: Record<string, unknown>
}

export type ModelSpec = {
  provider: ProviderName
  model: string
  parameters?: Record<string, unknown>
}

export type GenerationRequest = {
  id?: GenerationId
  project?: Project
  brief: Brief
  entities: Array<Entity>
  persona?: Persona
  styles?: Array<Style>
  output: OutputSpec
  variables?: GenerationVariables
  constraints?: Array<string>
}

export type GenerationPrompts = {
  system: string
  user: string
  metadata?: string
  image?: Array<string>
  audio?: string
}

export type GenerationPlan = {
  request: GenerationRequest
  prompts: GenerationPrompts
  models: Partial<Record<GenerationModality, ModelSpec>>
  createdAt?: string
}

export type TextArtifact = {
  kind: 'text'
  title?: string
  body: string
  excerpt?: string
  tags?: Array<string>
  metadata?: Record<string, unknown>
}

export type ImageArtifact = {
  kind: 'image'
  prompt: string
  asset?: ReferenceAsset
  metadata?: Record<string, unknown>
}

export type AudioArtifact = {
  kind: 'audio'
  transcript?: string
  asset?: ReferenceAsset
  metadata?: Record<string, unknown>
}

export type Artifact = TextArtifact | ImageArtifact | AudioArtifact

export type ProviderUsage = {
  inputTokens?: number
  outputTokens?: number
  imageCount?: number
  audioCharacters?: number
}

export type ProviderResult<TArtifact extends Artifact = Artifact> = {
  artifact: TArtifact
  usage?: ProviderUsage
  providerRequestId?: string
  metadata?: Record<string, unknown>
}
