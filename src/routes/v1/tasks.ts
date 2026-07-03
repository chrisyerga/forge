import { createFileRoute } from '@tanstack/react-router'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { getTaskEngine } from '@/harness/engine'
import { getRecipe } from '@/harness/recipes'
import { createConvexClient, getServerSecret } from '@/lib/convexServer'
import { resolveCaller } from '@/lib/routeAuth'
import { json } from '@/lib/http'

type CreateTaskBody = {
  projectId?: string
  recipe?: string
  brief?: unknown
  maxIterations?: number
  callbackUrl?: string
}

export const Route = createFileRoute('/v1/tasks')({
  server: {
    handlers: {
      // Async task submission: returns 202 immediately; poll GET /v1/tasks/:id
      // or supply callbackUrl for a webhook on terminal status.
      POST: async ({ request }) => {
        const client = createConvexClient()
        const caller = await resolveCaller(client, request)
        if (!caller) return json({ error: 'Unauthorized' }, 401)

        const body = (await request.json()) as CreateTaskBody
        if (typeof body.projectId !== 'string') return json({ error: 'projectId is required' }, 400)
        if (typeof body.recipe !== 'string') return json({ error: 'recipe is required' }, 400)

        const recipe = getRecipe(body.recipe)
        if (!recipe) return json({ error: `Unknown recipe: ${body.recipe}` }, 400)

        const briefResult = recipe.briefSchema.safeParse(body.brief ?? {})
        if (!briefResult.success) {
          return json(
            {
              error: 'Invalid brief for recipe',
              recipe: recipe.name,
              issues: briefResult.error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
              })),
            },
            400,
          )
        }

        let taskId: Id<'tasks'>
        try {
          taskId = await client.mutation(api.serverTasks.createTask, {
            serverSecret: getServerSecret(),
            ownerId: caller.ownerId,
            apiKeyId: caller.apiKeyId,
            projectId: body.projectId as Id<'projects'>,
            recipe: recipe.name,
            recipeVersion: recipe.version,
            brief: briefResult.data,
            maxIterations: body.maxIterations ?? recipe.defaultMaxIterations,
            callbackUrl: body.callbackUrl,
          })
        } catch (error) {
          console.error(`createTask error: ${error}`)
          return json({ error: (error as Error).message }, 404)
        }

        getTaskEngine().enqueue(taskId)
        return json({ taskId, status: 'queued' }, 202)
      },
    },
  },
})
