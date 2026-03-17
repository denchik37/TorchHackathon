import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync, renameSync } from 'fs';
import { resolve, dirname } from 'path';
import type { ResolverState, ResolverRunArtifact } from '../types.js';
import { logger } from '../logger.js';

function getRunsDirFromEnv(): string {
  return process.env.RESOLVER_RUNS_DIR
    ? resolve(process.env.RESOLVER_RUNS_DIR)
    : resolve(process.cwd(), 'runs');
}

function getStatePathFromEnv(): string {
  return process.env.RESOLVER_STATE_PATH
    ? resolve(process.env.RESOLVER_STATE_PATH)
    : resolve(process.cwd(), 'state.json');
}

const defaultState: ResolverState = {
  lastRunAt: null,
  blockedTimestamps: {},
  resolvedTimestamps: {},
  priceCache: {},
  priceCacheOrder: [],
};

export async function loadState(): Promise<ResolverState> {
  const statePath = getStatePathFromEnv();
  try {
    if (!existsSync(statePath)) return { ...defaultState };
    const raw = await readFile(statePath, 'utf-8');
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
  const statePath = getStatePathFromEnv();
  const stateDir = dirname(statePath);
  if (!existsSync(stateDir)) {
    await mkdir(stateDir, { recursive: true });
  }
  const tmpPath = `${statePath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  renameSync(tmpPath, statePath);
  logger.debug('State saved');
}

export async function persistRunArtifact(artifact: ResolverRunArtifact): Promise<string> {
  const runsDir = getRunsDirFromEnv();
  if (!existsSync(runsDir)) {
    await mkdir(runsDir, { recursive: true });
  }
  const filename = `RESOLVE-${artifact.runId}.json`;
  const path = resolve(runsDir, filename);
  await writeFile(path, JSON.stringify(artifact, null, 2), 'utf-8');
  logger.info({ path, runId: artifact.runId }, 'Run artifact persisted');
  return path;
}

export function getRunsDir(): string {
  return getRunsDirFromEnv();
}

export function getStatePath(): string {
  return getStatePathFromEnv();
}
