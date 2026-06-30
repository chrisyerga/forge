import { v } from 'convex/values'
import { authedQuery, authedMutation } from './lib/auth'
import { styleKind } from './schema'
import { styleDoc } from './lib/validators'

export const list = authedQuery({
  args: {},
  returns: v.array(styleDoc),
  handler: async (ctx) => {
    return await ctx.db
      .query('styles')
      .withIndex('by_owner', (q) => q.eq('ownerId', ctx.user._id))
      .order('desc')
      .collect()
  },
})

export const create = authedMutation({
  args: {
    name: v.string(),
    kind: styleKind,
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    promptFragment: v.optional(v.string()),
  },
  returns: v.id('styles'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('styles', { ownerId: ctx.user._id, ...args })
  },
})

export const update = authedMutation({
  args: {
    styleId: v.id('styles'),
    name: v.optional(v.string()),
    kind: v.optional(styleKind),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    promptFragment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const style = await ctx.db.get(args.styleId)
    if (!style || style.ownerId !== ctx.user._id) {
      throw new Error('Style not found')
    }
    const { styleId, ...patch } = args
    await ctx.db.patch(styleId, patch)
    return null
  },
})

export const remove = authedMutation({
  args: { styleId: v.id('styles') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const style = await ctx.db.get(args.styleId)
    if (!style || style.ownerId !== ctx.user._id) {
      throw new Error('Style not found')
    }
    await ctx.db.delete(args.styleId)
    return null
  },
})
