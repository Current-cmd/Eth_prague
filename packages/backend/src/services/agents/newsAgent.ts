import { ApifyClient } from "apify-client";
import type { ScraperAgent, ScraperInput, ScraperResult, NewsArticle } from "./types.js";

// Actor minimum is 100; we trim client-side to keep synthesis input small.
const APIFY_MIN_ITEMS = 100;
const MAX_ITEMS = 5;

// Raw shape returned by easyapi/google-news-scraper
interface ApifyNewsItem {
  title?: string;
  source?: string;
  link?: string;
  snippet?: string;
  date?: string;
  date_utc?: string;
  [key: string]: unknown;
}

function mapToNewsArticle(item: ApifyNewsItem): NewsArticle {
  return {
    title:   item.title   ?? "(no title)",
    source:  item.source  ?? "(unknown source)",
    url:     item.link    ?? "",
    snippet: item.snippet ?? "",
    date:    item.date_utc ?? item.date ?? "",
  };
}

// ── Real Apify call ────────────────────────────────────────────────────────
// SWAP POINT fulfilled: was mock, now calls easyapi/google-news-scraper.
// To revert to mocks, restore the previous fetchNewsArticles body.
async function fetchNewsArticles(input: ScraperInput): Promise<NewsArticle[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error("[newsAgent] APIFY_TOKEN is not set — returning empty results");
    return [];
  }

  const { query } = input;
  console.info(`[newsAgent] querying Apify: "${query}" (maxItems=${MAX_ITEMS})`);

  try {
    const client = new ApifyClient({ token });

    const run = await client.actor("easyapi/google-news-scraper").call({
      query,
      maxItems: APIFY_MIN_ITEMS,
      gl: "us",
      hl: "en",
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const articles = (items as ApifyNewsItem[]).slice(0, MAX_ITEMS).map(mapToNewsArticle);

    console.info(`[newsAgent] received ${items.length} results, using top ${articles.length} for "${query}"`);
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
