import { customQuery, customMutation } from 'convex-helpers/server/customFunctions'
import { getAuthUserId } from '@convex-dev/auth/server'
import { query, mutation } from '../_generated/server'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'

export async function getCurrentUser(ctx: QueryCtx): Promise<Doc<'users'>> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) throw new Error('Not authenticated')
  const user = await ctx.db.get(userId)
  if (user === null) throw new Error('User not found')
  return user
}

// Authenticated wrappers: ctx.user is available and typed in every handler.
export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx)
    return { ctx: { user }, args: {} }
  },
})

export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx)
    return { ctx: { user }, args: {} }
  },
})
