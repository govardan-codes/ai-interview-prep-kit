import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { KitModel } from "../models/Kit";
import { runPipeline, PipelineError } from "../services/pipeline.service";
import { kitSchema, validateKitReferences } from "../lib/kitSchema";
import { crawlCompany } from "../services/crawler.service";
import { generateCompanyBrief } from "../services/extraction.service";
import { generateQuestionsForRequirement } from "../services/questionGen.service";
import { buildSchedule } from "../services/schedule.service";
import { partitionQuestionsForRegeneration } from "../services/regeneration.service";
import { RateLimitError } from "../lib/gemini";
import type { Question, QuestionCategory } from "../types/kit.types";

const QUESTION_CATEGORIES: QuestionCategory[] = [
  "technical",
  "behavioural",
  "system-design",
  "company-fit",
];

export async function createKit(req: AuthedRequest, res: Response) {
  const { jd, company_url, days } = req.body ?? {};
  if (!jd || !company_url || !days) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "jd, company_url and days are required" } });
  }

  // Duplicate-submission guard (Section 10): same owner, same jd + company_url.
  const existing = await KitModel.findOne({
    ownerId: req.userId,
    "source.company_url": company_url,
    "role.title": { $exists: true },
  }).where({ "source.jd_chars": jd.length });
  if (existing) {
    return res.status(200).json({ kit: existing, note: "An existing kit for this description and company was found; returning it instead of regenerating." });
  }

  try {
    const kit = await runPipeline(jd, company_url, Number(days));

    const parsed = kitSchema.safeParse(kit);
    if (!parsed.success) {
      return res.status(502).json({
        error: { code: "INVALID_KIT_STRUCTURE", message: "Generated kit failed structural validation", details: parsed.error.issues },
      });
    }
    const refProblems = validateKitReferences(parsed.data);
    if (refProblems.length > 0) {
      return res.status(502).json({ error: { code: "INVALID_KIT_REFERENCES", message: refProblems.join("; ") } });
    }

    const saved = await KitModel.create({ ownerId: req.userId, ...kit });
    res.status(201).json({ kit: saved });
  } catch (err) {
    if (err instanceof PipelineError) {
      const status = err.code === "RATE_LIMITED" ? 429 : 502;
      return res.status(status).json({ error: { code: err.code, message: err.message } });
    }
    throw err;
  }
}

export async function listKits(req: AuthedRequest, res: Response) {
  const kits = await KitModel.find({ ownerId: req.userId }).sort({ createdAt: -1 });
  res.json({ kits });
}

export async function getKit(req: AuthedRequest, res: Response) {
  const kit = await KitModel.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!kit) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found" } });
  res.json({ kit });
}

/**
 * General-purpose patch for the builder: edit/reorder/add/delete any
 * question, flashcard, or brief field. The frontend sends the full
 * updated sub-section; anything the user touches gets source: "edited"
 * (or "manual" for brand-new items) so a later section regeneration
 * knows to leave it alone.
 */
export async function updateKit(req: AuthedRequest, res: Response) {
  const kit = await KitModel.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!kit) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found" } });

  const allowedSections = ["company_brief", "role", "questions", "flashcards", "schedule"];
  for (const key of allowedSections) {
    if (req.body?.[key] !== undefined) {
      (kit as any)[key] = req.body[key];
    }
  }
  await kit.save();
  res.json({ kit });
}

/**
 * Regenerates a single section without discarding user edits.
 *
 * - "questions": optionally scoped to one `category` (one of the four
 *   QuestionCategory values from Appendix A). Any question outside the
 *   target scope (wrong category, when one is given) is left completely
 *   untouched. Within scope, anything the user has touched (source
 *   "edited" or "manual") is preserved as-is; only "generated" questions
 *   are replaced, one fresh call per requirement that had a generated
 *   question in scope - reusing the kit's original research_context so
 *   regenerated questions stay grounded in the company's actual interview
 *   process rather than falling back to generic ones.
 * - "company_brief": re-crawls the company site (the site may have
 *   changed since the kit was first generated) and regenerates the brief
 *   from scratch. The brief has no per-field edit tracking in Appendix A,
 *   so an explicit "regenerate the brief" action is taken as intentional
 *   full replacement - it does not touch questions, flashcards or the
 *   schedule.
 * - "schedule": purely deterministic (per the brief, this is arithmetic
 *   that belongs in code, not a model call) - rebuilt from the kit's
 *   current requirements and questions, so edits made to either are
 *   reflected. Accepts an optional `days` override in the request body to
 *   reschedule across a different number of days; otherwise keeps the
 *   kit's existing days_available.
 */
export async function regenerateSection(req: AuthedRequest, res: Response) {
  const kit = await KitModel.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!kit) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found" } });

  const { section, category, days } = req.body ?? {};
  if (!["company_brief", "questions", "schedule"].includes(section)) {
    return res.status(400).json({
      error: { code: "INVALID_SECTION", message: "section must be company_brief, questions, or schedule" },
    });
  }
  if (category !== undefined && !QUESTION_CATEGORIES.includes(category)) {
    return res.status(400).json({
      error: { code: "INVALID_CATEGORY", message: `category must be one of ${QUESTION_CATEGORIES.join(", ")}` },
    });
  }

  try {
    if (section === "questions") {
      const allQuestions: Question[] = (kit as any).questions;
      const { preserved, staleRequirementIds } = partitionQuestionsForRegeneration(
        allQuestions,
        category as QuestionCategory | undefined
      );

      const requirements = (kit as any).role.requirements;
      const toRegenerate = requirements.filter((r: any) => staleRequirementIds.includes(r.id));
      const context = (kit as any).research_context ?? "";

      let fresh: Question[] = [];
      for (const [i, requirement] of toRegenerate.entries()) {
        const qs = await generateQuestionsForRequirement(
          requirement,
          context,
          `regen-${Date.now()}-${i}`,
          category as QuestionCategory | undefined
        );
        fresh = fresh.concat(qs);
      }
      (kit as any).questions = [...preserved, ...fresh];
    } else if (section === "company_brief") {
      const companyUrl = (kit as any).source.company_url;
      const { pages } = await crawlCompany(companyUrl);
      const brief = await generateCompanyBrief(companyUrl, pages);
      (kit as any).company_brief = {
        summary: brief.summary,
        what_they_do: brief.what_they_do,
        sources: pages.map((p) => p.url),
      };
      (kit as any).source.pages_used = pages.map((p) => p.url);
    } else if (section === "schedule") {
      const daysAvailable = days ? Number(days) : (kit as any).schedule.days_available;
      const scheduleDays = buildSchedule((kit as any).role.requirements, (kit as any).questions, daysAvailable);
      (kit as any).schedule = { days_available: daysAvailable, days: scheduleDays };
    }
  } catch (err: any) {
    if (err instanceof RateLimitError) {
      return res.status(429).json({ error: { code: "RATE_LIMITED", message: err.message } });
    }
    return res.status(502).json({
      error: { code: "REGENERATION_FAILED", message: err?.message ?? "Failed to regenerate section" },
    });
  }

  await kit.save();
  res.json({ kit });
}
