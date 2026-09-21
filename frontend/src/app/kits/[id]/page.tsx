"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const QUESTION_CATEGORIES = ["technical", "behavioural", "system-design", "company-fit"] as const;

export default function KitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [kit, setKit] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Which section is currently regenerating, so only that control shows a
  // spinner and the others stay usable/disabled-correctly.
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [scheduleDaysInput, setScheduleDaysInput] = useState<number | "">("");

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.replace("/login"); return; }
    api.getKit(id).then((d) => {
      setKit(d.kit);
      setScheduleDaysInput(d.kit.schedule?.days_available ?? "");
    }).catch((e) => setError(e.message));
  }, [id, router]);

  async function saveQuestionEdit(qid: string, field: "prompt" | "answer_outline", value: string) {
    const updatedQuestions = kit.questions.map((q: any) =>
      q.id === qid ? { ...q, [field]: value, source: "edited" } : q
    );
    setKit({ ...kit, questions: updatedQuestions });
    await api.updateKit(id, { questions: updatedQuestions });
  }

  // Moving a question to a different category is a hand-edit (per Section
  // 6: "move a question from one category to another"), so it's marked
  // "edited" - this both records the user's intent and protects the
  // question from being silently replaced next time its *new* category is
  // regenerated.
  async function moveQuestionCategory(qid: string, category: string) {
    const updatedQuestions = kit.questions.map((q: any) =>
      q.id === qid ? { ...q, category, source: "edited" } : q
    );
    setKit({ ...kit, questions: updatedQuestions });
    await api.updateKit(id, { questions: updatedQuestions });
  }

  // Reordering is a position change only, not a content edit, so it
  // deliberately does NOT flip source to "edited" - otherwise reordering a
  // still-generated question would permanently exempt it from future
  // category regenerations.
  async function moveQuestion(qid: string, direction: -1 | 1) {
    const qs = [...kit.questions];
    const i = qs.findIndex((q: any) => q.id === qid);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    setKit({ ...kit, questions: qs });
    await api.updateKit(id, { questions: qs });
  }

  async function deleteQuestion(qid: string) {
    const updatedQuestions = kit.questions.filter((q: any) => q.id !== qid);
    setKit({ ...kit, questions: updatedQuestions });
    await api.updateKit(id, { questions: updatedQuestions });
  }

  async function addManualQuestion() {
    const newQ = {
      id: `manual-${Date.now()}`,
      requirement_ids: [],
      category: "technical",
      prompt: "New question - edit me",
      answer_outline: "",
      difficulty: 1,
      source: "manual",
    };
    const updatedQuestions = [...kit.questions, newQ];
    setKit({ ...kit, questions: updatedQuestions });
    await api.updateKit(id, { questions: updatedQuestions });
  }

  // category === undefined regenerates every still-generated question
  // across all categories; a specific category scopes to just that one.
  async function regenerateQuestions(category?: string) {
    setRegenerating(category ? `questions:${category}` : "questions:all");
    setError(null);
    try {
      const { kit: updated } = await api.regenerateSection(id, "questions", { category });
      setKit(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRegenerating(null);
    }
  }

  async function regenerateBrief() {
    setRegenerating("company_brief");
    setError(null);
    try {
      const { kit: updated } = await api.regenerateSection(id, "company_brief");
      setKit(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRegenerating(null);
    }
  }

  async function regenerateSchedule() {
    setRegenerating("schedule");
    setError(null);
    try {
      const days = scheduleDaysInput === "" ? undefined : Number(scheduleDaysInput);
      const { kit: updated } = await api.regenerateSection(id, "schedule", { days });
      setKit(updated);
      setScheduleDaysInput(updated.schedule.days_available);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRegenerating(null);
    }
  }

  if (error && !kit) return <main className="p-6 text-red-600">{error}</main>;
  if (!kit) return <main className="p-6 text-slate-500">Loading...</main>;

  const uncovered: string[] = kit.coverage?.uncovered_requirement_ids ?? [];

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <a href="/" className="text-sm text-slate-500 hover:underline">&larr; All kits</a>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{kit.role?.title}</h1>
            <p className="text-slate-500">{kit.source?.company}</p>
          </div>
          <button
            onClick={regenerateBrief}
            disabled={regenerating === "company_brief"}
            className="shrink-0 text-sm rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
          >
            {regenerating === "company_brief" ? "Regenerating..." : "Regenerate brief"}
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-700">{kit.company_brief?.summary}</p>
        {kit.company_brief?.sources?.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Sources: {kit.company_brief.sources.join(", ")}
          </p>
        )}
      </section>

      {uncovered.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          {uncovered.length} must-have requirement(s) still have no question after {kit.coverage.passes} pass(es): {uncovered.join(", ")}
        </div>
      )}

      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Requirements</h2>
        </div>
        <ul className="space-y-1 text-sm">
          {kit.role?.requirements?.map((r: any) => (
            <li key={r.id} className="flex gap-2">
              <span className={`px-1.5 rounded text-xs font-medium ${r.priority === "must" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                {r.priority}
              </span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium">Questions</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={addManualQuestion} className="text-sm rounded-lg border border-slate-300 px-3 py-1.5">+ Add question</button>
            <button
              onClick={() => regenerateQuestions()}
              disabled={regenerating !== null}
              className="text-sm rounded-lg bg-slate-900 text-white px-3 py-1.5 disabled:opacity-50"
            >
              {regenerating === "questions:all" ? "Regenerating..." : "Regenerate all"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-slate-400 self-center">Regenerate just:</span>
          {QUESTION_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => regenerateQuestions(c)}
              disabled={regenerating !== null}
              className="rounded-full border border-slate-300 px-2.5 py-1 disabled:opacity-50"
            >
              {regenerating === `questions:${c}` ? "Regenerating..." : c}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {kit.questions?.map((q: any, i: number) => (
            <div key={q.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <select
                  value={q.category}
                  onChange={(e) => moveQuestionCategory(q.id, e.target.value)}
                  className="px-1.5 py-0.5 rounded bg-slate-100 border-none text-slate-700"
                >
                  {QUESTION_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span>difficulty {q.difficulty}</span>
                <span className="italic">{q.source}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => moveQuestion(q.id, -1)}
                    disabled={i === 0}
                    aria-label="Move question up"
                    className="px-1.5 rounded border border-slate-200 disabled:opacity-30"
                  >
                    &uarr;
                  </button>
                  <button
                    onClick={() => moveQuestion(q.id, 1)}
                    disabled={i === kit.questions.length - 1}
                    aria-label="Move question down"
                    className="px-1.5 rounded border border-slate-200 disabled:opacity-30"
                  >
                    &darr;
                  </button>
                  <button onClick={() => deleteQuestion(q.id)} className="text-red-500 hover:underline ml-1">delete</button>
                </div>
              </div>
              <textarea
                value={q.prompt}
                onChange={(e) => saveQuestionEdit(q.id, "prompt", e.target.value)}
                className="w-full text-sm font-medium border-none focus:outline-none resize-none bg-transparent"
              />
              <textarea
                value={q.answer_outline}
                onChange={(e) => saveQuestionEdit(q.id, "answer_outline", e.target.value)}
                className="w-full text-sm text-slate-600 border-none focus:outline-none resize-none bg-transparent mt-1"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium">Schedule ({kit.schedule?.days_available} days)</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500" htmlFor="schedule-days">Days:</label>
            <input
              id="schedule-days"
              type="number"
              min={1}
              value={scheduleDaysInput}
              onChange={(e) => setScheduleDaysInput(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-16 text-sm border border-slate-300 rounded-lg px-2 py-1"
            />
            <button
              onClick={regenerateSchedule}
              disabled={regenerating === "schedule"}
              className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
            >
              {regenerating === "schedule" ? "Regenerating..." : "Regenerate schedule"}
            </button>
          </div>
        </div>
        {kit.schedule?.days?.map((d: any) => (
          <div key={d.day} className="text-sm border-b border-slate-100 py-2 last:border-0">
            <span className="font-medium">Day {d.day}:</span> {d.focus} &middot; {d.minutes} min &middot; {d.question_ids.length} question(s)
          </div>
        ))}
      </section>

      <a href={`/kits/${id}/practice`} className="inline-block rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
        Start practice mode &rarr;
      </a>
    </main>
  );
}
