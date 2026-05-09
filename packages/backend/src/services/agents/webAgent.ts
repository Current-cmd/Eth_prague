import type { ScraperAgent, ScraperInput, ScraperResult, WebPage } from "./types.js";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/\s+/g, "");
}

// ── Mock website pages — realistic corporate ESG page content ────────────
// SWAP POINT: Replace this function body with an Apify website-content-crawler call.
// Signature must stay: (input: ScraperInput) => Promise<WebPage[]>
async function fetchWebPages(input: ScraperInput): Promise<WebPage[]> {
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));

  const { company } = input;
  const domain = `${slugify(company)}.com`;

  return [
    {
      url: `https://www.${domain}/sustainability/2024-report`,
      title: `${company} 2024 Sustainability Report`,
      excerpt: `${company} is proud to report significant progress toward our 2030 sustainability targets. Highlights include: Scope 1 & 2 emissions reduced by 31% versus our 2019 baseline. Renewable energy now accounts for 78% of total electricity consumption across all owned facilities. Our Zero-Waste-to-Landfill program achieved a diversion rate of 94% globally, up from 87% in 2023. We maintained our MSCI ESG rating of AA for the third consecutive year.`,
    },
    {
      url: `https://www.${domain}/esg/metrics`,
      title: `${company} ESG Key Performance Indicators`,
      excerpt: `FY2024 KPIs — Environmental: Total GHG emissions (Scope 1+2): 142,000 tCO2e | Water withdrawal: 1.8M m³ | Waste recycled: 89% | Hazardous waste: 340 tonnes. Social: Total workforce: 28,400 | Lost Time Incident Rate: 0.31 | Employee engagement score: 74% | Women in senior leadership: 41%. Governance: Board independence: 85% | ESG-linked executive compensation: Yes (15% of annual bonus).`,
    },
  ];
}

export const webAgent: ScraperAgent = {
  async run(input: ScraperInput): Promise<ScraperResult> {
    const pages = await fetchWebPages(input);
    return { agentId: "web", input, pages };
  },
};
