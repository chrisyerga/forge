import { z } from 'zod'
import {
  ARTIFACT_KINDS,
  scoreEvaluation,
  stageArtifacts,
  stageNeedsInput,
} from '@/core/tasks'
import type {
  ContentPlan,
  Deliverable,
  ResearchBundle,
  Rubric,
  TaskContext,
} from '@/core/tasks'
import {
  buildEvaluationPrompt,
  buildGenerateInstructions,
  buildResearchSynthesisPrompt,
  buildRevisionPrompt,
  buildStrategyPrompt,
} from '@/core/taskPrompts'
import { buildGenerationPlan } from '@/core/prompts'
import type { SearchResultItem } from '../capabilities'
import type { Recipe, Stage } from '../recipe'

// First pressure-test recipe: an SEO-driven article. The engine, schema, and
// stage contracts are generic; everything blog-specific lives in this file.

const briefSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  objective: z.string().optional(),
  audience: z.string().optional(),
  voice: z.string().optional(),
  notes: z.string().optional(),
})

type SeoBrief = z.infer<typeof briefSchema>

const RUBRIC: Rubric = {
  passThreshold: 80,
  criteria: [
    {
      id: 'search_intent',
      weight: 3,
      description:
        'Fully satisfies the search intent and every derived success criterion; a searcher would not need to go back to the results page.',
    },
    {
      id: 'coverage',
      weight: 2,
      description:
        'Covers the topic completely, incorporates the research factoids accurately, and exploits the identified content gaps.',
    },
    {
      id: 'voice',
      weight: 2,
      description: 'Consistently written in the persona voice and project styles; no generic AI cadence.',
    },
    {
      id: 'seo',
      weight: 2,
      description:
        'Title, slug, meta description, and headings use the target keywords naturally; metadata is compelling and within length limits.',
    },
    {
      id: 'structure',
      weight: 1,
      description:
        'Scannable structure that follows the content plan: clear section headers and structured content (tables/lists/FAQ) where planned.',
    },
    {
      id: 'integration',
      weight: 1,
      description:
        'Planned links and the call to action are woven in naturally where they help the reader; no forced promotion.',
    },
  ],
}

function briefOf(ctx: TaskContext): SeoBrief {
  return briefSchema.parse(ctx.brief)
}

function objectiveOf(ctx: TaskContext): string {
  const brief = briefOf(ctx)
  const parts = [
    `Produce content that ranks well for, and fully satisfies searchers of: ${brief.keywords.join(', ')}.`,
    brief.objective,
    brief.audience ? `Audience: ${brief.audience}.` : undefined,
  ]
  return parts.filter(Boolean).join(' ')
}

// --------------------------------------------------------------------------
// LLM output schemas. Kept fully-required (arrays may be empty) so they map
// cleanly onto strict structured-output modes; they mirror the core types.
// --------------------------------------------------------------------------

const researchBundleSchema = z.object({
  searchIntent: z.string(),
  successCriteria: z.array(z.string()),
  serpLandscape: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      summary: z.string(),
      contentType: z.string(),
    }),
  ),
  competitorOutlines: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      outline: z.array(z.string()),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
    }),
  ),
  contentGaps: z.array(z.string()),
  factoids: z.array(z.string()),
  questionsPeopleAsk: z.array(z.string()),
  sources: z.array(z.object({ url: z.string(), title: z.string() })),
}) satisfies z.ZodType<ResearchBundle>

const contentPlanSchema = z.object({
  angle: z.string(),
  form: z.string(),
  pointOfView: z.string(),
  audienceSummary: z.string(),
  titleCandidates: z.array(z.string()),
  outline: z.array(
    z.object({
      heading: z.string(),
      purpose: z.string(),
      structuredContent: z.array(z.string()),
      notes: z.string(),
    }),
  ),
  linkPlan: z.array(
    z.object({
      resourceId: z.string(),
      url: z.string(),
      anchorIdea: z.string(),
      placement: z.string(),
      why: z.string(),
    }),
  ),
  takeaway: z.string(),
  cta: z.string(),
  notes: z.array(z.string()),
}) satisfies z.ZodType<ContentPlan>

const deliverableSchema = z.object({
  title: z.string(),
  slug: z.string(),
  metaDescription: z.string(),
  openGraph: z.object({
    title: z.string(),
    description: z.string(),
    type: z.string(),
  }),
  bodyMarkdown: z.string(),
  tags: z.array(z.string()),
  excerpt: z.string(),
}) satisfies z.ZodType<Deliverable>

const evaluationOutputSchema = z.object({
  scores: z.array(
    z.object({
      criterionId: z.string(),
      score: z.number().min(0).max(100),
      rationale: z.string(),
    }),
  ),
  gaps: z.array(z.string()),
  summary: z.string(),
})

const revisionNotesSchema = z.object({
  reentryStage: z.enum(['strategy', 'generate']),
  notes: z.array(z.string()),
  researchRequests: z.array(z.string()),
})

// --------------------------------------------------------------------------
// Stages
// --------------------------------------------------------------------------

function formatSearchResults(results: Array<SearchResultItem>): string {
  return results
    .map((result, index) => {
      const parts = [
        `### Result ${index + 1}: ${result.title}`,
        `URL: ${result.url}`,
        result.snippet ? `Snippet: ${result.snippet}` : undefined,
        result.content ? `Content:\n${result.content.slice(0, 2500)}` : undefined,
      ]
      return parts.filter(Boolean).join('\n')
    })
    .join('\n\n')
}

