import { z } from "zod";

// Runtime validation for Appendix A. Used (a) before saving any generated
// kit via the API, and (b) inside the batch entry point before writing
// kits.json, so a malformed LLM response never reaches storage or output.

export const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()),
  category: z.enum([
    "technical",
    "behavioural",
    "system-design",
    "company-fit",
  ]),
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  source: z.enum(["generated", "edited", "manual"]).optional(),
});

export const flashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string(),
  requirement_ids: z.array(z.string()),
  source: z.enum(["generated", "edited", "manual"]).optional(),
  last_confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  times_reviewed: z.number().optional(),
});

export const scheduleDaySchema = z.object({
  day: z.number().int().positive(),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int().nonnegative(),
});

export const kitSchema = z.object({
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int().nonnegative(),
    researched_at: z.string(),
    pages_used: z.array(z.string()),
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(requirementSchema),
  }),
  questions: z.array(questionSchema),
  flashcards: z.array(flashcardSchema),
  schedule: z.object({
    days_available: z.number().int().positive(),
    days: z.array(scheduleDaySchema),
  }),
  coverage: z.object({
    uncovered_requirement_ids: z.array(z.string()),
    passes: z.number().int().nonnegative(),
  }),
});

/**
 * Cross-field checks zod alone can't express:
 * every question_ids entry in the schedule must reference a real question.
 */
export function validateKitReferences(kit: z.infer<typeof kitSchema>): string[] {
  const problems: string[] = [];
  const questionIds = new Set(kit.questions.map((q) => q.id));
  const requirementIds = new Set(kit.role.requirements.map((r) => r.id));

  for (const day of kit.schedule.days) {
    for (const qid of day.question_ids) {
      if (!questionIds.has(qid)) {
        problems.push(`schedule day ${day.day} references unknown question_id "${qid}"`);
      }
    }
  }
  for (const q of kit.questions) {
    for (const rid of q.requirement_ids) {
      if (!requirementIds.has(rid)) {
        problems.push(`question ${q.id} references unknown requirement_id "${rid}"`);
      }
    }
  }
  return problems;
}
