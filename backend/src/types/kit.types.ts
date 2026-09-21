// Mirrors Appendix A exactly. Do not rename these fields.

export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";
export type QuestionCategory =
  | "technical"
  | "behavioural"
  | "system-design"
  | "company-fit";
export type ItemSource = "generated" | "edited" | "manual";

export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

export interface Question {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  // Extension beyond Appendix A: protects hand-edits across regeneration.
  source?: ItemSource;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  source?: ItemSource;
  last_confidence?: 1 | 2 | 3;
  times_reviewed?: number;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
}

export interface Coverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface Kit {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  company_brief: {
    summary: string;
    what_they_do: string;
    sources: string[];
  };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: Coverage;
  // Extension beyond Appendix A (stripped by kitSchema validation, so it
  // never reaches kits.json or the schema comparison): the public-discussion
  // context originally found for this company, persisted so a later
  // "regenerate this question category" doesn't lose company-specific
  // grounding and silently fall back to generic questions.
  research_context?: string;
}

export interface BatchCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

export interface BatchKitResult {
  id: string;
  status: "ok" | "failed";
  kit: Kit | null;
  error: { code: string; message: string } | null;
}

export interface BatchOutput {
  version: string;
  generated_at: string;
  kits: BatchKitResult[];
}

export interface CrawledPage {
  url: string;
  text: string;
}
