import { createFileRoute } from '@tanstack/react-router'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { createConvexClient, getServerSecret } from '@/lib/convexServer'
import { resolveCaller } from '@/lib/routeAuth'
import { json } from '@/lib/http'

export const Route = createFileRoute('/v1/tasks/$taskId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const client = createConvexClient()
        const caller = await resolveCaller(client, request)
        if (!caller) return json({ error: 'Unauthorized' }, 401)

        let result
        try {
          result = await client.query(api.serverTasks.getTaskForCaller, {
            serverSecret: getServerSecret(),
            taskId: params.taskId as Id<'tasks'>,
            ownerId: caller.ownerId,
          })
        } catch {
          return json({ error: 'Task not found' }, 404)
        }
        if (!result) return json({ error: 'Task not found' }, 404)

        const { task, artifacts } = result
        const parsedArtifacts = artifacts.map((artifact) => ({
          kind: artifact.kind,
          stage: artifact.stage,
          iteration: artifact.iteration,
          content: JSON.parse(artifact.content) as unknown,
        }))
        const deliverable = parsedArtifacts.find((a) => a.kind === 'deliverable')?.content ?? null

        return json({
          taskId: task._id,
          status: task.status,
          recipe: task.recipe,
          currentStage: task.currentStage ?? null,
          iteration: task.iteration,
          maxIterations: task.maxIterations,
          pendingInput: task.pendingInput ?? null,
          errorMessage: task.errorMessage ?? null,
          createdAt: task.createdAt,
          finishedAt: task.finishedAt ?? null,
          deliverable: task.status === 'complete' ? deliverable : null,
          artifacts: parsedArtifacts,
        })
      },
    },
  },
})
