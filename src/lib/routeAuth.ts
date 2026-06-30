import type { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { verifyApiKeyHeader } from './apiKeyAuth'
import type { GenerationSource } from '@/generation/executor'

export type Caller = {
  ownerId: Id<'users'>
  apiKeyId?: Id<'apiKeys'>
  source: GenerationSource
}

// Accepts either a forge API key (service-to-service) or a Convex Auth JWT
// (the web playground), so /v1 is a single endpoint with one prompt path.
export async function resolveCaller(
  client: ConvexHttpClient,
  request: Request,
): Promise<Caller | null> {
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (!bearer) return null

  if (bearer.startsWith('forge_')) {
    const verified = await verifyApiKeyHeader(client, authHeader)
    if (!verified) return null
    return { ownerId: verified.ownerId, apiKeyId: verified.apiKeyId, source: 'api' }
  }

  client.setAuth(bearer)
  try {
    const me = await client.query(api.users.me, {})
    return { ownerId: me._id, source: 'playground' }
  } catch {
    return null
  }
}
