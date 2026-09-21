# AI Interview Prep Kit

Turns a job description + company URL into a structured, editable interview
prep kit: company brief, role breakdown, categorised question bank,
flashcards, and a day-by-day study schedule.

> This README is a starting skeleton. Fill in each section below as you
> build — the assessment specifically asks you to justify your choices, not
> just describe the code.

## Project overview & tech stack

- Frontend: Next.js (App Router) + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Database: MongoDB (Mongoose)
- LLM: Google Gemini (`gemini-1.5-flash` / `gemini-2.0-flash`), via `@google/generative-ai`
- Scraping: `axios` + `cheerio`, own crawler/ranker in `backend/src/services/crawler.service.ts`, `robots-parser` for robots.txt compliance

_Justify anything you change from this._

## Setup

### Local
```bash
npm install
cp backend/.env.example backend/.env   # fill in your own values
npm run dev:backend
npm run dev:frontend
```

### Batch entry point
```bash
cd backend
npm run evaluate -- --input cases.json --output kits.json
```

### Deployed
_TODO: fill in once deployed (e.g. Render/Railway for backend, Vercel for frontend)._

## Architecture

_TODO: diagram or short description of how frontend/backend/db/LLM fit together._

## Retrieval approach & sources

_TODO: describe how the crawler picks candidate pages, what "public discussion"
sources you search, and how you handle robots.txt / rate limiting._

## Research & generation sequencing

Pipeline (`backend/src/services/pipeline.service.ts`) runs in this order:
1. `extractRequirements` — Gemini call over the pasted JD only
2. `crawlCompany` — homepage + ranked link-follow, cheerio text extraction
3. `searchPublicDiscussion` — external search for interview-process discussion
4. `generateCompanyBrief` — Gemini, grounded in crawled pages
5. `generateQuestions` — one call per requirement (not one call for everything)
6. `checkCoverage` — deterministic, in code (`coverage.service.ts`)
7. loop: generate for uncovered requirements, re-check, up to `MAX_COVERAGE_PASSES`
8. `buildSchedule` — deterministic allocation (`schedule.service.ts`)

_TODO: explain any deviations, and why a hiring-process page changes which
questions get generated._

## State: generated / edited / pinned

Each `question`/`flashcard` stored with a `source: "generated" | "edited" | "manual"`
flag (see `backend/src/models/Kit.ts`). Regenerating a section only replaces
items still marked `"generated"`; `"edited"` and `"manual"` items are left alone.

_TODO: confirm this is actually how you implemented it once the builder UI is done, and describe any edge cases (e.g. reordering across categories)._

## Schedule allocation

_TODO: describe the allocation algorithm in `schedule.service.ts` — how difficulty/priority map to day placement._

## Creative feature

_TODO if you build one._

## Key design decisions, trade-offs, known limitations

_TODO._
