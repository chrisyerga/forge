import { v } from 'convex/values'
import { authedQuery, authedMutation } from './lib/auth'
import { entityKind, referenceAsset } from './schema'
import { entityDoc } from './lib/validators'

export const list = authedQuery({
  args: { projectId: v.optional(v.id('projects')) },
  returns: v.array(entityDoc),
  handler: async (ctx, args) => {
    if (args.projectId !== undefined) {
      const projectId = args.projectId
      const project = await ctx.db.get(projectId)
      if (!project || project.ownerId !== ctx.user._id) return []
      return await ctx.db
        .query('entities')
        .withIndex('by_project', (q) => q.eq('projectId', projectId))
        .order('desc')
        .collect()
    }
    return await ctx.db
      .query('entities')
      .withIndex('by_owner', (q) => q.eq('ownerId', ctx.user._id))
      .order('desc')
      .collect()
  },
})

export const get = authedQuery({
  args: { entityId: v.id('entities') },
  returns: v.union(entityDoc, v.null()),
  handler: async (ctx, args) => {
    const entity = await ctx.db.get(args.entityId)
    if (!entity || entity.ownerId !== ctx.user._id) return null
    return entity
  },
})

export const create = authedMutation({
  args: {
    name: v.string(),
    kind: entityKind,
    projectId: v.optional(v.id('projects')),
    aliases: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    visualDescription: v.optional(v.string()),
    relationship: v.optional(v.string()),
    traits: v.optional(v.array(v.string())),
    referenceAssets: v.optional(v.array(referenceAsset)),
  },
  returns: v.id('entities'),
  handler: async (ctx, args) => {
    if (args.projectId !== undefined) {
      const project = await ctx.db.get(args.projectId)
      if (!project || project.ownerId !== ctx.user._id) {
        throw new Error('Project not found')
      }
    }
    return await ctx.db.insert('entities', { ownerId: ctx.user._id, ...args })
  },
})

export const update = authedMutation({
  args: {
    entityId: v.id('entities'),
    name: v.optional(v.string()),
    kind: v.optional(entityKind),
    projectId: v.optional(v.id('projects')),
    aliases: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    visualDescription: v.optional(v.string()),
    relationship: v.optional(v.string()),
    traits: v.optional(v.array(v.string())),
    referenceAssets: v.optional(v.array(referenceAsset)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const entity = await ctx.db.get(args.entityId)
    if (!entity || entity.ownerId !== ctx.user._id) {
      throw new Error('Entity not found')
    }
    const { entityId, ...patch } = args
    await ctx.db.patch(entityId, patch)
    return null
  },
})

export const remove = authedMutation({
  args: { entityId: v.id('entities') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const entity = await ctx.db.get(args.entityId)
    if (!entity || entity.ownerId !== ctx.user._id) {
      throw new Error('Entity not found')
    }
    await ctx.db.delete(args.entityId)
    return null
  },
})
