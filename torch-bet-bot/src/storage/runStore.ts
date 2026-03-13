/**
 * Idempotency store and run artifacts.
 * Persists to torch-bet-bot/runs/YYYY-MM-DD.json. Unique bet key = SYMBOL:targetTimestamp.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { RunArtifact, BetResult } from "../types.js";

const SYMBOL = "HBAR";

export function betKey(targetTimestamp: number): string {
  return `${SYMBOL}:${targetTimestamp}`;
}

export function runArtifactPath(runsDir: string, dateStr: string): string {
  return join(runsDir, `${dateStr}.json`);
}

/**
 * Load today's artifact if it exists.
 */
export async function loadRunArtifact(
  runsDir: string,
  dateStr: string
): Promise<RunArtifact | null> {
  const path = runArtifactPath(runsDir, dateStr);
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as RunArtifact;
  } catch {
    return null;
  }
}

/**
 * Set of bet keys that already have a successful tx for today (idempotency).
 */
export function getSuccessfulBetKeys(artifact: RunArtifact): Set<string> {
  const set = new Set<string>();
  for (const r of artifact.results) {
    if (r.txHash && r.status === 1) set.add(r.betKey);
  }
  return set;
}

/**
 * Append a result to the artifact and persist. Creates dir if needed.
 */
export async function appendResultAndSave(
  runsDir: string,
  dateStr: string,
  artifact: RunArtifact,
  result: BetResult
): Promise<void> {
  artifact.results.push(result);
  await mkdir(runsDir, { recursive: true });
  const path = runArtifactPath(runsDir, dateStr);
  await writeFile(path, JSON.stringify(artifact, null, 2), "utf-8");
}

/**
 * Create a fresh artifact for a new run.
 */
export function createArtifact(
  runId: string,
  provider: string,
  forecasts: RunArtifact["forecasts"],
  betParams: RunArtifact["betParams"]
): RunArtifact {
  return {
    runId,
    timestampUtc: new Date().toISOString(),
    provider,
    forecasts,
    betParams,
    results: [],
    skippedDuplicates: [],
  };
}
