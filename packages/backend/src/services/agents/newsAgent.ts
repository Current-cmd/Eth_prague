import { ApifyClient } from "apify-client";
import { payAndCallActor } from "../payments/x402Client.js";
import type { ScraperAgent, ScraperInput, ScraperResult, NewsArticle } from "./types.js";

const MAX_ITEMS = 5;

// Raw shape returned by apify/google-search-scraper dataset items.
// Each item represents one results page with an organicResults array.
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
    date:    "",   // apify/google-search-scraper does not return a date field
  };
}

function extractArticles(items: unknown[]): NewsArticle[] {
  const organic: OrganicResult[] = (items as ApifySearchPage[]).flatMap(
    (page) => page.organicResults ?? []
  );
  const articles = organic.slice(0, MAX_ITEMS).map(mapToNewsArticle);
  if (items.length > 0) {
    const first = items[0] as ApifySearchPage;
    console.debug(`[newsAgent] raw item keys: ${Object.keys(first).join(", ")}`);
    console.debug(`[newsAgent] organicResults count: ${first.organicResults?.length ?? 0}`);
  }
  return articles;
}

// ── x402 path ──────────────────────────────────────────────────────────────
// Used when X402_ENABLED=true (default). Throws loudly on any failure —
// no silent fallback. The caller's try/catch handles the error.

async function fetchViaX402(
  input: ScraperInput
): Promise<{ articles: NewsArticle[]; paymentInfo: { amountUsd: string; signed: boolean } }> {
  const { query } = input;
  console.info(`[newsAgent] querying via x402: "${query}"`);

  const { items, paymentInfo } = await payAndCallActor("apify/google-search-scraper", {
    queries:          query,
    resultsPerPage:   10,
    maxPagesPerQuery: 1,
    countryCode:      "us",
  });

  const articles = extractArticles(items);
  console.info(`[newsAgent] x402 returned ${articles.length} article(s) for "${query}"`);
  return { articles, paymentInfo };
}

// ── Apify token path ───────────────────────────────────────────────────────
// Used only when X402_ENABLED=false (manual demo-day escape hatch).

async function fetchViaToken(input: ScraperInput): Promise<NewsArticle[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error("[newsAgent] APIFY_TOKEN is not set — returning empty results");
    return [];
  }

  const { query } = input;
  console.info(`[newsAgent] querying Apify (token path, x402 disabled): "${query}"`);

  const client = new ApifyClient({ token });
  const run = await client.actor("apify/google-search-scraper").call({
    queries:          query,
    resultsPerPage:   10,
    maxPagesPerQuery: 1,
    countryCode:      "us",
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const articles = extractArticles(items as unknown[]);
  console.info(`[newsAgent] token path returned ${articles.length} article(s) for "${query}"`);
  return articles;
}

// ── Agent export ───────────────────────────────────────────────────────────

export const newsAgent: ScraperAgent = {
  async run(input: ScraperInput): Promise<ScraperResult> {
    const x402Enabled = process.env.X402_ENABLED !== "false";

    if (x402Enabled) {
      try {
        const { articles, paymentInfo } = await fetchViaX402(input);
        return { agentId: "news", input, articles, paymentInfo };
      } catch (err) {
        console.warn(`[newsAgent] x402 failed, falling back to token path: ${err}`);
      }
    }

    // Token fallback — used when x402 is disabled or when x402 throws
    const articles = await fetchViaToken(input);
    return { agentId: "news", input, articles };
  },
};
