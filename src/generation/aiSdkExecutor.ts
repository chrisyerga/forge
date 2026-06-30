import { streamText } from 'ai'
import { DEFAULT_TEXT_MODEL, resolveTextModel } from './models'
import type { ExecuteArgs, GenerationExecutor, GenerationLogger } from './executor'

// Default executor: maps a GenerationPlan onto the Vercel AI SDK. This is the
// single place the AI SDK is invoked, so telemetry + Convex logging live here.
export const aiSdkExecutor: GenerationExecutor = {
  streamText({ plan, messages, source }: ExecuteArgs, logger: GenerationLogger): Response {
    const spec = plan.models.text ?? DEFAULT_TEXT_MODEL
    const model = resolveTextModel(spec)

    logger.start({ provider: spec.provider, model: spec.model })

    const result = streamText({
      model,
      system: plan.prompts.system,
      messages,
      experimental_telemetry: { isEnabled: true, functionId: `forge.${source}` },
      onError: async ({ error }) => {
        await logger.finish({
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      },
      onFinish: async (event) => {
        await logger.finish({
          status: 'complete',
          promptTokens: event.usage.inputTokens,
          completionTokens: event.usage.outputTokens,
          totalTokens: event.usage.totalTokens,
          finishReason: event.finishReason,
          result: event.text,
        })
      },
    })

    return result.toUIMessageStreamResponse()
  },
}
