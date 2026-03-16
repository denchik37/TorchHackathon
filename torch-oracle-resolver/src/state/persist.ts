import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync, renameSync } from 'fs';
import { resolve } from 'path';
import type { ResolverState, ResolverRunArtifact } from '../types.js';
import { logger } from '../logger.js';

const RUNS_DIR = resolve(process.cwd(), 'runs');
const STATE_PATH = resolve(process.cwd(), 'state.json');

const defaultState: ResolverState = {
  lastRunAt: null,
  blockedTimestamps: {},
  resolvedTimestamps: {},
  priceCache: {},
  priceCacheOrder: [],
};

export async function loadState(): Promise<ResolverState> {
  try {
    if (!existsSync(STATE_PATH)) return { ...defaultState };
    const raw = await readFile(STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ResolverState>;
    return {
      lastRunAt: parsed.lastRunAt ?? null,
      blockedTimestamps: parsed.blockedTimestamps ?? {},
      resolvedTimestamps: parsed.resolvedTimestamps ?? {},
      priceCache: parsed.priceCache ?? {},
      priceCacheOrder: parsed.priceCacheOrder ?? [],
    };
  } catch (e) {
    logger.warn({ err: e }, 'Could not load state, using default');
    return { ...defaultState };
  }
}

export async function saveState(state: ResolverState): Promise<void> {
  const tmpPath = `${STATE_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  renameSync(tmpPath, STATE_PATH);
  logger.debug('State saved');
}

export async function persistRunArtifact(artifact: ResolverRunArtifact): Promise<string> {
  if (!existsSync(RUNS_DIR)) {
    await mkdir(RUNS_DIR, { recursive: true });
  }
  const filename = `RESOLVE-${artifact.runId}.json`;
  const path = resolve(RUNS_DIR, filename);
  await writeFile(path, JSON.stringify(artifact, null, 2), 'utf-8');
  logger.info({ path, runId: artifact.runId }, 'Run artifact persisted');
  return path;
}

export function getRunsDir(): string {
  return RUNS_DIR;
}

export function getStatePath(): string {
  return STATE_PATH;
}
