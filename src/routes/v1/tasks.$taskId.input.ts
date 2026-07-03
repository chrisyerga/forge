import { createFileRoute } from '@tanstack/react-router'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { getTaskEngine } from '@/harness/engine'
import { createConvexClient, getServerSecret } from '@/lib/convexServer'
import { resolveCaller } from '@/lib/routeAuth'
import { json } from '@/lib/http'

type InputBody = {
  answers?: Record<string, string>
}

export const Route = createFileRoute('/v1/tasks/$taskId/input')({
  server: {
    handlers: {
      // Answer a needs_input pause; the task resumes at the stage that asked.
      POST: async ({ request, params }) => {
        const client = createConvexClient()
        const caller = await resolveCaller(client, request)
        if (!caller) return json({ error: 'Unauthorized' }, 401)

        const body = (await request.json()) as InputBody
        const answers = body.answers
        if (
          !answers ||
          typeof answers !== 'object' ||
          Object.values(answers).some((value) => typeof value !== 'string')
        ) {
          return json({ error: 'answers must be a record of string values' }, 400)
        }

        const taskId = params.taskId as Id<'tasks'>
        let outcome
        try {
          outcome = await client.mutation(api.serverTasks.applyTaskInput, {
            serverSecret: getServerSecret(),
            taskId,
            ownerId: caller.ownerId,
            answers,
          })
        } catch {
          return json({ error: 'Task not found' }, 404)
        }

        if (outcome === 'not_found') return json({ error: 'Task not found' }, 404)
        if (outcome === 'not_waiting') {
          return json({ error: 'Task is not waiting for input' }, 409)
        }

        getTaskEngine().enqueue(taskId)
        return json({ taskId, status: 'queued' })
      },
    },
  },
})
