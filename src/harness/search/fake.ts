import type { SearchProvider, SearchResultItem } from '../capabilities'

// Deterministic stand-in for local development and harness testing when no
// real search API key is configured (FORGE_SEARCH_PROVIDER=fake). Returns
// clearly-synthetic SERP-shaped results so the pipeline can be exercised
// end-to-end; content quality tests require a real provider.
export function createFakeSearchProvider(): SearchProvider {
  return {
    async search(query, opts = {}): Promise<Array<SearchResultItem>> {
      const max = opts.maxResults ?? 8
      const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
      const templates = [
        {
          title: `${query} — Complete Guide`,
          url: `https://example-competitor-a.test/${slug}-guide`,
          snippet: `An in-depth guide covering everything about ${query}.`,
          content: `# ${query}: Complete Guide\n\nThis long-form guide covers background, step-by-step advice, common mistakes, and expert commentary about ${query}. Sections: What it is, Why it matters, Step-by-step instructions, Product recommendations, FAQ.`,
        },
        {
          title: `10 Tips for ${query}`,
          url: `https://example-competitor-b.test/tips-${slug}`,
          snippet: `A listicle with ten practical tips about ${query}.`,
          content: `# 10 Tips for ${query}\n\nA quick, scannable list of practical tips. Each tip has a short paragraph. Ends with a product roundup and a newsletter call to action.`,
        },
        {
          title: `${query}: What Vets / Experts Say`,
          url: `https://example-competitor-c.test/experts-${slug}`,
          snippet: `Expert quotes and research summaries about ${query}.`,
          content: `# Expert Advice on ${query}\n\nInterviews and quotes from credentialed experts, with citations to studies. Covers do's and don'ts, when to seek professional help, and safety caveats.`,
        },
        {
          title: `Forum thread: ${query}`,
          url: `https://example-forum.test/threads/${slug}`,
          snippet: `Real people discussing their experiences with ${query}.`,
          content: `Forum discussion with first-hand anecdotes about ${query}: what worked, what did not, and product mentions. Informal tone, mixed quality information.`,
        },
      ]
      return templates.slice(0, max)
    },
  }
}
