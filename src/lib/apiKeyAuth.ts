import type { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { parseApiKey, sha256Hex } from './crypto'
import { getServerSecret } from './convexServer'

export type VerifiedKey = {
  apiKeyId: Id<'apiKeys'>
  ownerId: Id<'users'>
  scopes: Array<string>
}

// Verifies an `Authorization: Bearer forge_..._...` header against Convex.
export async function verifyApiKeyHeader(
  client: ConvexHttpClient,
  authHeader: string | null,
): Promise<VerifiedKey | null> {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const fullKey = match?.[1]?.trim()
  if (!fullKey) return null
  const parsed = parseApiKey(fullKey)
  if (!parsed) return null
  const hash = await sha256Hex(fullKey)
  return await client.mutation(api.server.verifyApiKey, {
    serverSecret: getServerSecret(),
    prefix: parsed.prefix,
    hash,
  })
}
