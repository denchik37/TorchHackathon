/**
 * Client helpers for dashboard: fetch local /api/* (which proxy to Hetzner when TORCH_API_BASE is set).
 * Token is never sent from browser — only server-side proxy adds it.
 */

export async function getHealth(): Promise<unknown> {
  const res = await fetch("/api/health", { cache: "no-store" });
  if (!res.ok) throw new Error(`Health failed: ${res.status}`);
  return res.json();
}

export async function listBettingRuns(): Promise<unknown[]> {
  const res = await fetch("/api/betting/runs", { cache: "no-store" });
  if (!res.ok) throw new Error(`Betting runs list failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getBettingRun(date: string): Promise<unknown> {
  const res = await fetch(`/api/betting/runs/${date}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Betting run failed: ${res.status}`);
  return res.json();
}

export async function listResolverRuns(): Promise<{ runs: unknown[] }> {
  const res = await fetch("/api/resolver/runs", { cache: "no-store" });
  if (!res.ok) throw new Error(`Resolver runs list failed: ${res.status}`);
  const data = await res.json();
  return data?.runs != null ? { runs: data.runs } : { runs: [] };
}

export async function getResolverRun(id: string): Promise<unknown> {
  const res = await fetch(`/api/resolver/runs/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Resolver run failed: ${res.status}`);
  return res.json();
}
