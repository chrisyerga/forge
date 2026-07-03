import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createTask,
  getTask,
  isActiveTaskStatus,
  loadTaskRunnerApiKey,
  saveTaskRunnerApiKey,
  submitTaskInput,
  type TaskApiResponse,
} from '@/lib/tasksApi'

export const Route = createFileRoute('/task-runner')({
  component: TaskRunnerPage,
})

const RECIPES = [{ id: 'seo_article', label: 'SEO article', defaultMaxIterations: 2 }] as const

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-zinc-800 text-zinc-300',
  running: 'bg-blue-950 text-blue-300',
  needs_input: 'bg-amber-950 text-amber-300',
  complete: 'bg-emerald-950 text-emerald-300',
  failed: 'bg-red-950 text-red-300',
  canceled: 'bg-zinc-800 text-zinc-500',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-zinc-800 text-zinc-300'}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

function TaskRunnerPage() {
  const projects = useQuery(convexQuery(api.projects.list, {}))
  const convexTasks = useQuery(convexQuery(api.tasks.list, { limit: 100 }))

  const [apiKey, setApiKey] = useState(loadTaskRunnerApiKey)
  const [projectId, setProjectId] = useState('')
  const [recipe, setRecipe] = useState<(typeof RECIPES)[number]['id']>('seo_article')
  const [keywords, setKeywords] = useState('')
  const [objective, setObjective] = useState('')
  const [audience, setAudience] = useState('')
  const [voice, setVoice] = useState('')
  const [notes, setNotes] = useState('')
  const [maxIterations, setMaxIterations] = useState('2')
  const [callbackUrl, setCallbackUrl] = useState('')

  const [taskId, setTaskId] = useState('')
  const [task, setTask] = useState<TaskApiResponse | null>(null)
  const [inputAnswers, setInputAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResponse, setLastResponse] = useState<unknown>(null)

  const recipeMeta = RECIPES.find((r) => r.id === recipe) ?? RECIPES[0]

  useEffect(() => {
    saveTaskRunnerApiKey(apiKey)
  }, [apiKey])

  useEffect(() => {
    const first = projects.data?.[0]
    if (projectId || !first) return
    setProjectId(first._id)
  }, [projects.data, projectId])

  const refreshTask = useCallback(async () => {
    if (!apiKey.trim() || !taskId.trim()) return
    setPolling(true)
    setError(null)
    const result = await getTask(apiKey.trim(), taskId.trim())
    setPolling(false)
    if (!result.ok) {
      setError(formatApiError(result.status, result.body))
      setLastResponse(result.body)
      return
    }
    setTask(result.task)
    setLastResponse(result.task)
    if (result.task.pendingInput?.length) {
      setInputAnswers((prev) => {
        const next = { ...prev }
        for (const q of result.task.pendingInput ?? []) {
          if (!(q.key in next)) next[q.key] = ''
        }
        return next
      })
    }
  }, [apiKey, taskId])

  useEffect(() => {
    if (!taskId.trim() || !apiKey.trim()) return
    void refreshTask()
  }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps -- refresh when user picks a new id

  useEffect(() => {
    if (!task || !isActiveTaskStatus(task.status)) return
    const timer = setInterval(() => {
      void refreshTask()
    }, 3000)
    return () => clearInterval(timer)
  }, [task, refreshTask])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!apiKey.trim()) {
      setError('Paste a Forge API key first.')
      return
    }
    if (!projectId) {
      setError('Select a project.')
      return
    }
    const keywordList = keywords
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (!keywordList.length) {
      setError('Enter at least one keyword (one per line).')
      return
    }

    setSubmitting(true)
    setError(null)
    const brief: Record<string, unknown> = { keywords: keywordList }
    if (objective.trim()) brief.objective = objective.trim()
    if (audience.trim()) brief.audience = audience.trim()
    if (voice.trim()) brief.voice = voice.trim()
    if (notes.trim()) brief.notes = notes.trim()

    const payload = {
      projectId,
      recipe,
      brief,
      maxIterations: maxIterations ? Number(maxIterations) : recipeMeta.defaultMaxIterations,
      callbackUrl: callbackUrl.trim() || undefined,
    }

    const result = await createTask(apiKey.trim(), payload)
    setSubmitting(false)
    setLastResponse(result.ok ? { taskId: result.taskId, status: 'queued' } : result.body)

    if (!result.ok) {
      setError(formatApiError(result.status, result.body))
      return
    }

    setTaskId(result.taskId)
    setTask(null)
    setInputAnswers({})
    void getTask(apiKey.trim(), result.taskId).then((loaded) => {
      if (loaded.ok) {
        setTask(loaded.task)
        setLastResponse(loaded.task)
      }
    })
  }

  async function handleSubmitInput(event: React.FormEvent) {
    event.preventDefault()
    if (!apiKey.trim() || !taskId.trim()) return
    setSubmitting(true)
    setError(null)
    const result = await submitTaskInput(apiKey.trim(), taskId.trim(), inputAnswers)
    setSubmitting(false)
    setLastResponse(result.ok ? { resumed: true } : result.body)
    if (!result.ok) {
      setError(formatApiError(result.status, result.body))
      return
    }
    await refreshTask()
  }

  const deliverableBody =
    task?.deliverable &&
    typeof task.deliverable === 'object' &&
    task.deliverable !== null &&
    'bodyMarkdown' in task.deliverable
      ? String((task.deliverable as { bodyMarkdown: string }).bodyMarkdown)
      : null

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Task runner</h1>
            <p className="text-sm text-zinc-400">
              Exercise <code className="text-zinc-300">POST /v1/tasks</code> with a Forge API key.
              Project list comes from your session; requests use the key you paste.
            </p>
          </div>
          <Link to="/tasks" className="text-sm text-zinc-400 hover:text-zinc-100">
            View all tasks (live) →
          </Link>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API key</CardTitle>
                <CardDescription>
                  Create one on the{' '}
                  <Link to="/keys" className="text-zinc-300 underline-offset-2 hover:underline">
                    API Keys
                  </Link>{' '}
                  page. Stored in session storage for this browser tab only.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder="forge_…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Create task</CardTitle>
                <CardDescription>Maps to POST /v1/tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={(e) => void handleCreate(e)}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="runner-project">Project</Label>
                      <Select
                        id="runner-project"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                      >
                        <option value="">— select —</option>
                        {projects.data?.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.kind})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="runner-recipe">Recipe</Label>
                      <Select
                        id="runner-recipe"
                        value={recipe}
                        onChange={(e) =>
                          setRecipe(e.target.value as (typeof RECIPES)[number]['id'])
                        }
                      >
                        {RECIPES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  {recipe === 'seo_article' ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="runner-keywords">Keywords (one per line)</Label>
                        <Textarea
                          id="runner-keywords"
                          rows={4}
                          placeholder={'how to calm dog during fireworks\ndog fireworks anxiety remedies'}
                          value={keywords}
                          onChange={(e) => setKeywords(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="runner-objective">Objective (optional)</Label>
                        <Textarea
                          id="runner-objective"
                          rows={2}
                          value={objective}
                          onChange={(e) => setObjective(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="runner-audience">Audience (optional)</Label>
                          <Input
                            id="runner-audience"
                            value={audience}
                            onChange={(e) => setAudience(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="runner-voice">Voice (optional)</Label>
                          <Input
                            id="runner-voice"
                            placeholder="Overrides project persona when set"
                            value={voice}
                            onChange={(e) => setVoice(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="runner-notes">Notes (optional)</Label>
                        <Textarea
                          id="runner-notes"
                          rows={2}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="runner-max-iter">Max iterations</Label>
                      <Input
                        id="runner-max-iter"
                        type="number"
                        min={1}
                        max={5}
                        value={maxIterations}
                        onChange={(e) => setMaxIterations(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="runner-callback">Callback URL (optional)</Label>
                      <Input
                        id="runner-callback"
                        type="url"
                        placeholder="https://…"
                        value={callbackUrl}
                        onChange={(e) => setCallbackUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Submitting…' : 'POST /v1/tasks'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Load task</CardTitle>
                <CardDescription>GET /v1/tasks/:id — poll while queued or running</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="runner-task-id">Task ID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="runner-task-id"
                      placeholder="Paste or pick from recent tasks"
                      value={taskId}
                      onChange={(e) => setTaskId(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={polling || !taskId.trim() || !apiKey.trim()}
                      onClick={() => void refreshTask()}
                    >
                      {polling ? '…' : 'Refresh'}
                    </Button>
                  </div>
                </div>

                {convexTasks.data?.length ? (
                  <div className="space-y-2">
                    <Label>Recent tasks (your account)</Label>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-zinc-800 p-2">
                      {convexTasks.data.map((t: Doc<'tasks'>) => (
                        <button
                          key={t._id}
                          type="button"
                          onClick={() => {
                            setTaskId(t._id)
                            setTask(null)
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-900 ${
                            taskId === t._id ? 'bg-zinc-900' : ''
                          }`}
                        >
                          <span className="truncate font-mono text-xs">{t._id}</span>
                          <StatusBadge status={t.status} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <p className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
                    {error}
                  </p>
                ) : null}

                {task ? (
                  <div className="space-y-3 rounded-md border border-zinc-800 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={task.status} />
                      <span className="text-sm text-zinc-400">{task.recipe}</span>
                      {task.currentStage ? (
                        <span className="text-xs text-zinc-500">stage: {task.currentStage}</span>
                      ) : null}
                      <span className="text-xs text-zinc-500">
                        iter {task.iteration}/{task.maxIterations}
                      </span>
                      {isActiveTaskStatus(task.status) ? (
                        <span className="text-xs text-blue-400">auto-polling</span>
                      ) : null}
                    </div>
                    {task.errorMessage ? (
                      <p className="text-sm text-red-300">{task.errorMessage}</p>
                    ) : null}
                  </div>
                ) : null}

                {task?.pendingInput?.length ? (
                  <form className="space-y-3 rounded-md border border-amber-900 bg-amber-950/30 p-3" onSubmit={(e) => void handleSubmitInput(e)}>
                    <p className="text-sm font-medium text-amber-200">Needs input — POST /v1/tasks/:id/input</p>
                    {task.pendingInput.map((q) => (
                      <div key={q.key} className="space-y-1">
                        <Label htmlFor={`answer-${q.key}`}>{q.key}</Label>
                        <p className="text-xs text-amber-100/80">{q.question}</p>
                        {q.why ? <p className="text-xs text-zinc-500">{q.why}</p> : null}
                        <Textarea
                          id={`answer-${q.key}`}
                          rows={2}
                          value={inputAnswers[q.key] ?? ''}
                          onChange={(e) =>
                            setInputAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                    <Button type="submit" size="sm" disabled={submitting}>
                      Submit answers
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>

            {task?.deliverable ? (
              <Card>
                <CardHeader>
                  <CardTitle>Deliverable</CardTitle>
                  {typeof task.deliverable === 'object' &&
                  task.deliverable !== null &&
                  'title' in task.deliverable ? (
                    <CardDescription>{String((task.deliverable as { title: string }).title)}</CardDescription>
                  ) : null}
                </CardHeader>
                {deliverableBody ? (
                  <CardContent>
                    <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-800 p-3 font-serif text-sm text-zinc-200">
                      {deliverableBody}
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            ) : null}

            {lastResponse ? (
              <details className="rounded-md border border-zinc-800">
                <summary className="cursor-pointer px-3 py-2 text-sm text-zinc-300">
                  Raw API response
                </summary>
                <pre className="max-h-96 overflow-auto border-t border-zinc-800 p-3 text-xs text-zinc-400">
                  {JSON.stringify(lastResponse, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function formatApiError(status: number, body: unknown): string {
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>
    if (typeof record.error === 'string') {
      const issues = record.issues as Array<{ path: string; message: string }> | undefined
      if (issues?.length) {
        return `${record.error} (${status}): ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`
      }
      return `${record.error} (${status})`
    }
  }
  return `Request failed (${status})`
}
