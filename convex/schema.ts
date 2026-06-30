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

export default defineSchema({
  ...authTables,

  projects: defineTable({
    ownerId: v.id('users'),
    kind: projectKind,
    name: v.string(),
    description: v.optional(v.string()),
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
    .index('by_apiKey', ['apiKeyId']),
})
