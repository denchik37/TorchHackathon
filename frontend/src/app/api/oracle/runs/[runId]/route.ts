import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

const RUNS_DIR = process.env.ORACLE_RUNS_PATH ?? '';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  if (!RUNS_DIR) {
    return NextResponse.json({ error: 'ORACLE_RUNS_PATH not configured' }, { status: 503 });
  }
  const { runId } = await params;
  const safeId = runId.replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `${safeId}.json`;
  try {
    const path = join(RUNS_DIR, filename);
    const raw = await readFile(path, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (e) {
    console.error('Oracle run read error:', e);
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }
}
