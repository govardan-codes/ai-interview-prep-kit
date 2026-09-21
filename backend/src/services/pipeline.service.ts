import { crawlCompany } from "./crawler.service";
import { searchPublicDiscussion } from "./search.service";
import { extractRequirements, generateCompanyBrief } from "./extraction.service";
import { generateQuestionsForRequirement } from "./questionGen.service";
import { findUncoveredRequirements } from "./coverage.service";
import { buildSchedule } from "./schedule.service";
import { RateLimitError } from "../lib/gemini";
import type { Kit, Question, Flashcard } from "../types/kit.types";

const MAX_COVERAGE_PASSES = Number(process.env.MAX_COVERAGE_PASSES ?? 3);

export class PipelineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * The single pipeline both the interactive API and the batch entry point
 * (Section 9) call - "the same code your application uses, not a
 * parallel implementation."
 *
 * Sequencing (see README for the full rationale):
 *   1. extract requirements from the pasted JD (no retrieval needed)
 *   2. crawl the company site
 *   3. search for public discussion of their interview process
 *   4. generate the company brief, grounded in what was actually crawled
 *   5. generate questions per-requirement, informed by the interview-process context
 *   6. deterministically check coverage; loop on gaps up to MAX_COVERAGE_PASSES
 *   7. deterministically build the day-by-day schedule
 */
export async function runPipeline(jd: string, companyUrl: string, days: number): Promise<Kit> {
  if (!jd || jd.trim().length === 0) {
    throw new PipelineError("EMPTY_JD", "Job description is empty");
  }

  // Step 1: requirements from pasted text only.
  let requirements;
  try {
    requirements = await extractRequirements(jd);
  } catch (err: any) {
    if (err instanceof RateLimitError) throw new PipelineError("RATE_LIMITED", err.message);
    throw new PipelineError("EXTRACTION_FAILED", err?.message ?? "Requirement extraction failed");
  }

  // Step 2: crawl the company site. Never fatal - an unreachable/thin site
  // produces an honest, sparse brief instead of aborting the run.
  const { pages, skipped } = await crawlCompany(companyUrl);

  // Step 3: public discussion of their interview process. [] is a valid,
  // expected outcome (Section 10), never a failure.
  let companyNameGuess = "the company";
  try {
    companyNameGuess = new URL(companyUrl).hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    /* fall back to placeholder */
  }
  const discussion = await searchPublicDiscussion(companyNameGuess);
  const interviewProcessContext = discussion
    .map((d) => `${d.title}: ${d.snippet}`)
    .join("\n");

  // Step 4: company brief, grounded only in what was actually retrieved.
  const brief = await generateCompanyBrief(companyUrl, pages);

  // Step 5: questions, one call per requirement (not one call for everything).
  let questions: Question[] = [];
  for (const [i, req] of requirements.entries()) {
    try {
      const qs = await generateQuestionsForRequirement(req, interviewProcessContext, `q${i + 1}`);
      questions = questions.concat(qs);
    } catch (err: any) {
      if (err instanceof RateLimitError) throw new PipelineError("RATE_LIMITED", err.message);
      // A single requirement failing to produce questions is recorded as a
      // gap and closed in the coverage loop below, not a fatal error.
    }
  }

  // Step 6: deterministic coverage check + gap-filling loop.
  let passes = 1;
  let uncovered = findUncoveredRequirements(requirements, questions);
  while (uncovered.length > 0 && passes < MAX_COVERAGE_PASSES) {
    for (const rid of uncovered) {
      const req = requirements.find((r) => r.id === rid);
      if (!req) continue;
      try {
        const qs = await generateQuestionsForRequirement(
          req,
          interviewProcessContext,
          `q-gap${passes}-${req.id}`
        );
        questions = questions.concat(qs);
      } catch {
        // still uncovered - will be reflected honestly in kit.coverage below
      }
    }
    passes += 1;
    uncovered = findUncoveredRequirements(requirements, questions);
  }

  // Step 7: deterministic schedule allocation.
  const scheduleDays = buildSchedule(requirements, questions, days);

  const flashcards: Flashcard[] = questions.map((q, i) => ({
    id: `f${i + 1}`,
    front: q.prompt,
    back: q.answer_outline,
    requirement_ids: q.requirement_ids,
    source: "generated",
    times_reviewed: 0,
  }));

  let title = "";
  let seniority = "";
  const firstLine = jd.split("\n").find((l) => l.trim().length > 0) ?? "";
  title = firstLine.slice(0, 120);

  const kit: Kit = {
    source: {
      company: brief.company,
      company_url: companyUrl,
      role: title,
      location: "",
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: pages.map((p) => p.url),
    },
    company_brief: {
      summary: brief.summary,
      what_they_do: brief.what_they_do,
      sources: pages.map((p) => p.url),
    },
    role: {
      title,
      seniority,
      responsibilities: [],
      requirements,
    },
    questions,
    flashcards,
    schedule: {
      days_available: days,
      days: scheduleDays,
    },
    coverage: {
      uncovered_requirement_ids: uncovered,
      passes,
    },
    research_context: interviewProcessContext,
  };

  // Attach skip info onto pages_used context for transparency; a fuller
  // implementation might store `skipped` on the kit itself (Appendix A
  // doesn't require it, but nothing stops extending the structure).
  if (skipped.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`Crawl skipped ${skipped.length} source(s) for ${companyUrl}:`, skipped);
  }

  return kit;
}
