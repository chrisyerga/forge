import { ConvexHttpClient } from 'convex/browser'

export function getServerConvexUrl(): string {
  const url = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL
  if (!url) throw new Error('Missing CONVEX_URL / VITE_CONVEX_URL')
  return url
}

export function getServerSecret(): string {
  const secret = process.env.FORGE_SERVER_SECRET
  if (!secret) throw new Error('Missing FORGE_SERVER_SECRET')
  return secret
}

export function createConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(getServerConvexUrl())
}
