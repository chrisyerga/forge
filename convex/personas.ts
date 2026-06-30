import { v } from 'convex/values'
import { authedQuery, authedMutation } from './lib/auth'
import { personaKind } from './schema'
import { personaDoc } from './lib/validators'

export const list = authedQuery({
  args: {},
  returns: v.array(personaDoc),
  handler: async (ctx) => {
    return await ctx.db
      .query('personas')
      .withIndex('by_owner', (q) => q.eq('ownerId', ctx.user._id))
      .order('desc')
      .collect()
  },
})

export const create = authedMutation({
  args: {
    name: v.string(),
    kind: personaKind,
    slug: v.optional(v.string()),
    artificial: v.optional(v.boolean()),
    tagline: v.optional(v.string()),
    description: v.optional(v.string()),
    pointOfView: v.optional(v.string()),
    promptFragments: v.optional(v.array(v.string())),
  },
  returns: v.id('personas'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('personas', { ownerId: ctx.user._id, ...args })
  },
})

export const update = authedMutation({
  args: {
    personaId: v.id('personas'),
    name: v.optional(v.string()),
    kind: v.optional(personaKind),
    slug: v.optional(v.string()),
    artificial: v.optional(v.boolean()),
    tagline: v.optional(v.string()),
    description: v.optional(v.string()),
    pointOfView: v.optional(v.string()),
    promptFragments: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const persona = await ctx.db.get(args.personaId)
    if (!persona || persona.ownerId !== ctx.user._id) {
      throw new Error('Persona not found')
    }
    const { personaId, ...patch } = args
    await ctx.db.patch(personaId, patch)
    return null
  },
})

export const remove = authedMutation({
  args: { personaId: v.id('personas') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const persona = await ctx.db.get(args.personaId)
    if (!persona || persona.ownerId !== ctx.user._id) {
      throw new Error('Persona not found')
    }
    await ctx.db.delete(args.personaId)
    return null
  },
})
