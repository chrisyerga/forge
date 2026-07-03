import type { z } from 'zod'
import type { Evaluation, RevisionNotes, StageResult, TaskContext } from '@/core/tasks'
import type { Capabilities } from './capabilities'

// A Recipe is a pipeline definition in code, not the DB: the task row stores
// only the recipe name + version. The engine is generic; new deliverable types
// are new recipes.

export type ArtifactStore = {
  get<T = unknown>(kind: string): T | undefined
  require<T = unknown>(kind: string): T
}

export type StageRunArgs = {
  ctx: TaskContext
  artifacts: ArtifactStore
  capabilities: Capabilities
}

export type Stage = {
  id: string
  run(args: StageRunArgs): Promise<StageResult>
}

export type Recipe = {
  name: string
  version: number
  /** Validates the caller-supplied brief at the API boundary. */
  briefSchema: z.ZodType
  defaultMaxIterations: number
  /** Linear pipeline. The engine walks these in order, checkpointing each. */
  stages: Array<Stage>
  /**
   * Revision policy, invoked by the engine when the current `evaluation`
   * artifact has verdict 'revise' and iterations remain. Returns notes with a
   * re-entry stage id. Omit for recipes without an evaluate/revise loop.
   */
  revise?(args: StageRunArgs & { evaluation: Evaluation }): Promise<RevisionNotes>
}

export function createArtifactStore(map: Map<string, unknown>): ArtifactStore {
  return {
    get<T>(kind: string): T | undefined {
      return map.get(kind) as T | undefined
    },
    require<T>(kind: string): T {
      if (!map.has(kind)) throw new Error(`Missing required artifact: ${kind}`)
      return map.get(kind) as T
    },
  }
}
