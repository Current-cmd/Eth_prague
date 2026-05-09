import { ApifyClient } from "apify-client";
import type { ScraperAgent, ScraperInput, ScraperResult, NewsArticle } from "./types.js";

const MAX_ITEMS = 5;

// Raw shape from apify/google-search-scraper dataset items.
// Each item represents one query page and contains an organicResults array.
interface OrganicResult {
  title?: string;
  url?: string;
  snippet?: string;
  [key: string]: unknown;
}

interface ApifySearchPage {
  organicResults?: OrganicResult[];
  [key: string]: unknown;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function mapToNewsArticle(r: OrganicResult): NewsArticle {
  return {
    title:   r.title   ?? "(no title)",
    source:  r.url ? domainOf(r.url) : "(unknown source)",
    url:     r.url     ?? "",
    snippet: r.snippet ?? "",
    date:    "",   // apify/google-search-scraper doesn't return a date field
  };
}

// ── Real Apify call ────────────────────────────────────────────────────────
// Actor: apify/google-search-scraper (Free-tier compatible)
// Output: one dataset item per query page; organic results nested in organicResults[].
async function fetchNewsArticles(input: ScraperInput): Promise<NewsArticle[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error("[newsAgent] APIFY_TOKEN is not set — returning empty results");
    return [];
  }

  const { query } = input;
  console.info(`[newsAgent] querying Apify: "${query}"`);

  try {
    const client = new ApifyClient({ token });

    const run = await client.actor("apify/google-search-scraper").call({
      queries:          query,
      resultsPerPage:   10,   // one page of 10 is enough; we trim to MAX_ITEMS below
      maxPagesPerQuery: 1,
      countryCode:      "us",
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Log raw shape of first item to aid debugging during integration
    if (items.length > 0) {
      const firstPage = items[0] as ApifySearchPage;
      console.debug(`[newsAgent] raw item keys: ${Object.keys(firstPage).join(", ")}`);
      console.debug(`[newsAgent] organicResults count: ${firstPage.organicResults?.length ?? 0}`);
    }

    // Flatten organic results across all pages (we only request one, but be safe)
    const organic: OrganicResult[] = (items as ApifySearchPage[]).flatMap(
      (page) => page.organicResults ?? []
    );

    const articles = organic.slice(0, MAX_ITEMS).map(mapToNewsArticle);

    console.info(
      `[newsAgent] received ${organic.length} results, using top ${articles.length} for "${query}"`
    );
    return articles;
  } catch (err) {
    console.error(`[newsAgent] Apify call failed for "${query}":`, err);
    return [];
  }
}

export const newsAgent: ScraperAgent = {
  async run(input: ScraperInput): Promise<ScraperResult> {
    const articles = await fetchNewsArticles(input);
    return { agentId: "news", input, articles };
  },
};
