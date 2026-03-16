import { NextResponse } from "next/server";
import { getRunSummaries } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const revalidate = 10;

async function proxy(): Promise<NextResponse> {
  const base = process.env.TORCH_API_BASE;
  const token = process.env.DASHBOARD_API_TOKEN;
  if (!base || !token) {
    return NextResponse.json({ error: "Torch API not configured" }, { status: 503 });
  }
  const url = `${base.replace(/\/$/, "")}/api/betting/runs`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 10 },
  });
  const data = await res.json().catch(() => []);
  const next = NextResponse.json(Array.isArray(data) ? data : [], { status: res.status });
  next.headers.set("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  return next;
}

async function local(): Promise<NextResponse> {
  const summaries = await getRunSummaries();
  const next = NextResponse.json(summaries);
  next.headers.set("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  return next;
}

export async function GET() {
  try {
    if (process.env.TORCH_API_BASE && process.env.DASHBOARD_API_TOKEN) {
      return proxy();
    }
    return local();
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to list runs" }, { status: 500 });
  }
}
