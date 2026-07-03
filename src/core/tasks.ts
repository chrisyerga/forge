// Pure domain model for the agentic task harness. Like types.ts, this file is
// framework-agnostic: no convex/tanstack/ai-sdk/zod imports. Ids are plain
// strings; the Convex schema mirrors these shapes.

import type { Entity, GenerationId, Persona, Project, Style } from './types'

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'needs_input'
  | 'complete'
  | 'failed'
  | 'canceled'

export type StepStatus = 'running' | 'complete' | 'error' | 'needs_input'

/** A structured question a stage can raise when it cannot proceed. */
export type InputRequest = {
  key: string
  question: string
  why?: string
}

/** A promotable project resource (product, partner link, existing content). */
export type ResourceKind = 'product' | 'article' | 'page' | 'offer' | 'other'

export type Resource = {
  id: GenerationId
  kind: ResourceKind
  title: string
  url: string
  description?: string
  tags?: Array<string>
  /** Higher = more important to promote. */
  priority?: number
  metadata?: Record<string, unknown>
}

/**
 * Everything a stage needs that is not produced by an earlier stage: the brief
 * from the caller plus the resolved project context (persona, styles,
 * entities, resources, guidelines) and any answers to earlier needs_input
 * questions.
 */
export type TaskContext = {
  taskId: GenerationId
  recipe: string
  iteration: number
  maxIterations: number
  brief: Record<string, unknown>
  answers: Record<string, string>
  project?: Project
  persona?: Persona
  styles: Array<Style>
  entities: Array<Entity>
  resources: Array<Resource>
  guidelines?: string
  /** Present when re-entering after an evaluate/revise loop. */
  revisionNotes?: RevisionNotes
}

/** A typed, named output of a stage. `content` is JSON-serializable. */
export type TaskArtifact = {
  kind: string
  content: unknown
}

export type StageResult =
  | { type: 'artifacts'; artifacts: Array<TaskArtifact> }
  | { type: 'needs_input'; questions: Array<InputRequest> }

export function stageArtifacts(...artifacts: Array<TaskArtifact>): StageResult {
  return { type: 'artifacts', artifacts }
}

export function stageNeedsInput(...questions: Array<InputRequest>): StageResult {
  return { type: 'needs_input', questions }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export type RubricCriterion = {
  id: string
  description: string
  /** Relative weight, defaults to 1. */
  weight?: number
}

export type Rubric = {
  criteria: Array<RubricCriterion>
  /** Weighted-average score (0-100) required to pass. */
  passThreshold: number
}

export type CriterionScore = {
  criterionId: string
  /** 0-100. */
  score: number
  rationale: string
}

export type Evaluation = {
  scores: Array<CriterionScore>
  /** Weighted average of scores, 0-100. */
  overall: number
  verdict: 'pass' | 'revise'
  gaps: Array<string>
  summary?: string
}

/** Compute the weighted overall score and verdict from raw criterion scores. */
export function scoreEvaluation(
  rubric: Rubric,
  scores: Array<CriterionScore>,
): { overall: number; verdict: 'pass' | 'revise' } {
  const weights = new Map(rubric.criteria.map((c) => [c.id, c.weight ?? 1]))
  let total = 0
  let weightSum = 0
  for (const score of scores) {
    const weight = weights.get(score.criterionId) ?? 1
    total += score.score * weight
    weightSum += weight
  }
  const overall = weightSum === 0 ? 0 : Math.round(total / weightSum)
  return { overall, verdict: overall >= rubric.passThreshold ? 'pass' : 'revise' }
}

export type RevisionNotes = {
  /** Stage id to re-enter at (e.g. 'strategy' for structural gaps, 'generate' for execution gaps). */
  reentryStage: string
  notes: Array<string>
  /** Follow-up research questions the next pass should consider. */
  researchRequests?: Array<string>
}

// ---------------------------------------------------------------------------
// Well-known artifact kinds + shapes for written-content pipelines. Recipes
// may add their own kinds; these are shared so evaluation/revision and the UI
// can rely on them.
// ---------------------------------------------------------------------------

export const ARTIFACT_KINDS = {
  researchBundle: 'research_bundle',
  contentPlan: 'content_plan',
  draft: 'draft',
  evaluation: 'evaluation',
  revisionNotes: 'revision_notes',
  deliverable: 'deliverable',
} as const

export type SerpEntry = {
  title: string
  url: string
  summary?: string
  contentType?: string
}

export type CompetitorOutline = {
  url: string
  title?: string
  outline: Array<string>
  strengths?: Array<string>
  weaknesses?: Array<string>
}

/** The "raw materials": what research produces for downstream stages. */
export type ResearchBundle = {
  searchIntent: string
  /** Dynamic success criteria derived from actual search intent; evaluation scores against these too. */
  successCriteria: Array<string>
  serpLandscape: Array<SerpEntry>
  competitorOutlines: Array<CompetitorOutline>
  contentGaps: Array<string>
  factoids: Array<string>
  questionsPeopleAsk: Array<string>
  sources: Array<{ url: string; title?: string }>
}

export type OutlineSection = {
  heading: string
  purpose: string
  /** e.g. 'table', 'numbered_list', 'bullet_list', 'checklist', 'faq'. */
  structuredContent?: Array<string>
  notes?: string
}

export type PlannedLink = {
  /** Resource id when the link promotes a project resource. */
  resourceId?: string
  url: string
  anchorIdea: string
  placement: string
  why: string
}

/** How the piece is framed: the strategy stage's output. */
export type ContentPlan = {
  angle: string
  /** e.g. 'how_to', 'listicle', 'story', 'expert_guide', 'dos_and_donts'. */
  form: string
  pointOfView: string
  audienceSummary: string
  titleCandidates: Array<string>
  outline: Array<OutlineSection>
  linkPlan: Array<PlannedLink>
  takeaway: string
  cta?: string
  notes?: Array<string>
}

/** The final (or draft) written deliverable. */
export type Deliverable = {
  title: string
  slug: string
  metaDescription: string
  openGraph: {
    title: string
    description: string
    type?: string
  }
  bodyMarkdown: string
  tags: Array<string>
  excerpt?: string
}
