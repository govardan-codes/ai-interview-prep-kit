import { buildSchedule } from "../services/schedule.service";
import type { Requirement, Question } from "../types/kit.types";

const req = (id: string, priority: "must" | "nice"): Requirement => ({
  id, text: `req ${id}`, kind: "technical", priority,
});
const q = (id: string, requirement_ids: string[], difficulty: 1 | 2 | 3 = 1): Question => ({
  id, requirement_ids, category: "technical", prompt: "p", answer_outline: "a", difficulty,
});

test("produces exactly the number of days requested", () => {
  const requirements = [req("r1", "must")];
  const questions = [q("q1", ["r1"]), q("q2", ["r1"]), q("q3", ["r1"])];
  const schedule = buildSchedule(requirements, questions, 5);
  expect(schedule).toHaveLength(5);
  expect(schedule.map((d) => d.day)).toEqual([1, 2, 3, 4, 5]);
});

test("every must-have requirement's question appears somewhere in the schedule", () => {
  const requirements = [req("r1", "must"), req("r2", "must")];
  const questions = [q("q1", ["r1"]), q("q2", ["r2"])];
  const schedule = buildSchedule(requirements, questions, 3);
  const allIds = schedule.flatMap((d) => d.question_ids);
  expect(allIds).toContain("q1");
  expect(allIds).toContain("q2");
});

test("handles a 1-day schedule", () => {
  const requirements = [req("r1", "must")];
  const questions = [q("q1", ["r1"]), q("q2", ["r1"])];
  const schedule = buildSchedule(requirements, questions, 1);
  expect(schedule).toHaveLength(1);
});

test("harder questions are placed on earlier days", () => {
  const requirements = [req("r1", "must")];
  const questions = [
    q("easy", ["r1"], 1),
    q("hard", ["r1"], 3),
  ];
  const schedule = buildSchedule(requirements, questions, 2);
  const dayOfHard = schedule.find((d) => d.question_ids.includes("hard"))?.day ?? 99;
  const dayOfEasy = schedule.find((d) => d.question_ids.includes("easy"))?.day ?? 0;
  expect(dayOfHard).toBeLessThanOrEqual(dayOfEasy);
});
