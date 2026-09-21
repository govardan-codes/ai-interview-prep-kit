import { kitSchema, validateKitReferences } from "../lib/kitSchema";

const validKit = {
  source: { company: "Acme", company_url: "https://acme.com", role: "SWE", location: "",
    jd_chars: 100, researched_at: new Date().toISOString(), pages_used: ["https://acme.com"] },
  company_brief: { summary: "s", what_they_do: "w", sources: ["https://acme.com"] },
  role: { title: "SWE", seniority: "mid", responsibilities: [], requirements: [
    { id: "r1", text: "React", kind: "technical", priority: "must" },
  ]},
  questions: [
    { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "p", answer_outline: "a", difficulty: 2 },
  ],
  flashcards: [],
  schedule: { days_available: 1, days: [{ day: 1, focus: "f", question_ids: ["q1"], minutes: 60 }] },
  coverage: { uncovered_requirement_ids: [], passes: 1 },
};

test("accepts a well-formed kit", () => {
  expect(kitSchema.safeParse(validKit).success).toBe(true);
});

test("rejects a kit with a bad requirement priority", () => {
  const bad = { ...validKit, role: { ...validKit.role, requirements: [{ id: "r1", text: "x", kind: "technical", priority: "sometimes" }] } };
  expect(kitSchema.safeParse(bad).success).toBe(false);
});

test("flags a schedule referencing a question id that doesn't exist", () => {
  const bad = { ...validKit, schedule: { days_available: 1, days: [{ day: 1, focus: "f", question_ids: ["ghost"], minutes: 60 }] } };
  const parsed = kitSchema.parse(bad);
  expect(validateKitReferences(parsed).length).toBeGreaterThan(0);
});
