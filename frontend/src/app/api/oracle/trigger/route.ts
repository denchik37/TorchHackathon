import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';

const RESOLVER_DIR = process.env.ORACLE_RESOLVER_DIR ?? '';
const SECRET = process.env.RESOLVER_TRIGGER_SECRET ?? '';

export async function POST(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: 'Trigger not configured' }, { status: 503 });
  }
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!RESOLVER_DIR) {
    return NextResponse.json({ error: 'ORACLE_RESOLVER_DIR not configured' }, { status: 503 });
  }

  return new Promise<NextResponse>((resolve) => {
    const child = spawn('npm', ['run', 'resolve:once'], {
      cwd: RESOLVER_DIR,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) {
        resolve(NextResponse.json({ ok: true, message: 'Resolver run started and completed' }));
      } else {
        resolve(
          NextResponse.json(
            { ok: false, message: 'Resolver run failed', stderr: err.slice(-500) },
            { status: 500 }
          )
        );
      }
    });
    child.on('error', (e) => {
      resolve(
        NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
      );
    });
  });
}
