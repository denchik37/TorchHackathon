/**
 * Read/write runs/YYYY-MM-DD.json; idempotency via successful tx per betKey.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface RunArtifact {
  runId: string;
  timestampUtc: string;
  provider: {
    model: string;
    reasoning_effort: string;
    max_completion_tokens: number;
  };
  forecasts: Array<{
    betKey: string;
    targetTimestamp: number;
    monthDay: string;
    prompt: string;
    raw: string;
    minStr: string;
    maxStr: string;
  }>;
  betParams: Array<{
    betKey: string;
    priceMinStr: string;
    priceMaxStr: string;
    priceMinInt: string;
    priceMaxInt: string;
    stakeHbar: string;
  }>;
  results: Array<{
    betKey: string;
    targetTimestamp: number;
    dryRun?: boolean;
    skippedDuplicate?: boolean;
    txId?: string;
    status?: number;
    error?: string;
    prompt?: string;
    raw?: string;
    minStr?: string;
    maxStr?: string;
  }>;
}

export function betKey(symbol: string, targetTimestamp: number): string {
  return `${symbol}:${targetTimestamp}`;
}

export function runArtifactPath(runsDir: string, dateStr: string): string {
  return join(runsDir, `${dateStr}.json`);
}

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

/** Hedera receipt status: 22 = SUCCESS */
const STATUS_SUCCESS = 22;

export function getSuccessfulBetKeys(artifact: RunArtifact): Set<string> {
  const set = new Set<string>();
  for (const r of artifact.results) {
    if (r.txId && r.status === STATUS_SUCCESS) set.add(r.betKey);
  }
  return set;
}

export async function saveArtifact(
  runsDir: string,
  dateStr: string,
  artifact: RunArtifact
): Promise<void> {
  await mkdir(runsDir, { recursive: true });
  const path = runArtifactPath(runsDir, dateStr);
  await writeFile(path, JSON.stringify(artifact, null, 2), "utf-8");
}
