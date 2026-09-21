"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await api.register(email, password);
      localStorage.setItem("token", token);
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <main className="max-w-sm mx-auto mt-24 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <h1 className="text-xl font-semibold mb-4">Create an account</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
        <input type="password" required placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded-lg bg-slate-900 text-white p-2 text-sm font-medium">Register</button>
      </form>
      <p className="text-sm text-slate-500 mt-4">Already have an account? <a href="/login" className="underline">Log in</a></p>
    </main>
  );
}
