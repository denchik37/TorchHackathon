import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 10;

export async function GET() {
  const base = process.env.TORCH_API_BASE;
  const token = process.env.DASHBOARD_API_TOKEN;
  if (!base || !token) {
    return NextResponse.json({ runs: [] });
  }
  try {
    const url = `${base.replace(/\/$/, "")}/api/resolver/runs`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 10 },
    });
    const data = await res.json().catch(() => ({ runs: [] }));
    const next = NextResponse.json(data?.runs != null ? data : { runs: [] }, { status: res.status });
    next.headers.set("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    return next;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ runs: [] }, { status: 500 });
  }
}
