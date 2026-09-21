import { partitionQuestionsForRegeneration } from "../services/regeneration.service";
import type { Question } from "../types/kit.types";

const q = (
  id: string,
  requirement_ids: string[],
  category: Question["category"],
  source: Question["source"]
): Question => ({
  id,
  requirement_ids,
  category,
  prompt: `prompt ${id}`,
  answer_outline: "outline",
  difficulty: 1,
  source,
});

test("no category: preserves edited/manual, marks generated requirements stale", () => {
  const questions = [
    q("q1", ["r1"], "technical", "generated"),
    q("q2", ["r2"], "behavioural", "edited"),
    q("q3", ["r3"], "technical", "manual"),
  ];
  const { preserved, staleRequirementIds } = partitionQuestionsForRegeneration(questions);
  expect(preserved.map((x) => x.id)).toEqual(["q2", "q3"]);
  expect(staleRequirementIds).toEqual(["r1"]);
});

test("category scope: questions outside the category are always preserved, even if generated", () => {
  const questions = [
    q("q1", ["r1"], "technical", "generated"),
    q("q2", ["r2"], "behavioural", "generated"),
  ];
  const { preserved, staleRequirementIds } = partitionQuestionsForRegeneration(questions, "technical");
  expect(preserved.map((x) => x.id)).toEqual(["q2"]);
  expect(staleRequirementIds).toEqual(["r1"]);
});

test("category scope: a hand-edited question in-scope is preserved and its requirement is not marked stale", () => {
  const questions = [
    q("q1", ["r1"], "technical", "edited"),
    q("q2", ["r1"], "technical", "generated"),
  ];
  // r1 has BOTH an edited technical question and a generated technical
  // question - only the generated one should be dropped/regenerated; the
  // edited one must survive regardless.
  const { preserved, staleRequirementIds } = partitionQuestionsForRegeneration(questions, "technical");
  expect(preserved.map((x) => x.id)).toEqual(["q1"]);
  expect(staleRequirementIds).toEqual(["r1"]);
});

test("a manually-added question with no requirement_ids never produces a stale requirement", () => {
  const questions = [q("q1", [], "technical", "manual")];
  const { preserved, staleRequirementIds } = partitionQuestionsForRegeneration(questions, "technical");
  expect(preserved.map((x) => x.id)).toEqual(["q1"]);
  expect(staleRequirementIds).toEqual([]);
});

test("returns no-ops on an empty question list", () => {
  expect(partitionQuestionsForRegeneration([])).toEqual({ preserved: [], staleRequirementIds: [] });
});
