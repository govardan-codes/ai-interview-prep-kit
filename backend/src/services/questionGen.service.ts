import { callGemini, parseJsonResponse } from "../lib/gemini";
import type { Question, Requirement, QuestionCategory } from "../types/kit.types";

interface RawQuestion {
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
}

/**
 * Generates questions for ONE requirement at a time (per the brief: a
 * requirement like "5 years React" should not be generated in the same
 * call, with the same instructions, as "mentoring junior engineers" -
 * the first wants technical questions, the second behavioural).
 * `interviewProcessContext` folds in whatever was found about the
 * company's actual interview stages, so a company known to run a
 * take-home + system-design round produces different questions than one
 * where nothing was found.
 */
export async function generateQuestionsForRequirement(
  requirement: Requirement,
  interviewProcessContext: string,
  idPrefix: string,
  forcedCategory?: QuestionCategory
): Promise<Question[]> {
  const suggestedCategory: QuestionCategory =
    forcedCategory ?? (requirement.kind === "behavioural" ? "behavioural" : "technical");

  const prompt = `Generate interview questions for a single job requirement.

Requirement: "${requirement.text}"
Requirement type: ${requirement.kind}
Priority: ${requirement.priority}

${interviewProcessContext
    ? `Known context about this company's actual interview process (use it to shape the questions - e.g. include a system-design question only if their process actually has that round):\n${interviewProcessContext.slice(0, 2000)}`
    : "No specific information was found about this company's interview process - generate general but relevant questions for this requirement."
  }

Generate 2-3 questions. ${
    forcedCategory
      ? `Every question MUST be in the "${forcedCategory}" category - do not use any other category, even if another category would otherwise seem more natural for this requirement.`
      : `Lean toward "${suggestedCategory}" for this requirement, but use "system-design" or "company-fit" if genuinely more appropriate given the context above.`
  }

Respond with ONLY a JSON array, no markdown fences:
[{ "category": "technical", "prompt": "...", "answer_outline": "2-3 sentence outline of a strong answer", "difficulty": 2 }]`;

  const raw = await callGemini(prompt);
  const parsed = parseJsonResponse<RawQuestion[]>(raw);

  return parsed.map((q, i) => ({
    id: `${idPrefix}-${i + 1}`,
    requirement_ids: [requirement.id],
    // Defensive: enforce the forced category ourselves rather than trusting
    // the model to have followed the instruction above.
    category: forcedCategory ?? q.category,
    prompt: q.prompt,
    answer_outline: q.answer_outline,
    difficulty: q.difficulty,
    source: "generated",
  }));
}
