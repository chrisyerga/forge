import { v } from 'convex/values'
import { authedQuery, authedMutation } from './lib/auth'
import { resourceKind } from './schema'
import { resourceDoc } from './lib/validators'

export const listByProject = authedQuery({
  args: { projectId: v.id('projects') },
  returns: v.array(resourceDoc),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerId !== ctx.user._id) return []
    return await ctx.db
      .query('resources')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .take(200)
  },
})

export const create = authedMutation({
  args: {
    projectId: v.id('projects'),
    kind: resourceKind,
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
  },
  returns: v.id('resources'),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerId !== ctx.user._id) throw new Error('Project not found')
    return await ctx.db.insert('resources', { ownerId: ctx.user._id, ...args })
  },
})

export const update = authedMutation({
  args: {
    resourceId: v.id('resources'),
    kind: v.optional(resourceKind),
    title: v.optional(v.string()),
    url: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId)
    if (!resource || resource.ownerId !== ctx.user._id) throw new Error('Resource not found')
    const { resourceId, ...patch } = args
    await ctx.db.patch(resourceId, patch)
    return null
  },
})

export const remove = authedMutation({
  args: { resourceId: v.id('resources') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId)
    if (!resource || resource.ownerId !== ctx.user._id) throw new Error('Resource not found')
    await ctx.db.delete(args.resourceId)
    return null
  },
})
