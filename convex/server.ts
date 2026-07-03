import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { generationStatus } from './schema'

// These functions are the trusted server-to-server surface called by the
// TanStack Start Node server (via ConvexHttpClient). They are public functions
// but gated by a shared secret (FORGE_SERVER_SECRET) set on both the Convex
// deployment and the Node container. They must never be called from browsers.
export function assertServer(secret: string): void {
  const expected = process.env.FORGE_SERVER_SECRET
  if (!expected) throw new Error('FORGE_SERVER_SECRET is not configured')
  if (secret !== expected) throw new Error('Unauthorized')
}

export const verifyApiKey = mutation({
  args: { serverSecret: v.string(), prefix: v.string(), hash: v.string() },
  returns: v.union(
    v.object({
      apiKeyId: v.id('apiKeys'),
      ownerId: v.id('users'),
      scopes: v.array(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    const key = await ctx.db
      .query('apiKeys')
      .withIndex('by_prefix', (q) => q.eq('prefix', args.prefix))
      .unique()
    if (!key || key.revoked || key.hash !== args.hash) return null
    await ctx.db.patch(key._id, { lastUsedAt: Date.now() })
    return { apiKeyId: key._id, ownerId: key.ownerId, scopes: key.scopes }
  },
})

export const recordGenerationStart = mutation({
  args: {
    serverSecret: v.string(),
    ownerId: v.id('users'),
    apiKeyId: v.optional(v.id('apiKeys')),
    projectId: v.optional(v.id('projects')),
    taskId: v.optional(v.id('tasks')),
    stage: v.optional(v.string()),
    source: v.union(v.literal('api'), v.literal('playground')),
    provider: v.string(),
    model: v.string(),
  },
  returns: v.id('generations'),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    return await ctx.db.insert('generations', {
      ownerId: args.ownerId,
      apiKeyId: args.apiKeyId,
      projectId: args.projectId,
      taskId: args.taskId,
      stage: args.stage,
      source: args.source,
      provider: args.provider,
      model: args.model,
      status: 'streaming',
      createdAt: Date.now(),
    })
  },
})

export const recordGenerationFinish = mutation({
  args: {
    serverSecret: v.string(),
    generationId: v.id('generations'),
    status: generationStatus,
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    finishReason: v.optional(v.string()),
    result: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    await ctx.db.patch(args.generationId, {
      status: args.status,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      finishReason: args.finishReason,
      result: args.result,
      errorMessage: args.errorMessage,
    })
    return null
  },
})
