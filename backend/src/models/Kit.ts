import { Schema, model, Document, Types } from "mongoose";

// Mongoose mirror of Appendix A, plus ownerId and the generated/edited/
// manual bookkeeping the builder needs to protect hand-edits across
// regeneration (see README "State: generated / edited / pinned").

const RequirementSchema = new Schema(
  {
    id: String,
    text: String,
    kind: { type: String, enum: ["technical", "behavioural", "domain"] },
    priority: { type: String, enum: ["must", "nice"] },
  },
  { _id: false }
);

const QuestionSchema = new Schema(
  {
    id: String,
    requirement_ids: [String],
    category: {
      type: String,
      enum: ["technical", "behavioural", "system-design", "company-fit"],
    },
    prompt: String,
    answer_outline: String,
    difficulty: { type: Number, enum: [1, 2, 3] },
    source: { type: String, enum: ["generated", "edited", "manual"], default: "generated" },
  },
  { _id: false }
);

const FlashcardSchema = new Schema(
  {
    id: String,
    front: String,
    back: String,
    requirement_ids: [String],
    source: { type: String, enum: ["generated", "edited", "manual"], default: "generated" },
    last_confidence: { type: Number, enum: [1, 2, 3] },
    times_reviewed: { type: Number, default: 0 },
  },
  { _id: false }
);

const ScheduleDaySchema = new Schema(
  {
    day: Number,
    focus: String,
    question_ids: [String],
    minutes: Number,
  },
  { _id: false }
);

const KitSchema = new Schema(
  {
    ownerId: { type: Types.ObjectId, ref: "User", required: true, index: true },

    source: {
      company: String,
      company_url: String,
      role: String,
      location: String,
      jd_chars: Number,
      researched_at: String,
      pages_used: [String],
    },
    company_brief: {
      summary: String,
      what_they_do: String,
      sources: [String],
    },
    role: {
      title: String,
      seniority: String,
      responsibilities: [String],
      requirements: [RequirementSchema],
    },
    questions: [QuestionSchema],
    flashcards: [FlashcardSchema],
    schedule: {
      days_available: Number,
      days: [ScheduleDaySchema],
    },
    coverage: {
      uncovered_requirement_ids: [String],
      passes: Number,
    },
    // Extension beyond Appendix A - see kit.types.ts. Not part of the
    // validated/output structure; used only so the builder's "regenerate
    // one question category" keeps the original company context.
    research_context: { type: String, default: "" },
  },
  { timestamps: true }
);

export interface KitDocument extends Document {
  ownerId: Types.ObjectId;
  [key: string]: any;
}

export const KitModel = model<KitDocument>("Kit", KitSchema);
