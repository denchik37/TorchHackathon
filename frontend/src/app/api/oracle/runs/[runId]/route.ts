import { NextRequest, NextResponse } from 'next/server';

/**
 * Resolver run detail: read-only observability. Data must come from Hetzner torch-api
 * (proxy). No filesystem or ORACLE_RUNS_PATH — Vercel never reads resolver artifacts
 * from disk.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const base = process.env.TORCH_API_BASE?.replace(/\/$/, '');
  const token = process.env.DASHBOARD_API_TOKEN;

  if (!base || !token) {
    return NextResponse.json(
      { error: 'Resolver run data is only available via Hetzner torch-api. Set TORCH_API_BASE and DASHBOARD_API_TOKEN.' },
      { status: 503 }
    );
  }

  const { runId } = await params;
  const safeId = runId.replace(/[^A-Za-z0-9._:-]/g, '');

  try {
    const res = await fetch(`${base}/api/resolver/runs/${encodeURIComponent(safeId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 30 },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(data ?? { error: 'Run not found' }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error('Oracle run detail proxy error:', e);
    return NextResponse.json({ error: 'Failed to fetch run from Torch API' }, { status: 502 });
  }
}
