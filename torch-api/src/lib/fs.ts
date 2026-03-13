import { readFile, readdir } from 'fs/promises';
import { resolve, relative } from 'path';

export async function safeReadJson<T = unknown>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function safeListFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Ensure resolvedPath is under baseDir (no path traversal).
 */
export function enforceNoTraversal(baseDir: string, resolvedPath: string): boolean {
  const base = resolve(baseDir);
  const resolved = resolve(resolvedPath);
  const rel = relative(base, resolved);
  return (rel === '' || (!rel.startsWith('..') && !rel.includes('..')));
}

export function safeJoin(baseDir: string, ...segments: string[]): string | null {
  const base = resolve(baseDir);
  const full = resolve(base, ...segments);
  if (!enforceNoTraversal(baseDir, full)) {
    return null;
  }
  return full;
}