const researchStage: Stage = {
  id: 'research',
  async run({ ctx, capabilities }) {
    const brief = briefOf(ctx)

    // One SERP-style pass per keyword phrase (capped), with page content.
    const seen = new Set<string>()
    const results: Array<SearchResultItem> = []
    for (const keyword of brief.keywords.slice(0, 3)) {
      const found = await capabilities.search.search(keyword, {
        maxResults: 8,
        includeContent: true,
      })
      for (const item of found) {
        if (seen.has(item.url)) continue
        seen.add(item.url)
        results.push(item)
      }
    }
    if (!results.length) {
      throw new Error('Search returned no results for the brief keywords')
    }

    const { system, prompt } = buildResearchSynthesisPrompt({
      objective: objectiveOf(ctx),
      searchResults: formatSearchResults(results.slice(0, 12)),
      briefNotes: brief.notes,
    })
    const research = await capabilities.llm.generateObject({
      schema: researchBundleSchema,
      system,
      prompt,
    })
    return stageArtifacts({ kind: ARTIFACT_KINDS.researchBundle, content: research })
  },
}

const strategyStage: Stage = {
  id: 'strategy',
  async run({ ctx, artifacts, capabilities }) {
    const brief = briefOf(ctx)

    // Voice must come from somewhere: project persona, brief, or the caller.
    if (!ctx.persona && !brief.voice && !ctx.answers.voice) {
      return stageNeedsInput({
        key: 'voice',
        question:
          'The project has no default persona and the brief does not specify a voice. Describe the author voice/point of view this content should use.',
        why: 'Voice drives the strategy (form, point of view) and the generated content itself.',
      })
    }

    const research = artifacts.require<ResearchBundle>(ARTIFACT_KINDS.researchBundle)
    const { system, prompt } = buildStrategyPrompt({
      ctx,
      objective: objectiveOf(ctx),
      research,
      revisionNotes: ctx.revisionNotes?.notes,
    })
    const plan = await capabilities.llm.generateObject({
      schema: contentPlanSchema,
      system,
      prompt: brief.voice ? `${prompt}\n\nRequested voice: ${brief.voice}` : prompt,
    })
    return stageArtifacts({ kind: ARTIFACT_KINDS.contentPlan, content: plan })
  },
}

const generateStage: Stage = {
  id: 'generate',
  async run({ ctx, artifacts, capabilities }) {
    const research = artifacts.require<ResearchBundle>(ARTIFACT_KINDS.researchBundle)
    const plan = artifacts.require<ContentPlan>(ARTIFACT_KINDS.contentPlan)
    const brief = briefOf(ctx)

    // Single prompt-assembly path: route the instructions through core's
    // buildGenerationPlan so persona/entity/style blocks render exactly as the
    // rest of the service renders them.
    const generationPlan = buildGenerationPlan({
      project: ctx.project,
      brief: {
        prompt: buildGenerateInstructions({
          objective: objectiveOf(ctx),
          plan,
          research,
          revisionNotes: ctx.revisionNotes?.notes,
        }),
        audience: brief.audience,
      },
      entities: ctx.entities,
      persona: ctx.persona,
      styles: ctx.styles,
      output: { kind: 'blog_post', text: { format: 'markdown' } },
      constraints: ctx.guidelines ? [ctx.guidelines] : undefined,
    })

    const draft = await capabilities.llm.generateObject({
      schema: deliverableSchema,
      system: generationPlan.prompts.system,
      prompt: generationPlan.prompts.user,
    })
    return stageArtifacts({ kind: ARTIFACT_KINDS.draft, content: draft })
  },
}

const evaluateStage: Stage = {
  id: 'evaluate',
  async run({ ctx, artifacts, capabilities }) {
    const research = artifacts.require<ResearchBundle>(ARTIFACT_KINDS.researchBundle)
    const draft = artifacts.require<Deliverable>(ARTIFACT_KINDS.draft)

    const { system, prompt } = buildEvaluationPrompt({
      objective: objectiveOf(ctx),
      rubric: RUBRIC,
      successCriteria: research.successCriteria,
      deliverable: draft,
    })
    const output = await capabilities.llm.generateObject({
      schema: evaluationOutputSchema,
      system,
      prompt,
    })

    // Verdict is computed in code, not by the judge, so the threshold is exact.
    const { overall, verdict } = scoreEvaluation(RUBRIC, output.scores)
    const evaluation = { ...output, overall, verdict }

    // The latest draft is always the deliverable; the evaluation records its
    // quality (a max-iterations exit still ships the best attempt).
    return stageArtifacts(
      { kind: ARTIFACT_KINDS.evaluation, content: evaluation },
      { kind: ARTIFACT_KINDS.deliverable, content: draft },
    )
  },
}

export const seoArticleRecipe: Recipe = {
  name: 'seo_article',
  version: 1,
  briefSchema,
  defaultMaxIterations: 2,
  stages: [researchStage, strategyStage, generateStage, evaluateStage],
  async revise({ ctx, capabilities, evaluation }) {
    const { system, prompt } = buildRevisionPrompt({
      objective: objectiveOf(ctx),
      evaluation,
      stageIds: ['strategy', 'generate'],
    })
    return await capabilities.llm.generateObject({
      schema: revisionNotesSchema,
      system,
      prompt,
    })
  },
}
