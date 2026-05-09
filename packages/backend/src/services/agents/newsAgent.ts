import type { ScraperAgent, ScraperInput, ScraperResult, NewsArticle } from "./types.js";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().split("T")[0];
}

function extractTopic(query: string): string {
  const keywords = ["carbon", "recycling", "emissions", "labor", "supply chain", "renewable", "water", "biodiversity", "greenwashing", "ESG"];
  for (const kw of keywords) {
    if (query.toLowerCase().includes(kw.toLowerCase())) return kw;
  }
  return query.split(" ").slice(0, 3).join(" ");
}

// ── Mock news articles — realistic templates using input context ──────────
// SWAP POINT: Replace this function body with an Apify actor call.
// Signature must stay: (input: ScraperInput) => Promise<NewsArticle[]>
async function fetchNewsArticles(input: ScraperInput): Promise<NewsArticle[]> {
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));

  const { company, query } = input;
  const slug = slugify(company);
  const topic = extractTopic(query);

  return [
    {
      title: `${company} ESG Disclosures Draw Scrutiny From Institutional Investors`,
      source: "Reuters",
      url: `https://reuters.com/business/sustainable-business/${slug}-esg-scrutiny-${Date.now().toString(36)}`,
      snippet: `Major institutional shareholders of ${company} are demanding clarification on the company's ${topic} metrics after a whistleblower report raised questions about the accuracy of disclosed figures. The company claims a 34% reduction in Scope 2 emissions since 2021, a figure that third-party auditors have been unable to independently verify.`,
      date: daysAgo(3),
    },
    {
      title: `Analysts Flag Inconsistencies in ${company}'s Sustainability Reporting`,
      source: "Financial Times",
      url: `https://ft.com/content/${slug}-sustainability-${Date.now().toString(36)}`,
      snippet: `A new analysis by ESG research firm Sustainalytics identifies material gaps in ${company}'s ${topic} disclosures for fiscal years 2022 and 2023. The report notes that the company's self-reported recycling rates differ by as much as 19 percentage points from municipal waste processor data in the same regions.`,
      date: daysAgo(9),
    },
    {
      title: `${company} Defends ESG Record Amid Growing Regulatory Pressure`,
      source: "Bloomberg",
      url: `https://bloomberg.com/news/${slug}-esg-defense-${Date.now().toString(36)}`,
      snippet: `In response to investor criticism, ${company} issued a statement reaffirming the accuracy of its sustainability disclosures and announcing an independent review by Deloitte. The SEC is reportedly reviewing whether the company's ${topic} claims meet new climate disclosure rules that took effect this year.`,
      date: daysAgo(17),
    },
  ];
}

export const newsAgent: ScraperAgent = {
  async run(input: ScraperInput): Promise<ScraperResult> {
    const articles = await fetchNewsArticles(input);
    return { agentId: "news", input, articles };
  },
};
