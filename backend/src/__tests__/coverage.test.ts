import { findUncoveredRequirements } from "../services/coverage.service";
import type { Requirement, Question } from "../types/kit.types";

const req = (id: string, priority: "must" | "nice"): Requirement => ({
  id, text: `req ${id}`, kind: "technical", priority,
});
const q = (id: string, requirement_ids: string[]): Question => ({
  id, requirement_ids, category: "technical", prompt: "p", answer_outline: "a", difficulty: 1,
});

test("flags a must-have requirement with no question", () => {
  const requirements = [req("r1", "must"), req("r2", "must")];
  const questions = [q("q1", ["r1"])];
  expect(findUncoveredRequirements(requirements, questions)).toEqual(["r2"]);
});

test("does not flag nice-to-have requirements with no question", () => {
  const requirements = [req("r1", "must"), req("r2", "nice")];
  const questions = [q("q1", ["r1"])];
  expect(findUncoveredRequirements(requirements, questions)).toEqual([]);
});

test("returns empty when everything is covered", () => {
  const requirements = [req("r1", "must")];
  const questions = [q("q1", ["r1"])];
  expect(findUncoveredRequirements(requirements, questions)).toEqual([]);
});
