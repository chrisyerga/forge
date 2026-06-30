// Server-side (Node) Web Crypto helpers. Mirrors convex/lib/crypto.ts so key
// hashing is identical on both sides of the API-key check.

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function parseApiKey(fullKey: string): { prefix: string } | null {
  const [scheme, prefix, secret] = fullKey.split('_')
  if (scheme !== 'forge' || !prefix || !secret) {
    return null
  }
  return { prefix }
}
