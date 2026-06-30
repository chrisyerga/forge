import { v } from 'convex/values'
import { authedQuery, authedMutation } from './lib/auth'
import { projectKind } from './schema'
import { projectDoc } from './lib/validators'

export const list = authedQuery({
  args: {},
  returns: v.array(projectDoc),
  handler: async (ctx) => {
    return await ctx.db
      .query('projects')
      .withIndex('by_owner', (q) => q.eq('ownerId', ctx.user._id))
      .order('desc')
      .collect()
  },
})

export const get = authedQuery({
  args: { projectId: v.id('projects') },
  returns: v.union(projectDoc, v.null()),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerId !== ctx.user._id) return null
    return project
  },
})

export const create = authedMutation({
  args: {
    name: v.string(),
    kind: projectKind,
    description: v.optional(v.string()),
  },
  returns: v.id('projects'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('projects', {
      ownerId: ctx.user._id,
      name: args.name,
      kind: args.kind,
      description: args.description,
    })
  },
})

export const update = authedMutation({
  args: {
    projectId: v.id('projects'),
    name: v.optional(v.string()),
    kind: v.optional(projectKind),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerId !== ctx.user._id) {
      throw new Error('Project not found')
    }
    const { projectId, ...patch } = args
    await ctx.db.patch(projectId, patch)
    return null
  },
})

export const remove = authedMutation({
  args: { projectId: v.id('projects') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerId !== ctx.user._id) {
      throw new Error('Project not found')
    }
    await ctx.db.delete(args.projectId)
    return null
  },
})
