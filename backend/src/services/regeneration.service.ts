import type { Question, QuestionCategory } from "../types/kit.types";

/**
 * Deterministic partitioning for "regenerate questions" (optionally scoped
 * to a single category). Deliberately a pure function, separate from the
 * controller and from any LLM call, so it can be unit tested directly -
 * this is the state logic the brief calls "the hardest problem in the
 * assessment."
 *
 * Rules:
 *  - A question outside the requested scope (wrong category, when a
 *    category is given) is always preserved untouched, regardless of
 *    source - regenerating "technical" must not disturb "behavioural".
 *  - Within scope, anything the user has touched (source "edited" or
 *    "manual") is preserved as-is.
 *  - Within scope, "generated" questions are dropped from the kept list;
 *    every requirement any of them referenced is returned as "stale" so
 *    the caller knows which requirements need fresh questions.
 */
export function partitionQuestionsForRegeneration(
  questions: Question[],
  category?: QuestionCategory
): { preserved: Question[]; staleRequirementIds: string[] } {
  const preserved: Question[] = [];
  const staleReqIds = new Set<string>();

  for (const q of questions) {
    const inScope = !category || q.category === category;
    if (!inScope || q.source !== "generated") {
      preserved.push(q);
    } else {
      for (const rid of q.requirement_ids) staleReqIds.add(rid);
    }
  }

  return { preserved, staleRequirementIds: [...staleReqIds] };
}
