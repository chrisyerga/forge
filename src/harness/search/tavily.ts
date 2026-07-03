import type { SearchProvider, SearchResultItem } from '../capabilities'
import { createFakeSearchProvider } from './fake'

type TavilyResult = {
  title: string
  url: string
  content?: string
  raw_content?: string | null
  score?: number
}

type TavilyResponse = {
  results?: Array<TavilyResult>
}

// First SearchProvider implementation. Tavily's /search covers both the SERP
// view (titles/urls/snippets) and page content (include_raw_content), which is
// all the research stage needs from one API.
export function createTavilySearchProvider(apiKey: string): SearchProvider {
  return {
    async search(query, opts = {}): Promise<Array<SearchResultItem>> {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results: opts.maxResults ?? 8,
          search_depth: 'advanced',
          include_raw_content: opts.includeContent ?? false,
        }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Tavily search failed (${response.status}): ${body.slice(0, 500)}`)
      }
      const data = (await response.json()) as TavilyResponse
      return (data.results ?? []).map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content,
        content: result.raw_content ?? undefined,
        score: result.score,
      }))
    },
  }
}

export function createSearchProviderFromEnv(): SearchProvider {
  if (process.env.FORGE_SEARCH_PROVIDER === 'fake') {
    return createFakeSearchProvider()
  }
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    return {
      async search() {
        throw new Error('TAVILY_API_KEY is not configured; the research stage requires a search provider')
      },
    }
  }
  return createTavilySearchProvider(apiKey)
}
