import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

// Validators mirroring the pure core types in src/core/types.ts. Kept in sync
// by hand; metadata fields are open escape hatches (v.any()).

export const entityKind = v.union(
  v.literal('person'),
  v.literal('animal'),
  v.literal('pet'),
  v.literal('fictional_character'),
  v.literal('brand'),
  v.literal('place'),
  v.literal('object'),
  v.literal('other'),
)

export const personaKind = v.union(
  v.literal('explicit_creator'),
  v.literal('implicit_voice'),
  v.literal('narrator'),
  v.literal('character_voice'),
)

export const styleKind = v.union(
  v.literal('text'),
  v.literal('image'),
  v.literal('audio'),
  v.literal('multimodal'),
)

export const projectKind = v.union(
  v.literal('blog'),
  v.literal('social_account'),
  v.literal('story_series'),
  v.literal('commerce_collection'),
  v.literal('workspace'),
  v.literal('other'),
)

export const referenceAsset = v.object({
  id: v.string(),
  uri: v.optional(v.string()),
  mediaType: v.optional(v.string()),
  description: v.optional(v.string()),
  role: v.optional(
    v.union(
      v.literal('avatar'),
      v.literal('reference'),
      v.literal('source'),
      v.literal('output'),
    ),
  ),
})

export const generationStatus = v.union(
  v.literal('streaming'),
  v.literal('complete'),
  v.literal('error'),
)

export const taskStatus = v.union(
  v.literal('queued'),
  v.literal('running'),
  v.literal('needs_input'),
  v.literal('complete'),
  v.literal('failed'),
  v.literal('canceled'),
)

export const stepStatus = v.union(
  v.literal('running'),
  v.literal('complete'),
  v.literal('error'),
  v.literal('needs_input'),
)

export const resourceKind = v.union(
  v.literal('product'),
  v.literal('article'),
  v.literal('page'),
  v.literal('offer'),
  v.literal('other'),
)

export const inputRequest = v.object({
  key: v.string(),
  question: v.string(),
  why: v.optional(v.string()),
})

export default defineSchema({
  ...authTables,

  projects: defineTable({
    ownerId: v.id('users'),
    kind: projectKind,
    name: v.string(),
    description: v.optional(v.string()),
    // Defaults resolved into every task run for this project.
    defaultPersonaId: v.optional(v.id('personas')),
    defaultStyleIds: v.optional(v.array(v.id('styles'))),
    guidelines: v.optional(v.string()),
    metadata: v.optional(v.any()),
  }).index('by_owner', ['ownerId']),

  entities: defineTable({
    ownerId: v.id('users'),
    projectId: v.optional(v.id('projects')),
    kind: entityKind,
    name: v.string(),
    aliases: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    visualDescription: v.optional(v.string()),
    relationship: v.optional(v.string()),
    traits: v.optional(v.array(v.string())),
    referenceAssets: v.optional(v.array(referenceAsset)),
    metadata: v.optional(v.any()),
  })
    .index('by_owner', ['ownerId'])
    .index('by_project', ['projectId']),

  personas: defineTable({
    ownerId: v.id('users'),
    slug: v.optional(v.string()),
    name: v.string(),
    kind: personaKind,
    artificial: v.optional(v.boolean()),
    tagline: v.optional(v.string()),
    description: v.optional(v.string()),
    pointOfView: v.optional(v.string()),
    promptFragments: v.optional(v.array(v.string())),
    defaultStyleIds: v.optional(v.array(v.id('styles'))),
    metadata: v.optional(v.any()),
  }).index('by_owner', ['ownerId']),

  styles: defineTable({
    ownerId: v.id('users'),
    slug: v.optional(v.string()),
    name: v.string(),
    kind: styleKind,
    description: v.optional(v.string()),
    promptFragment: v.optional(v.string()),
    metadata: v.optional(v.any()),
  }).index('by_owner', ['ownerId']),

  apiKeys: defineTable({
    ownerId: v.id('users'),
    label: v.string(),
    // sha-256 hash of the full secret; the plaintext is shown once at creation.
    hash: v.string(),
    // short non-secret prefix used for display + fast lookup.
    prefix: v.string(),
    scopes: v.array(v.string()),
    lastUsedAt: v.optional(v.number()),
    revoked: v.boolean(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_prefix', ['prefix']),

  generations: defineTable({
    ownerId: v.id('users'),
    apiKeyId: v.optional(v.id('apiKeys')),
    projectId: v.optional(v.id('projects')),
    // Set when the generation happened inside a task run.
    taskId: v.optional(v.id('tasks')),
    stage: v.optional(v.string()),
    source: v.union(v.literal('api'), v.literal('playground')),
    provider: v.string(),
    model: v.string(),
    status: generationStatus,
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    finishReason: v.optional(v.string()),
    result: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_apiKey', ['apiKeyId'])
    .index('by_task', ['taskId']),

  // Promotable project assets (products, partner links, existing content) the
  // strategy stage may choose to work into generated content.
  resources: defineTable({
    ownerId: v.id('users'),
    projectId: v.id('projects'),
    kind: resourceKind,
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index('by_owner', ['ownerId'])
    .index('by_project', ['projectId']),

  // A durable harness run: the API-facing unit of work.
  tasks: defineTable({
    ownerId: v.id('users'),
    apiKeyId: v.optional(v.id('apiKeys')),
    projectId: v.id('projects'),
    recipe: v.string(),
    recipeVersion: v.optional(v.number()),
    status: taskStatus,
    // Recipe-specific brief; validated against the recipe's schema at the API layer.
    brief: v.any(),
    // Accumulated answers to needs_input questions, keyed by question key.
    answers: v.optional(v.record(v.string(), v.string())),
    // Next stage to run (checkpoint pointer). Unset = first stage.
    currentStage: v.optional(v.string()),
    iteration: v.number(),
    maxIterations: v.number(),
    pendingInput: v.optional(v.array(inputRequest)),
    callbackUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index('by_owner', ['ownerId'])
    .index('by_project', ['projectId'])
    .index('by_status', ['status']),

  // Audit/checkpoint log: one row per stage execution per iteration.
  taskSteps: defineTable({
    taskId: v.id('tasks'),
    ownerId: v.id('users'),
    stage: v.string(),
    iteration: v.number(),
    status: stepStatus,
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  }).index('by_task', ['taskId']),

  // Typed stage outputs. `content` is a JSON string; `current` marks the
  // latest artifact of each kind for the task.
  artifacts: defineTable({
    taskId: v.id('tasks'),
    ownerId: v.id('users'),
    stage: v.string(),
    iteration: v.number(),
    kind: v.string(),
    content: v.string(),
    storageId: v.optional(v.id('_storage')),
    current: v.boolean(),
  })
    .index('by_task', ['taskId'])
    .index('by_task_and_kind', ['taskId', 'kind']),
})
