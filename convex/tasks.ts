import { v } from 'convex/values'
import { authedQuery, authedMutation } from './lib/auth'
import { artifactDoc, taskDoc, taskStepDoc } from './lib/validators'

export const list = authedQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(taskDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tasks')
      .withIndex('by_owner', (q) => q.eq('ownerId', ctx.user._id))
      .order('desc')
      .take(Math.min(args.limit ?? 50, 200))
  },
})

export const get = authedQuery({
  args: { taskId: v.id('tasks') },
  returns: v.union(
    v.object({
      task: taskDoc,
      steps: v.array(taskStepDoc),
      artifacts: v.array(artifactDoc),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId)
    if (!task || task.ownerId !== ctx.user._id) return null
    const steps = await ctx.db
      .query('taskSteps')
      .withIndex('by_task', (q) => q.eq('taskId', task._id))
      .take(200)
    const artifacts = await ctx.db
      .query('artifacts')
      .withIndex('by_task', (q) => q.eq('taskId', task._id))
      .take(500)
    return { task, steps, artifacts }
  },
})

export const cancel = authedMutation({
  args: { taskId: v.id('tasks') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId)
    if (!task || task.ownerId !== ctx.user._id) throw new Error('Task not found')
    if (task.status === 'complete' || task.status === 'failed' || task.status === 'canceled') {
      return null
    }
    await ctx.db.patch(args.taskId, {
      status: 'canceled',
      updatedAt: Date.now(),
      finishedAt: Date.now(),
    })
    return null
  },
})
