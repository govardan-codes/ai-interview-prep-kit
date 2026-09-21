import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  // Fail loudly at startup rather than mysteriously at first request.
  // eslint-disable-next-line no-console
  console.warn("GEMINI_API_KEY is not set - LLM calls will fail.");
}

// @google/generative-ai was deprecated and archived by Google in Dec 2025;
// @google/genai is the current, supported SDK. gemini-1.5-flash has since
// been fully retired (calls return model-not-found) - gemini-2.5-flash is
// the current free-tier Flash model. Override via GEMINI_MODEL if Google
// ships a newer default before you submit.
const genAI = new GoogleGenAI({ apiKey: apiKey ?? "" });
const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Calls Gemini with retry + exponential backoff on rate limiting/transient
 * failures. Free tiers limit tokens-per-minute as well as requests, so a
 * single 429 must not take down a whole batch run.
 */
export async function callGemini(
  prompt: string,
  { maxRetries = 4, baseDelayMs = 2000 }: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: prompt,
      });
      const text = result.text;
      if (!text) {
        throw new Error("Gemini returned an empty response");
      }
      return text;
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.response?.status;
      const isRateLimit = status === 429;
      const isTransient = status === 503 || status === 500;

      if ((isRateLimit || isTransient) && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }
      throw isRateLimit
        ? new RateLimitError(`Gemini rate-limited after ${attempt + 1} attempts`)
        : err;
    }
  }
  throw lastError;
}

/**
 * Strips markdown code fences models sometimes wrap JSON in, then parses.
 * Throws a descriptive error on invalid JSON so callers can treat it as a
 * "model returned invalid JSON" failure rather than crashing.
 */
export function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(`Model returned invalid JSON: ${(err as Error).message}`);
  }
}
