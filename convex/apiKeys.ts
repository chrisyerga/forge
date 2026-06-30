import { v } from 'convex/values'
import { authedQuery, authedMutation } from './lib/auth'
import { apiKeyPublic } from './lib/validators'
import { sha256Hex, randomHex } from './lib/crypto'

export const list = authedQuery({
  args: {},
  returns: v.array(apiKeyPublic),
  handler: async (ctx) => {
    const keys = await ctx.db
      .query('apiKeys')
      .withIndex('by_owner', (q) => q.eq('ownerId', ctx.user._id))
      .order('desc')
      .collect()
    return keys.map((k) => ({
      _id: k._id,
      _creationTime: k._creationTime,
      ownerId: k.ownerId,
      label: k.label,
      prefix: k.prefix,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt,
      revoked: k.revoked,
    }))
  },
})

// Creates a key and returns the plaintext exactly once. Only the hash is stored.
export const create = authedMutation({
  args: {
    label: v.string(),
    scopes: v.optional(v.array(v.string())),
  },
  returns: v.object({ key: v.string(), prefix: v.string() }),
  handler: async (ctx, args) => {
    const prefix = randomHex(6)
    const secret = randomHex(24)
    const fullKey = `forge_${prefix}_${secret}`
    const hash = await sha256Hex(fullKey)
    await ctx.db.insert('apiKeys', {
      ownerId: ctx.user._id,
      label: args.label,
      hash,
      prefix,
      scopes: args.scopes ?? ['generate'],
      revoked: false,
    })
    return { key: fullKey, prefix }
  },
})

export const revoke = authedMutation({
  args: { apiKeyId: v.id('apiKeys') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.apiKeyId)
    if (!key || key.ownerId !== ctx.user._id) {
      throw new Error('API key not found')
    }
    await ctx.db.patch(args.apiKeyId, { revoked: true })
    return null
  },
})
