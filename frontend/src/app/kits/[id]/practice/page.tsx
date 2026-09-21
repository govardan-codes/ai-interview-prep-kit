"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function PracticePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [kit, setKit] = useState<any>(null);
  const [order, setOrder] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.replace("/login"); return; }
    api.getKit(id).then((d) => {
      setKit(d.kit);
      // Order by least-confident-first (unrated cards treated as confidence 0,
      // i.e. reviewed before anything already marked confident). This is a
      // simple, defensible confidence-weighted sort - see README.
      const sorted = [...d.kit.flashcards].sort(
        (a: any, b: any) => (a.last_confidence ?? 0) - (b.last_confidence ?? 0)
      );
      setOrder(sorted);
    });
  }, [id, router]);

  async function rate(confidence: 1 | 2 | 3) {
    const card = order[index];
    const updatedFlashcards = kit.flashcards.map((f: any) =>
      f.id === card.id
        ? { ...f, last_confidence: confidence, times_reviewed: (f.times_reviewed ?? 0) + 1 }
        : f
    );
    setKit({ ...kit, flashcards: updatedFlashcards });
    await api.updateKit(id, { flashcards: updatedFlashcards });
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  if (!kit) return <main className="p-6 text-slate-500">Loading...</main>;

  const done = index >= order.length;
  const card = order[index];
  const coveredCount = kit.flashcards.filter((f: any) => f.times_reviewed > 0).length;

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <a href={`/kits/${id}`} className="text-sm text-slate-500 hover:underline">&larr; Back to kit</a>
      <p className="text-sm text-slate-500">{coveredCount} / {kit.flashcards.length} cards covered</p>

      {done ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="font-medium">Session complete.</p>
          <p className="text-sm text-slate-500 mt-1">Least-confident cards will come up first next time.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 min-h-[220px] flex flex-col justify-between">
          <div>
            <p className="text-xs text-slate-400 mb-2">Card {index + 1} of {order.length}</p>
            <p className="font-medium">{card.front}</p>
            {revealed && <p className="mt-4 text-sm text-slate-600 border-t border-slate-100 pt-4">{card.back}</p>}
          </div>
          {!revealed ? (
            <button onClick={() => setRevealed(true)} className="self-start mt-4 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm">
              Reveal answer
            </button>
          ) : (
            <div className="flex gap-2 mt-4">
              <span className="text-sm text-slate-500 self-center mr-2">How confident were you?</span>
              <button onClick={() => rate(1)} className="rounded-lg border border-red-300 text-red-600 px-3 py-1.5 text-sm">Low</button>
              <button onClick={() => rate(2)} className="rounded-lg border border-amber-300 text-amber-600 px-3 py-1.5 text-sm">Medium</button>
              <button onClick={() => rate(3)} className="rounded-lg border border-green-300 text-green-600 px-3 py-1.5 text-sm">High</button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
