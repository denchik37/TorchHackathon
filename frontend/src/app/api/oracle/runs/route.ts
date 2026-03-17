import { NextResponse } from 'next/server';

/**
 * Resolver run list: read-only observability. Data must come from Hetzner torch-api
 * (proxy). No filesystem or ORACLE_RUNS_PATH — Vercel never reads resolver artifacts
 * from disk; the resolver writes only on Hetzner.
 */
export async function GET() {
  const base = process.env.TORCH_API_BASE?.replace(/\/$/, '');
  const token = process.env.DASHBOARD_API_TOKEN;

  if (!base || !token) {
    return NextResponse.json(
      { runs: [], message: 'Resolver run data is only available via Hetzner torch-api. Set TORCH_API_BASE and DASHBOARD_API_TOKEN.' }
    );
  }

  try {
    const res = await fetch(`${base}/api/resolver/runs`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 10 },
    });
    const data = await res.json().catch(() => ({ runs: [] }));
    const runs = Array.isArray(data.runs) ? data.runs : [];
    // Map torch-api shape (id, filename, ...) to frontend shape (runId, name)
    const list = runs.map((r: { id?: string; filename?: string }) => ({
      runId: r.id ?? r.filename?.replace(/\.json$/, '') ?? '',
      name: r.filename ?? `${r.id ?? 'run'}.json`,
    }));
    return NextResponse.json({ runs: list });
  } catch (e) {
    console.error('Oracle runs proxy error:', e);
    return NextResponse.json({ runs: [], error: 'Failed to fetch resolver runs from Torch API' }, { status: 502 });
  }
}
