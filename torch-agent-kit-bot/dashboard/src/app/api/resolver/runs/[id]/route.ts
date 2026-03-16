import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[A-Za-z0-9._:-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const base = process.env.TORCH_API_BASE;
  const token = process.env.DASHBOARD_API_TOKEN;
  if (!base || !token) {
    return NextResponse.json({ error: "Torch API not configured" }, { status: 503 });
  }
  try {
    const url = `${base.replace(/\/$/, "")}/api/resolver/runs/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 30 },
    });
    const data = await res.json().catch(() => null);
    const next = NextResponse.json(data ?? {}, { status: res.status });
    next.headers.set("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return next;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load resolver run" }, { status: 500 });
  }
}
