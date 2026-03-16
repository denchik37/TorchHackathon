import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const RUNS_DIR = process.env.ORACLE_RUNS_PATH ?? '';

export async function GET() {
  if (!RUNS_DIR) {
    return NextResponse.json({ runs: [], message: 'ORACLE_RUNS_PATH not configured' });
  }
  try {
    const files = await readdir(RUNS_DIR);
    const jsonFiles = files.filter((f) => f.startsWith('RESOLVE-') && f.endsWith('.json'));
    const runs = jsonFiles.map((name) => {
      const runId = name.replace('.json', '');
      return { runId, name };
    });
    runs.sort((a, b) => b.name.localeCompare(a.name));
    return NextResponse.json({ runs });
  } catch (e) {
    console.error('Oracle runs list error:', e);
    return NextResponse.json({ runs: [], error: 'Failed to list runs' }, { status: 500 });
  }
}
