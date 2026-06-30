import { v } from 'convex/values'
import { authedQuery } from './lib/auth'

export const me = authedQuery({
  args: {},
  returns: v.object({
    _id: v.id('users'),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  }),
  handler: async (ctx) => ({
    _id: ctx.user._id,
    email: ctx.user.email,
    name: ctx.user.name,
  }),
})
