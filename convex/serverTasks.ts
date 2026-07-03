import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertServer } from './server'
import { inputRequest, stepStatus, taskStatus } from './schema'
import {
  artifactDoc,
  entityDoc,
  personaDoc,
  projectDoc,
  resourceDoc,
  styleDoc,
  taskDoc,
} from './lib/validators'

// Server-to-server surface for the task harness (TaskEngine on the Node app
// server). Same trust model as convex/server.ts: public functions gated by
// FORGE_SERVER_SECRET, never called from browsers.

export const createTask = mutation({
  args: {
    serverSecret: v.string(),
    ownerId: v.id('users'),
    apiKeyId: v.optional(v.id('apiKeys')),
    projectId: v.id('projects'),
    recipe: v.string(),
    recipeVersion: v.optional(v.number()),
    brief: v.any(),
    maxIterations: v.number(),
    callbackUrl: v.optional(v.string()),
  },
  returns: v.id('tasks'),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    const project = await ctx.db.get(args.projectId)
    if (!project || project.ownerId !== args.ownerId) {
      throw new Error('Project not found')
    }
    const now = Date.now()
    return await ctx.db.insert('tasks', {
      ownerId: args.ownerId,
      apiKeyId: args.apiKeyId,
      projectId: args.projectId,
      recipe: args.recipe,
      recipeVersion: args.recipeVersion,
      status: 'queued',
      brief: args.brief,
      iteration: 1,
      maxIterations: args.maxIterations,
      callbackUrl: args.callbackUrl,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Everything the engine needs to (re)start a run: the task plus resolved
// project context and the current artifacts.
export const loadTaskRun = query({
  args: { serverSecret: v.string(), taskId: v.id('tasks') },
  returns: v.union(
    v.object({
      task: taskDoc,
      project: projectDoc,
      persona: v.union(personaDoc, v.null()),
      styles: v.array(styleDoc),
      entities: v.array(entityDoc),
      resources: v.array(resourceDoc),
      artifacts: v.array(artifactDoc),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    const task = await ctx.db.get(args.taskId)
    if (!task) return null
    const project = await ctx.db.get(task.projectId)
    if (!project) return null

    const persona = project.defaultPersonaId ? await ctx.db.get(project.defaultPersonaId) : null
    const styles = []
    for (const styleId of project.defaultStyleIds ?? []) {
      const style = await ctx.db.get(styleId)
      if (style) styles.push(style)
    }
    const entities = await ctx.db
      .query('entities')
      .withIndex('by_project', (q) => q.eq('projectId', task.projectId))
      .take(100)
    const resources = await ctx.db
      .query('resources')
      .withIndex('by_project', (q) => q.eq('projectId', task.projectId))
      .take(100)
    const allArtifacts = await ctx.db
      .query('artifacts')
      .withIndex('by_task', (q) => q.eq('taskId', task._id))
      .take(500)
    return {
      task,
      project,
      persona,
      styles,
      entities,
      resources,
      artifacts: allArtifacts.filter((a) => a.current),
    }
  },
})

// Cheap status check between stages (cancellation, external input).
export const getTaskState = query({
  args: { serverSecret: v.string(), taskId: v.id('tasks') },
  returns: v.union(
    v.object({
      status: taskStatus,
      currentStage: v.optional(v.string()),
      iteration: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    const task = await ctx.db.get(args.taskId)
    if (!task) return null
    return { status: task.status, currentStage: task.currentStage, iteration: task.iteration }
  },
})

// Tasks the engine should pick up on boot / periodic sweep.
export const listResumableTasks = query({
  args: { serverSecret: v.string() },
  returns: v.array(v.id('tasks')),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    const queued = await ctx.db
      .query('tasks')
      .withIndex('by_status', (q) => q.eq('status', 'queued'))
      .take(100)
    const running = await ctx.db
      .query('tasks')
      .withIndex('by_status', (q) => q.eq('status', 'running'))
      .take(100)
    return [...queued, ...running].map((task) => task._id)
  },
})

export const markTaskRunning = mutation({
  args: {
    serverSecret: v.string(),
    taskId: v.id('tasks'),
    currentStage: v.string(),
    iteration: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    await ctx.db.patch(args.taskId, {
      status: 'running',
      currentStage: args.currentStage,
      iteration: args.iteration,
      pendingInput: undefined,
      errorMessage: undefined,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const markTaskNeedsInput = mutation({
  args: {
    serverSecret: v.string(),
    taskId: v.id('tasks'),
    questions: v.array(inputRequest),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    await ctx.db.patch(args.taskId, {
      status: 'needs_input',
      pendingInput: args.questions,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const markTaskFinished = mutation({
  args: {
    serverSecret: v.string(),
    taskId: v.id('tasks'),
    status: v.union(v.literal('complete'), v.literal('failed')),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    const now = Date.now()
    await ctx.db.patch(args.taskId, {
      status: args.status,
      errorMessage: args.errorMessage,
      updatedAt: now,
      finishedAt: now,
    })
    return null
  },
})

export const recordStepStart = mutation({
  args: {
    serverSecret: v.string(),
    taskId: v.id('tasks'),
    stage: v.string(),
    iteration: v.number(),
  },
  returns: v.id('taskSteps'),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    const task = await ctx.db.get(args.taskId)
    if (!task) throw new Error('Task not found')
    return await ctx.db.insert('taskSteps', {
      taskId: args.taskId,
      ownerId: task.ownerId,
      stage: args.stage,
      iteration: args.iteration,
      status: 'running',
      startedAt: Date.now(),
    })
  },
})

export const recordStepFinish = mutation({
  args: {
    serverSecret: v.string(),
    stepId: v.id('taskSteps'),
    status: stepStatus,
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    await ctx.db.patch(args.stepId, {
      status: args.status,
      finishedAt: Date.now(),
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      errorMessage: args.errorMessage,
    })
    return null
  },
})

// Insert a new current artifact, demoting any previous current artifact of the
// same kind for this task.
export const writeArtifact = mutation({
  args: {
    serverSecret: v.string(),
    taskId: v.id('tasks'),
    stage: v.string(),
    iteration: v.number(),
    kind: v.string(),
    content: v.string(),
  },
  returns: v.id('artifacts'),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    const task = await ctx.db.get(args.taskId)
    if (!task) throw new Error('Task not found')
    const previous = await ctx.db
      .query('artifacts')
      .withIndex('by_task_and_kind', (q) => q.eq('taskId', args.taskId).eq('kind', args.kind))
      .take(50)
    for (const artifact of previous) {
      if (artifact.current) await ctx.db.patch(artifact._id, { current: false })
    }
    return await ctx.db.insert('artifacts', {
      taskId: args.taskId,
      ownerId: task.ownerId,
      stage: args.stage,
      iteration: args.iteration,
      kind: args.kind,
      content: args.content,
      current: true,
    })
  },
})

// Advance the checkpoint pointer after a stage completes.
export const setTaskCheckpoint = mutation({
  args: {
    serverSecret: v.string(),
    taskId: v.id('tasks'),
    currentStage: v.optional(v.string()),
    iteration: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    await ctx.db.patch(args.taskId, {
      currentStage: args.currentStage,
      iteration: args.iteration,
      updatedAt: Date.now(),
    })
    return null
  },
})

// API-facing reads/writes, owner-scoped (the /v1 routes resolve the caller and
// pass the ownerId; the server secret gates the call itself).

export const getTaskForCaller = query({
  args: { serverSecret: v.string(), taskId: v.id('tasks'), ownerId: v.id('users') },
  returns: v.union(
    v.object({ task: taskDoc, artifacts: v.array(artifactDoc) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    const task = await ctx.db.get(args.taskId)
    if (!task || task.ownerId !== args.ownerId) return null
    const allArtifacts = await ctx.db
      .query('artifacts')
      .withIndex('by_task', (q) => q.eq('taskId', task._id))
      .take(500)
    return { task, artifacts: allArtifacts.filter((a) => a.current) }
  },
})

export const applyTaskInput = mutation({
  args: {
    serverSecret: v.string(),
    taskId: v.id('tasks'),
    ownerId: v.id('users'),
    answers: v.record(v.string(), v.string()),
  },
  returns: v.union(v.literal('resumed'), v.literal('not_found'), v.literal('not_waiting')),
  handler: async (ctx, args) => {
    assertServer(args.serverSecret)
    const task = await ctx.db.get(args.taskId)
    if (!task || task.ownerId !== args.ownerId) return 'not_found'
    if (task.status !== 'needs_input') return 'not_waiting'
    await ctx.db.patch(args.taskId, {
      status: 'queued',
      answers: { ...(task.answers ?? {}), ...args.answers },
      pendingInput: undefined,
      updatedAt: Date.now(),
    })
    return 'resumed'
  },
})
