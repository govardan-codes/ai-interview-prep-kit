"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [kits, setKits] = useState<any[]>([]);
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setReady(true);
    api.listKits().then((d) => setKits(d.kits)).catch(() => {});
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { kit } = await api.createKit(jd, companyUrl, days);
      router.push(`/kits/${kit._id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your prep kits</h1>
        <button
          onClick={() => { localStorage.removeItem("token"); api.logout(); router.push("/login"); }}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Log out
        </button>
      </header>

      <form onSubmit={handleCreate} className="space-y-4 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h2 className="font-medium">Create a new kit</h2>
        <textarea
          required
          placeholder="Paste the job description here..."
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm"
        />
        <div className="flex gap-3">
          <input
            required
            type="url"
            placeholder="https://company.com"
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 p-2 text-sm"
          />
          <input
            required
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-28 rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Researching & generating (this can take a minute)..." : "Generate kit"}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-medium text-slate-700">Existing kits</h2>
        {kits.length === 0 && <p className="text-sm text-slate-500">No kits yet.</p>}
        <ul className="space-y-2">
          {kits.map((k) => (
            <li key={k._id}>
              <a href={`/kits/${k._id}`} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400">
                <div className="font-medium">{k.role?.title || "Untitled role"}</div>
                <div className="text-sm text-slate-500">{k.source?.company}</div>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
