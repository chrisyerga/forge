import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/tasks')({
  component: TasksPage,
})

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

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function formatDuration(start: number, end?: number): string {
  const ms = (end ?? Date.now()) - start
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function TasksPage() {
  const [selectedId, setSelectedId] = useState<Id<'tasks'> | null>(null)
  const tasks = useQuery(convexQuery(api.tasks.list, {}))

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-zinc-400">
            Harness runs: research, strategy, generation, evaluation and revision, stage by stage.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {tasks.data?.map((task) => (
              <button
                key={task._id}
                type="button"
                onClick={() => setSelectedId(task._id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedId === task._id
                    ? 'border-zinc-500 bg-zinc-900'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{task.recipe}</span>
                  <StatusBadge status={task.status} />
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {formatTime(task.createdAt)}
                  {task.currentStage ? ` · ${task.currentStage}` : ''}
                  {task.iteration > 1 ? ` · iteration ${task.iteration}` : ''}
                </div>
              </button>
            ))}
            {tasks.data?.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No tasks yet.{' '}
                <Link to="/task-runner" className="text-zinc-300 underline-offset-2 hover:underline">
                  Run one
                </Link>{' '}
                or submit via <code className="text-zinc-400">POST /v1/tasks</code>.
              </p>
            ) : null}
          </div>

          <div>
            {selectedId ? (
              <TaskDetail taskId={selectedId} />
            ) : (
              <p className="text-sm text-zinc-500">Select a task to inspect its run.</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function TaskDetail({ taskId }: { taskId: Id<'tasks'> }) {
  const detail = useQuery(convexQuery(api.tasks.get, { taskId }))
  const cancelTask = useMutation(api.tasks.cancel)

  if (!detail.data) {
    return <p className="text-sm text-zinc-500">Loading…</p>
  }
  const { task, steps, artifacts } = detail.data
  const active = task.status === 'queued' || task.status === 'running' || task.status === 'needs_input'
  const sortedSteps = [...steps].sort((a, b) => a.startedAt - b.startedAt)
  const currentArtifacts = artifacts.filter((a) => a.current)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                {task.recipe} <StatusBadge status={task.status} />
              </CardTitle>
              <CardDescription>
                Iteration {task.iteration}/{task.maxIterations}
                {task.currentStage ? ` · next stage: ${task.currentStage}` : ''} · created{' '}
                {formatTime(task.createdAt)}
              </CardDescription>
            </div>
            {active ? (
              <Button variant="ghost" size="sm" onClick={() => void cancelTask({ taskId })}>
                Cancel
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <JsonBlock label="Brief" value={task.brief} defaultOpen />
          {task.pendingInput?.length ? (
            <div className="rounded-md border border-amber-900 bg-amber-950/40 p-3 text-sm">
              <p className="font-medium text-amber-300">Waiting for caller input:</p>
              <ul className="mt-1 list-disc pl-5 text-amber-200">
                {task.pendingInput.map((q) => (
                  <li key={q.key}>
                    <span className="font-medium">{q.key}</span>: {q.question}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {task.errorMessage ? (
            <p className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
              {task.errorMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stage timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedSteps.map((step) => (
              <StepRow key={step._id} step={step} />
            ))}
            {sortedSteps.length === 0 ? (
              <p className="text-sm text-zinc-500">No stages have run yet.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Artifacts</CardTitle>
          <CardDescription>Current output of each stage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentArtifacts.map((artifact) => (
            <ArtifactBlock key={artifact._id} artifact={artifact} />
          ))}
          {currentArtifacts.length === 0 ? (
            <p className="text-sm text-zinc-500">No artifacts yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function StepRow({ step }: { step: Doc<'taskSteps'> }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <StatusBadge status={step.status} />
        <span className="font-medium">{step.stage}</span>
        <span className="text-xs text-zinc-500">iteration {step.iteration}</span>
      </div>
      <div className="text-xs text-zinc-500">
        {formatDuration(step.startedAt, step.finishedAt)}
        {step.totalTokens ? ` · ${step.totalTokens} tokens` : ''}
      </div>
    </div>
  )
}

function ArtifactBlock({ artifact }: { artifact: Doc<'artifacts'> }) {
  const parsed = (() => {
    try {
      return JSON.parse(artifact.content) as unknown
    } catch {
      return artifact.content
    }
  })()

  // Deliverable/draft bodies read better as markdown text than JSON.
  const body =
    typeof parsed === 'object' && parsed !== null && 'bodyMarkdown' in parsed
      ? (parsed as { bodyMarkdown: string }).bodyMarkdown
      : null

  return (
    <div className="space-y-2">
      <JsonBlock
        label={`${artifact.kind} (${artifact.stage}, iteration ${artifact.iteration})`}
        value={parsed}
      />
      {body ? (
        <details className="rounded-md border border-zinc-800">
          <summary className="cursor-pointer px-3 py-2 text-sm text-zinc-300">
            {artifact.kind}: body preview
          </summary>
          <div className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-zinc-800 p-3 font-serif text-sm text-zinc-200">
            {body}
          </div>
        </details>
      ) : null}
    </div>
  )
}

function JsonBlock({
  label,
  value,
  defaultOpen,
}: {
  label: string
  value: unknown
  defaultOpen?: boolean
}) {
  return (
    <details className="rounded-md border border-zinc-800" open={defaultOpen}>
      <summary className="cursor-pointer px-3 py-2 text-sm text-zinc-300">{label}</summary>
      <pre className="max-h-96 overflow-auto border-t border-zinc-800 p-3 text-xs text-zinc-400">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  )
}
