const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

async function request(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (email: string, password: string) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  listKits: () => request("/kits"),
  createKit: (jd: string, company_url: string, days: number) =>
    request("/kits", { method: "POST", body: JSON.stringify({ jd, company_url, days }) }),
  getKit: (id: string) => request(`/kits/${id}`),
  updateKit: (id: string, patch: any) =>
    request(`/kits/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  regenerateSection: (id: string, section: string, opts?: { category?: string; days?: number }) =>
    request(`/kits/${id}/regenerate`, { method: "POST", body: JSON.stringify({ section, ...opts }) }),
};
