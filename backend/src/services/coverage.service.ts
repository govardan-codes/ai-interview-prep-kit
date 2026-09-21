import type { Requirement, Question } from "../types/kit.types";

/**
 * Deterministic coverage check (explicitly NOT the model's decision per
 * the brief): a requirement is "covered" if at least one question
 * references its id. Only must-have requirements count toward failure -
 * missing "nice" coverage is not a gap worth forcing another pass over.
 */
export function findUncoveredRequirements(
  requirements: Requirement[],
  questions: Question[]
): string[] {
  const covered = new Set<string>();
  for (const q of questions) {
    for (const rid of q.requirement_ids) covered.add(rid);
  }
  return requirements
    .filter((r) => r.priority === "must" && !covered.has(r.id))
    .map((r) => r.id);
}
