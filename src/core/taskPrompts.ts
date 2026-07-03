// Pure prompt builders for the task harness stages. Composable with the
// existing persona/entity/style blocks in prompts.ts; no framework imports.

import { buildEntityBlock, buildPersonaBlock, buildStyleBlock } from './prompts'
import type { GenerationRequest } from './types'
import type {
  ContentPlan,
  Deliverable,
  Evaluation,
  ResearchBundle,
  Resource,
  Rubric,
  TaskContext,
} from './tasks'

function section(title: string, body: string | undefined): string {
  if (!body?.trim()) return ''
  return `## ${title}\n${body.trim()}`
}

function joinSections(...sections: Array<string>): string {
  return sections.filter(Boolean).join('\n\n')
}

export function buildResourceBlock(resources: Array<Resource>): string {
  if (!resources.length) return ''
  return [
    'Promotable resources (link only where genuinely relevant; zero links is acceptable):',
    ...resources.map((resource) => {
      const details = [
        resource.kind,
        resource.description,
        resource.tags?.length ? `Tags: ${resource.tags.join(', ')}` : undefined,
        resource.priority !== undefined ? `Priority: ${resource.priority}` : undefined,
      ].filter(Boolean)
      return `- [${resource.id}] ${resource.title} (${resource.url}): ${details.join('; ')}`
    }),
  ].join('\n')
}

/**
 * The shared "who is producing this and for whom" block: project, persona,
 * styles, entities, resources, guidelines, and any caller answers.
 */
export function buildTaskContextBlock(ctx: TaskContext): string {
  // buildPersonaBlock/buildEntityBlock/buildStyleBlock accept GenerationRequest
  // shapes; adapt the task context into one.
  const requestShape = {
    persona: ctx.persona,
    entities: ctx.entities,
    styles: ctx.styles,
  } as GenerationRequest

  const answers = Object.entries(ctx.answers)
  return joinSections(
    ctx.project
      ? section('Project', `${ctx.project.name}${ctx.project.description ? `\n${ctx.project.description}` : ''}`)
      : '',
    section('Editorial guidelines', ctx.guidelines),
    section('Persona (author voice)', buildPersonaBlock(requestShape)),
    section('Styles', buildStyleBlock(ctx.styles)),
    section('Entities', buildEntityBlock(ctx.entities)),
    section('Resources', buildResourceBlock(ctx.resources)),
    answers.length
      ? section(
          'Caller-provided answers',
          answers.map(([key, value]) => `- ${key}: ${value}`).join('\n'),
        )
      : '',
  )
}

export function buildResearchSynthesisPrompt(args: {
  objective: string
  searchResults: string
  briefNotes?: string
}): { system: string; prompt: string } {
  return {
    system:
      'You are a meticulous content researcher. Synthesize raw web/search material into a structured research bundle. ' +
      'Ground every claim in the provided material; do not invent statistics or sources. ' +
      'Derive concrete success criteria: what must a piece of content do to fully satisfy the searcher?',
    prompt: joinSections(
      section('Objective', args.objective),
      section('Notes from the caller', args.briefNotes),
      section('Raw search material', args.searchResults),
      section(
        'Task',
        'Produce the research bundle: the underlying search intent, success criteria, SERP landscape, ' +
          'competitor outlines with strengths/weaknesses, content gaps competitors leave open, ' +
          'useful factoids/best practices (only ones supported by the material), and questions people ask.',
      ),
    ),
  }
}

export function buildStrategyPrompt(args: {
  ctx: TaskContext
  objective: string
  research: ResearchBundle
  revisionNotes?: Array<string>
}): { system: string; prompt: string } {
  return {
    system:
      'You are a content strategist. Design how a piece of content should be framed to achieve the objective, ' +
      'using the research and the project context. Choose a form and point of view that fits the persona and audience. ' +
      'Plan links only where they genuinely help the reader; forced promotion is a defect.',
    prompt: joinSections(
      section('Objective', args.objective),
      buildTaskContextBlock(args.ctx),
      section('Research bundle', JSON.stringify(args.research, null, 2)),
      args.revisionNotes?.length
        ? section('Revision notes from the previous attempt', args.revisionNotes.map((n) => `- ${n}`).join('\n'))
        : '',
      section(
        'Task',
        'Produce a content plan: the angle, the form (how-to, listicle, story, expert guide, dos-and-donts, ...), ' +
          'point of view, audience summary, title candidates, a section-by-section outline (with structured-content ' +
          'choices like tables/lists/FAQs where they serve the reader), a link plan referencing resources by id, ' +
          'the core takeaway, and the call to action if one fits.',
      ),
    ),
  }
}

export function buildGenerateInstructions(args: {
  objective: string
  plan: ContentPlan
  research: ResearchBundle
  revisionNotes?: Array<string>
}): string {
  return joinSections(
    section('Objective', args.objective),
    section('Content plan (follow it)', JSON.stringify(args.plan, null, 2)),
    section(
      'Research (ground the content in this; do not invent facts)',
      JSON.stringify(
        {
          successCriteria: args.research.successCriteria,
          factoids: args.research.factoids,
          questionsPeopleAsk: args.research.questionsPeopleAsk,
          contentGaps: args.research.contentGaps,
        },
        null,
        2,
      ),
    ),
    args.revisionNotes?.length
      ? section('Revision notes (address every one)', args.revisionNotes.map((n) => `- ${n}`).join('\n'))
      : '',
    section(
      'Task',
      'Write the full deliverable: title, URL slug, meta description (under 160 characters), OpenGraph title and ' +
        'description, tags, and the complete body in markdown. Execute the outline faithfully, keep the persona voice ' +
        'throughout, and weave planned links in naturally with descriptive anchor text.',
    ),
  )
}

export function buildEvaluationPrompt(args: {
  objective: string
  rubric: Rubric
  successCriteria: Array<string>
  deliverable: Deliverable
}): { system: string; prompt: string } {
  return {
    system:
      'You are a rigorous content evaluator. Score the deliverable against each rubric criterion from 0-100 ' +
      'with a specific rationale citing the content. Be critical: reserve scores above 90 for genuinely excellent work. ' +
      'List concrete gaps that, if fixed, would most improve the content.',
    prompt: joinSections(
      section('Objective', args.objective),
      section(
        'Rubric criteria',
        args.rubric.criteria.map((c) => `- [${c.id}] (weight ${c.weight ?? 1}) ${c.description}`).join('\n'),
      ),
      section(
        'Success criteria derived from search intent (score criterion "search_intent" against these)',
        args.successCriteria.map((c) => `- ${c}`).join('\n'),
      ),
      section('Deliverable', JSON.stringify(args.deliverable, null, 2)),
    ),
  }
}

export function buildRevisionPrompt(args: {
  objective: string
  evaluation: Evaluation
  stageIds: Array<string>
}): { system: string; prompt: string } {
  return {
    system:
      'You turn evaluation gaps into an actionable revision plan. Decide which stage to re-enter: pick the earliest ' +
      'stage whose output caused the gaps (structural/framing problems need the strategy stage; wording/execution ' +
      'problems only need the generate stage). Write notes as direct instructions to the next pass.',
    prompt: joinSections(
      section('Objective', args.objective),
      section('Evaluation', JSON.stringify(args.evaluation, null, 2)),
      section('Available re-entry stages (in pipeline order)', args.stageIds.map((s) => `- ${s}`).join('\n')),
    ),
  }
}
