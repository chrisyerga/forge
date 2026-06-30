import { v } from 'convex/values'
import { authedQuery } from './lib/auth'
import { generationDoc } from './lib/validators'

export const list = authedQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(generationDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('generations')
      .withIndex('by_owner', (q) => q.eq('ownerId', ctx.user._id))
      .order('desc')
      .take(Math.min(args.limit ?? 50, 200))
  },
})
