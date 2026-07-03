import type { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import { ARTIFACT_KINDS } from '@/core/tasks'
import type { Evaluation, RevisionNotes, TaskContext } from '@/core/tasks'
import type { Entity, Persona, Style } from '@/core/types'
import { createConvexClient, getServerSecret } from '@/lib/convexServer'
import { createStageCapabilities } from './capabilities'
import type { SearchProvider } from './capabilities'
import { createSearchProviderFromEnv } from './search/tavily'
import { createArtifactStore } from './recipe'
import type { Recipe } from './recipe'
import { getRecipe } from './recipes'

const SWEEP_INTERVAL_MS = 60_000

type TaskRun = NonNullable<(typeof api.serverTasks.loadTaskRun)['_returnType']>

// The harness loop. Runs on the app server (flat compute; LLM wait time is
// free), checkpointing every stage to Convex so a crash/deploy loses at most
// one stage of work. `resumeSweep` re-queues queued/running tasks on boot and
// periodically thereafter.
export class TaskEngine {
  private active = new Set<string>()
  private search: SearchProvider

  constructor(search?: SearchProvider) {
    this.search = search ?? createSearchProviderFromEnv()
  }

  enqueue(taskId: Id<'tasks'>): void {
    if (this.active.has(taskId)) return
    this.active.add(taskId)
    void this.run(taskId)
      .catch((error) => {
        console.error(`[harness] task ${taskId} crashed:`, error)
      })
      .finally(() => {
        this.active.delete(taskId)
      })
  }

  async sweep(): Promise<void> {
    const client = createConvexClient()
    const taskIds = await client.query(api.serverTasks.listResumableTasks, {
      serverSecret: getServerSecret(),
    })
    for (const taskId of taskIds) this.enqueue(taskId)
  }

  private async run(taskId: Id<'tasks'>): Promise<void> {
    const client = createConvexClient()
    const secret = getServerSecret()

    const run = await client.query(api.serverTasks.loadTaskRun, { serverSecret: secret, taskId })
    if (!run) return
    const { task } = run
    if (task.status !== 'queued' && task.status !== 'running') return

    const recipe = getRecipe(task.recipe)
    if (!recipe) {
      await this.finish(client, run, 'failed', `Unknown recipe: ${task.recipe}`)
      return
    }

    // Rehydrate current artifacts (kind -> parsed content).
    const artifactMap = new Map<string, unknown>()
    for (const artifact of run.artifacts) {
      artifactMap.set(artifact.kind, JSON.parse(artifact.content))
    }

    let iteration = task.iteration
    const ctx = buildTaskContext(run)
    if (iteration > 1) {
      ctx.revisionNotes = artifactMap.get(ARTIFACT_KINDS.revisionNotes) as RevisionNotes | undefined
    }

    // Resume from the checkpoint pointer; default to the first stage.
    let stageIndex = task.currentStage
      ? recipe.stages.findIndex((stage) => stage.id === task.currentStage)
      : 0
    if (stageIndex < 0) {
      await this.finish(client, run, 'failed', `Unknown stage checkpoint: ${task.currentStage}`)
      return
    }

    try {
      while (true) {
        while (stageIndex < recipe.stages.length) {
          const stage = recipe.stages[stageIndex]!

          // External state may have changed between stages (cancellation).
          const state = await client.query(api.serverTasks.getTaskState, {
            serverSecret: secret,
            taskId,
          })
          if (!state || state.status === 'canceled') return

          await client.mutation(api.serverTasks.markTaskRunning, {
            serverSecret: secret,
            taskId,
            currentStage: stage.id,
            iteration,
          })
          ctx.iteration = iteration

          const stepId = await client.mutation(api.serverTasks.recordStepStart, {
            serverSecret: secret,
            taskId,
            stage: stage.id,
            iteration,
          })
          const capabilities = createStageCapabilities({
            client,
            search: this.search,
            attribution: {
              ownerId: task.ownerId,
              apiKeyId: task.apiKeyId,
              projectId: task.projectId,
              taskId,
              stage: stage.id,
              source: task.apiKeyId ? 'api' : 'playground',
            },
          })

          let result
          try {
            result = await stage.run({
              ctx,
              artifacts: createArtifactStore(artifactMap),
              capabilities,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            await client.mutation(api.serverTasks.recordStepFinish, {
              serverSecret: secret,
              stepId,
              status: 'error',
              ...capabilities.usage(),
              errorMessage: message,
            })
            await this.finish(client, run, 'failed', `Stage ${stage.id} failed: ${message}`)
            return
          }

          if (result.type === 'needs_input') {
            await client.mutation(api.serverTasks.recordStepFinish, {
              serverSecret: secret,
              stepId,
              status: 'needs_input',
              ...capabilities.usage(),
            })
            await client.mutation(api.serverTasks.markTaskNeedsInput, {
              serverSecret: secret,
              taskId,
              questions: result.questions,
            })
            return
          }

          for (const artifact of result.artifacts) {
            await client.mutation(api.serverTasks.writeArtifact, {
              serverSecret: secret,
              taskId,
              stage: stage.id,
              iteration,
              kind: artifact.kind,
              content: JSON.stringify(artifact.content),
            })
            artifactMap.set(artifact.kind, artifact.content)
          }
          await client.mutation(api.serverTasks.recordStepFinish, {
            serverSecret: secret,
            stepId,
            status: 'complete',
            ...capabilities.usage(),
          })

          stageIndex += 1
          await client.mutation(api.serverTasks.setTaskCheckpoint, {
            serverSecret: secret,
            taskId,
            currentStage: recipe.stages[stageIndex]?.id,
            iteration,
          })
        }

        // Pipeline finished: apply the revision policy.
        const evaluation = artifactMap.get(ARTIFACT_KINDS.evaluation) as Evaluation | undefined
        if (evaluation?.verdict === 'revise' && iteration < task.maxIterations && recipe.revise) {
          const notes = await this.runRevision(client, run, recipe, iteration, evaluation, artifactMap, ctx)
          if (!notes) return

          iteration += 1
          ctx.iteration = iteration
          ctx.revisionNotes = notes
          const reentryIndex = recipe.stages.findIndex((stage) => stage.id === notes.reentryStage)
          stageIndex = reentryIndex >= 0 ? reentryIndex : 0
          await client.mutation(api.serverTasks.setTaskCheckpoint, {
            serverSecret: secret,
            taskId,
            currentStage: recipe.stages[stageIndex]!.id,
            iteration,
          })
          continue
        }

        await this.finish(client, run, 'complete', undefined, artifactMap)
        return
      }
    } catch (error) {
      // Convex round-trip or other infrastructure failure: leave the task in
      // its checkpointed state; the sweep will retry it.
      console.error(`[harness] task ${taskId} interrupted:`, error)
    }
  }

  /** Runs the recipe's revise policy, recorded as a 'revise' step. */
  private async runRevision(
    client: ConvexHttpClient,
    run: TaskRun,
    recipe: Recipe,
    iteration: number,
    evaluation: Evaluation,
    artifactMap: Map<string, unknown>,
    ctx: TaskContext,
  ): Promise<RevisionNotes | null> {
    const secret = getServerSecret()
    const taskId = run.task._id
    const stepId = await client.mutation(api.serverTasks.recordStepStart, {
      serverSecret: secret,
      taskId,
      stage: 'revise',
      iteration,
    })
    const capabilities = createStageCapabilities({
      client,
      search: this.search,
      attribution: {
        ownerId: run.task.ownerId,
        apiKeyId: run.task.apiKeyId,
        projectId: run.task.projectId,
        taskId,
        stage: 'revise',
        source: run.task.apiKeyId ? 'api' : 'playground',
      },
    })
    try {
      const notes = await recipe.revise!({
        ctx,
        artifacts: createArtifactStore(artifactMap),
        capabilities,
        evaluation,
      })
      await client.mutation(api.serverTasks.writeArtifact, {
        serverSecret: secret,
        taskId,
        stage: 'revise',
        iteration,
        kind: ARTIFACT_KINDS.revisionNotes,
        content: JSON.stringify(notes),
      })
      artifactMap.set(ARTIFACT_KINDS.revisionNotes, notes)
      await client.mutation(api.serverTasks.recordStepFinish, {
        serverSecret: secret,
        stepId,
        status: 'complete',
        ...capabilities.usage(),
      })
      return notes
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await client.mutation(api.serverTasks.recordStepFinish, {
        serverSecret: secret,
        stepId,
        status: 'error',
        ...capabilities.usage(),
        errorMessage: message,
      })
      await this.finish(client, run, 'failed', `Revision failed: ${message}`)
      return null
    }
  }

  private async finish(
    client: ConvexHttpClient,
    run: TaskRun,
    status: 'complete' | 'failed',
    errorMessage?: string,
    artifactMap?: Map<string, unknown>,
  ): Promise<void> {
    await client.mutation(api.serverTasks.markTaskFinished, {
      serverSecret: getServerSecret(),
      taskId: run.task._id,
      status,
      errorMessage,
    })
    if (run.task.callbackUrl) {
      await sendWebhook(run.task.callbackUrl, {
        taskId: run.task._id,
        status,
        errorMessage,
        deliverable: artifactMap?.get(ARTIFACT_KINDS.deliverable),
      })
    }
  }
}

function buildTaskContext(run: TaskRun): TaskContext {
  const { task, project } = run
  return {
    taskId: task._id,
    recipe: task.recipe,
    iteration: task.iteration,
    maxIterations: task.maxIterations,
    brief: (task.brief ?? {}) as Record<string, unknown>,
    answers: task.answers ?? {},
    project: {
      id: project._id,
      kind: project.kind,
      name: project.name,
      description: project.description,
      metadata: project.metadata,
    },
    persona: run.persona ? toPersona(run.persona) : undefined,
    styles: run.styles.map(toStyle),
    entities: run.entities.map(toEntity),
    resources: run.resources.map((resource) => ({
      id: resource._id,
      kind: resource.kind,
      title: resource.title,
      url: resource.url,
      description: resource.description,
      tags: resource.tags,
      priority: resource.priority,
      metadata: resource.metadata,
    })),
    guidelines: project.guidelines,
  }
}

function toPersona(doc: Doc<'personas'>): Persona {
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    kind: doc.kind,
    artificial: doc.artificial,
    tagline: doc.tagline,
    description: doc.description,
    pointOfView: doc.pointOfView,
    promptFragments: doc.promptFragments,
    metadata: doc.metadata,
  }
}

function toStyle(doc: Doc<'styles'>): Style {
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    kind: doc.kind,
    description: doc.description,
    promptFragment: doc.promptFragment,
    metadata: doc.metadata,
  }
}

function toEntity(doc: Doc<'entities'>): Entity {
  return {
    id: doc._id,
    kind: doc.kind,
    name: doc.name,
    aliases: doc.aliases,
    description: doc.description,
    visualDescription: doc.visualDescription,
    relationship: doc.relationship,
    traits: doc.traits,
    referenceAssets: doc.referenceAssets,
    metadata: doc.metadata,
  }
}

async function sendWebhook(url: string, payload: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    console.error(`[harness] webhook to ${url} failed:`, error)
  }
}

// Singleton engine + resume sweep. Stored on globalThis so dev-server HMR
// doesn't spawn duplicate engines/timers. The sweep doubles as resume-on-boot:
// it runs on first import (i.e. the first request that touches /v1/tasks) and
// every minute after, picking up tasks stranded by a restart.
type EngineGlobal = { engine: TaskEngine; timer: ReturnType<typeof setInterval> }

declare global {
  var __forgeTaskEngine: EngineGlobal | undefined
}

export function getTaskEngine(): TaskEngine {
  if (!globalThis.__forgeTaskEngine) {
    const engine = new TaskEngine()
    const runSweep = () => {
      engine.sweep().catch((error) => console.error('[harness] sweep failed:', error))
    }
    const timer = setInterval(runSweep, SWEEP_INTERVAL_MS)
    timer.unref?.()
    globalThis.__forgeTaskEngine = { engine, timer }
    runSweep()
  }
  return globalThis.__forgeTaskEngine.engine
}
