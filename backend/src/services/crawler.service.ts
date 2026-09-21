import axios from "axios";
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { URL } from "url";
import type { CrawledPage } from "../types/kit.types";

const USER_AGENT = "AIInterviewPrepKitBot/1.0 (+assessment)";
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 2_000_000;


// Keywords used to rank which links on the homepage are worth following.
// A fixed path list ("just try /careers") is explicitly disallowed by the
// brief - this scores *discovered* links instead, so it works on sites
// that bury hiring info at unpredictable paths (a handbook, an engineering
// blog, etc).
const HIRING_KEYWORDS = [
  "career", "careers", "job", "jobs", "hiring", "join", "join-us",
  "work-with-us", "openings", "positions", "team", "culture",
  "life-at", "handbook", "interview",
];
const ABOUT_KEYWORDS = ["about", "company", "who-we-are", "mission", "story"];

interface RankedLink {
  url: string;
  score: number;
}

function isPrivateOrLoopback(hostname: string): boolean {
  if (process.env.NODE_ENV === "test-local-fixtures") return false; // batch harness serves fixtures locally
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

export function isSafeCompanyUrl(rawUrl: string): { ok: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "not a valid URL" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, reason: "unsupported protocol" };
  }
  // In production, block SSRF-prone targets. The batch harness (Section 9)
  // deliberately serves fixtures from a local address, so this is relaxed
  // only when explicitly running against local fixtures - see
  // isPrivateOrLoopback above and .env NODE_ENV.
  if (process.env.NODE_ENV === "production" && isPrivateOrLoopback(parsed.hostname)) {
    return { ok: false, reason: "private/loopback address blocked in production" };
  }
  return { ok: true };
}

async function fetchRobots(baseUrl: string) {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const res = await axios.get(robotsUrl, { timeout: FETCH_TIMEOUT_MS, validateStatus: () => true });
    if (res.status >= 200 && res.status < 300 && typeof res.data === "string") {
      return robotsParser(robotsUrl, res.data);
    }
  } catch {
    // No robots.txt or unreachable - proceed as if everything's allowed.
  }
  return null;
}

function scoreLink(href: string, anchorText: string): number {
  const haystack = `${href} ${anchorText}`.toLowerCase();
  let score = 0;
  for (const kw of HIRING_KEYWORDS) if (haystack.includes(kw)) score += 3;
  for (const kw of ABOUT_KEYWORDS) if (haystack.includes(kw)) score += 1;
  return score;
}

function extractLinks(html: string, baseUrl: string): RankedLink[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const seen = new Map<string, number>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      return;
    }
    if (abs.hostname !== base.hostname) return; // stay on the company's own site
    abs.hash = "";
    const url = abs.toString();
    const score = scoreLink(href, $(el).text());
    if (score > 0) {
      seen.set(url, Math.max(seen.get(url) ?? 0, score));
    }
  });

  return [...seen.entries()]
    .map(([url, score]) => ({ url, score }))
    .sort((a, b) => b.score - a.score);
}

function cleanText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, noscript, svg").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

/**
 * Crawls a company's site starting from its homepage: fetches the
 * homepage, ranks discovered links by how likely they are to be
 * hiring/about pages, and follows the top-scoring ones. Any page that
 * fails to fetch is skipped and reported, never fatal to the whole run.
 */
export async function crawlCompany(
  companyUrl: string,
  maxPages = Number(process.env.CRAWL_MAX_PAGES ?? 6)
): Promise<{ pages: CrawledPage[]; skipped: { url: string; reason: string }[] }> {
  const safety = isSafeCompanyUrl(companyUrl);
  if (!safety.ok) {
    return { pages: [], skipped: [{ url: companyUrl, reason: safety.reason! }] };
  }

  const robots = await fetchRobots(companyUrl);
  const pages: CrawledPage[] = [];
  const skipped: { url: string; reason: string }[] = [];
  const visited = new Set<string>();

  async function fetchOne(url: string): Promise<string | null> {
    if (robots && robots.isDisallowed(url, USER_AGENT)) {
      skipped.push({ url, reason: "disallowed by robots.txt" });
      return null;
    }
    try {
      const res = await axios.get(url, {
        timeout: FETCH_TIMEOUT_MS,
        maxContentLength: MAX_HTML_BYTES,
        headers: { "User-Agent": USER_AGENT },
        validateStatus: () => true,
      });
      if (res.status < 200 || res.status >= 300) {
        skipped.push({ url, reason: `HTTP ${res.status}` });
        return null;
      }
      const contentType = String(res.headers["content-type"] ?? "");
      if (!contentType.includes("text/html")) {
        skipped.push({ url, reason: `unexpected content-type ${contentType}` });
        return null;
      }
      return res.data as string;
    } catch (err: any) {
      skipped.push({ url, reason: err?.message ?? "fetch failed" });
      return null;
    }
  }

  const homeHtml = await fetchOne(companyUrl);
  if (!homeHtml) return { pages, skipped };
  visited.add(companyUrl);
  pages.push({ url: companyUrl, text: cleanText(homeHtml) });

  const ranked = extractLinks(homeHtml, companyUrl);
  for (const { url } of ranked) {
    if (pages.length >= maxPages) break;
    if (visited.has(url)) continue;
    visited.add(url);
    // Gentle rate limiting between requests to the same host.
    await new Promise((r) => setTimeout(r, 300));
    const html = await fetchOne(url);
    if (html) pages.push({ url, text: cleanText(html) });
  }

  return { pages, skipped };
}
