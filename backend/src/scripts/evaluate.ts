import "dotenv/config";
import fs from "fs";
import path from "path";
import { runPipeline, PipelineError } from "../services/pipeline.service";
import { kitSchema, validateKitReferences } from "../lib/kitSchema";
import type { BatchCase, BatchKitResult, BatchOutput } from "../types/kit.types";

/**
 * Mandatory batch entry point (Section 9):
 *   npm run evaluate -- --input <cases.json> --output <kits.json>
 *
 * Runs the SAME pipeline the API uses (services/pipeline.service.ts) on
 * each case, continues past individual failures, and writes the exact
 * shape specified in Appendix B.
 */

function parseArgs(argv: string[]): { input: string; output: string } {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input") args.input = argv[++i];
    if (argv[i] === "--output") args.output = argv[++i];
  }
  if (!args.input || !args.output) {
    throw new Error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
  }
  return { input: args.input, output: args.output };
}

async function runCase(c: BatchCase): Promise<BatchKitResult> {
  try {
    if (!c.jd || !c.company_url || !c.days) {
      return {
        id: c.id,
        status: "failed",
        kit: null,
        error: { code: "INVALID_CASE", message: "Case is missing jd, company_url, or days" },
      };
    }

    const kit = await runPipeline(c.jd, c.company_url, c.days);

    const parsed = kitSchema.safeParse(kit);
    if (!parsed.success) {
      return {
        id: c.id,
        status: "failed",
        kit: null,
        error: {
          code: "INVALID_KIT_STRUCTURE",
          message: `Generated kit failed schema validation: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
        },
      };
    }
    const refProblems = validateKitReferences(parsed.data);
    if (refProblems.length > 0) {
      return {
        id: c.id,
        status: "failed",
        kit: null,
        error: { code: "INVALID_KIT_REFERENCES", message: refProblems.join("; ") },
      };
    }

    return { id: c.id, status: "ok", kit: parsed.data, error: null };
  } catch (err) {
    if (err instanceof PipelineError) {
      return { id: c.id, status: "failed", kit: null, error: { code: err.code, message: err.message } };
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return { id: c.id, status: "failed", kit: null, error: { code: "UNKNOWN_ERROR", message } };
  }
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));

  const inputPath = path.resolve(process.cwd(), input);
  const raw = fs.readFileSync(inputPath, "utf-8");
  const cases: BatchCase[] = JSON.parse(raw);

  const results: BatchKitResult[] = [];
  for (const c of cases) {
    // eslint-disable-next-line no-console
    console.log(`Running case ${c.id}...`);
    const result = await runCase(c);
    results.push(result);
    // eslint-disable-next-line no-console
    console.log(`  -> ${result.status}${result.error ? ` (${result.error.code}: ${result.error.message})` : ""}`);
  }

  const out: BatchOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  const outputPath = path.resolve(process.cwd(), output);
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${results.length} result(s) to ${outputPath}`);

  const failed = results.filter((r) => r.status === "failed").length;
  process.exit(failed === cases.length && cases.length > 0 ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error running batch evaluation:", err);
  process.exit(1);
});
