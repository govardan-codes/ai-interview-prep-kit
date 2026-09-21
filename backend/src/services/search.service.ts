import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENT = "AIInterviewPrepKitBot/1.0 (+assessment)";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Looks for public discussion of a company's interview process using
 * DuckDuckGo's HTML endpoint (no API key required - fits the "free tier
 * only, no key supplied" constraint). Returns [] rather than throwing on
 * failure, since "public discussion turns up nothing" is an explicit,
 * expected edge case (Section 10) - not a pipeline failure.
 */
export async function searchPublicDiscussion(companyName: string): Promise<SearchResult[]> {
  const query = `${companyName} interview process questions glassdoor OR blind OR reddit`;
  try {
    const res = await axios.get("https://html.duckduckgo.com/html/", {
      params: { q: query },
      timeout: 8000,
      headers: { "User-Agent": USER_AGENT },
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) return [];

    const $ = cheerio.load(res.data as string);
    const results: SearchResult[] = [];
    $(".result").each((_, el) => {
      if (results.length >= 5) return;
      const title = $(el).find(".result__title").text().trim();
      const url = $(el).find(".result__a").attr("href") ?? "";
      const snippet = $(el).find(".result__snippet").text().trim();
      if (title && url) results.push({ title, url, snippet });
    });
    return results;
  } catch {
    return [];
  }
}
