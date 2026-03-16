import { NextRequest, NextResponse } from "next/server";
import { loadRunArtifact } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const revalidate = 10;

async function proxy(date: string): Promise<NextResponse> {
  const base = process.env.TORCH_API_BASE;
  const token = process.env.DASHBOARD_API_TOKEN;
  if (!base || !token) {
    return NextResponse.json({ error: "Torch API not configured" }, { status: 503 });
  }
  const url = `${base.replace(/\/$/, "")}/api/betting/runs/${date}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  const data = await res.json().catch(() => null);
  const next = NextResponse.json(data ?? {}, { status: res.status });
  next.headers.set("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  return next;
}

async function local(date: string): Promise<NextResponse> {
  const artifact = await loadRunArtifact(date);
  if (!artifact) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const next = NextResponse.json(artifact);
  next.headers.set("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  return next;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  try {
    if (process.env.TORCH_API_BASE && process.env.DASHBOARD_API_TOKEN) {
      return proxy(date);
    }
    return local(date);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load run" }, { status: 500 });
  }
}
