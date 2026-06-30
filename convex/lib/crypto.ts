// Web Crypto helpers available in both the Convex runtime and Node 18+.

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Full key format: forge_<prefix>_<secret>. The prefix is a non-secret lookup
// handle; the secret provides entropy. Only the sha-256 of the full key is stored.
export function parseApiKey(fullKey: string): { prefix: string } | null {
  const [scheme, prefix, secret] = fullKey.split('_')
  if (scheme !== 'forge' || !prefix || !secret) {
    return null
  }
  return { prefix }
}
