const STORAGE_KEY = 'forge_task_runner_api_key'

export function loadTaskRunnerApiKey(): string {
  if (typeof sessionStorage === 'undefined') return ''
  return sessionStorage.getItem(STORAGE_KEY) ?? ''
}

export function saveTaskRunnerApiKey(key: string): void {
  if (typeof sessionStorage === 'undefined') return
  if (key.trim()) sessionStorage.setItem(STORAGE_KEY, key.trim())
  else sessionStorage.removeItem(STORAGE_KEY)
}

export type TaskApiResponse = {
  taskId: string
  status: string
  recipe: string
  currentStage: string | null
  iteration: number
  maxIterations: number
  pendingInput: Array<{ key: string; question: string; why?: string }> | null
  errorMessage: string | null
  createdAt: number
  finishedAt: number | null
  deliverable: unknown | null
  artifacts: Array<{
    kind: string
    stage: string
    iteration: number
    content: unknown
  }>
}

export type CreateTaskPayload = {
  projectId: string
  recipe: string
  brief: Record<string, unknown>
  maxIterations?: number
  callbackUrl?: string
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { error: text || response.statusText }
  }
}

export async function createTask(
  apiKey: string,
  payload: CreateTaskPayload,
): Promise<{ ok: true; taskId: string } | { ok: false; status: number; body: unknown }> {
  const response = await fetch('/v1/tasks', {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(payload),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) return { ok: false, status: response.status, body }
  const taskId = (body as { taskId?: string }).taskId
  if (!taskId) return { ok: false, status: response.status, body }
  return { ok: true, taskId }
}

export async function getTask(
  apiKey: string,
  taskId: string,
): Promise<{ ok: true; task: TaskApiResponse } | { ok: false; status: number; body: unknown }> {
  const response = await fetch(`/v1/tasks/${encodeURIComponent(taskId)}`, {
    headers: authHeaders(apiKey),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) return { ok: false, status: response.status, body }
  return { ok: true, task: body as TaskApiResponse }
}

export async function submitTaskInput(
  apiKey: string,
  taskId: string,
  answers: Record<string, string>,
): Promise<{ ok: true } | { ok: false; status: number; body: unknown }> {
  const response = await fetch(`/v1/tasks/${encodeURIComponent(taskId)}/input`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({ answers }),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) return { ok: false, status: response.status, body }
  return { ok: true }
}

export function isActiveTaskStatus(status: string): boolean {
  return status === 'queued' || status === 'running'
}
