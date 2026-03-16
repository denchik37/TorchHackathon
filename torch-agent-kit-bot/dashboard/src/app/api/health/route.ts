import { NextResponse } from "next/server";
import { getRunSummaries } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const revalidate = 10;

function getNextTargetTimestamp(): number {
  const now = new Date();
  const leadMs = 24 * 60 * 60 * 1000;
  const anchor = new Date(now.getTime() + leadMs);
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const d = anchor.getUTCDate();
  return Math.floor(new Date(Date.UTC(y, m, d, 12, 0, 0, 0)).getTime() / 1000);
}

async function proxyHealth(): Promise<NextResponse> {
  const base = process.env.TORCH_API_BASE;
  const token = process.env.DASHBOARD_API_TOKEN;
  if (!base || !token) {
    return NextResponse.json({ error: "Torch API not configured" }, { status: 503 });
  }
  const url = `${base.replace(/\/$/, "")}/api/health`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 10 },
  });
  const data = await res.json().catch(() => ({}));
  const next = NextResponse.json(data, { status: res.status });
  next.headers.set("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  return next;
}

async function localHealth(): Promise<NextResponse> {
  const summaries = await getRunSummaries();
  const lastRun = summaries[0] ?? null;
  const nextTarget = getNextTargetTimestamp();
  const nextTargetDate = new Date(nextTarget * 1000).toISOString();
  const next = NextResponse.json({
    lastRun: lastRun
      ? {
          date: lastRun.date,
          timestampUtc: lastRun.timestampUtc,
          successCount: lastRun.successCount,
          dryRunCount: lastRun.dryRunCount,
          failedCount: lastRun.failedCount,
          skippedCount: lastRun.skippedCount,
        }
      : null,
    nextTargetTimestamp: nextTarget,
    nextTargetDate,
  });
  next.headers.set("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  return next;
}

export async function GET() {
  try {
    if (process.env.TORCH_API_BASE && process.env.DASHBOARD_API_TOKEN) {
      return proxyHealth();
    }
    return localHealth();
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to get health" }, { status: 500 });
  }
}
