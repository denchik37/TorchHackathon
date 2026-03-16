/**
 * Safe parsing and reading of run artifacts from ../runs (relative to project root).
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";

const resultSchema = z.object({
  betKey: z.string(),
  targetTimestamp: z.number(),
  dryRun: z.boolean().optional(),
  skippedDuplicate: z.boolean().optional(),
  txId: z.string().optional(),
  status: z.number().optional(),
  error: z.string().optional(),
  prompt: z.string().optional(),
  raw: z.string().optional(),
  minStr: z.string().optional(),
  maxStr: z.string().optional(),
});

const forecastSchema = z.object({
  betKey: z.string(),
  targetTimestamp: z.number(),
  monthDay: z.string(),
  prompt: z.string(),
  raw: z.string(),
  minStr: z.string(),
  maxStr: z.string(),
});

const betParamSchema = z.object({
  betKey: z.string(),
  priceMinStr: z.string(),
  priceMaxStr: z.string(),
  priceMinInt: z.string(),
  priceMaxInt: z.string(),
  stakeHbar: z.string(),
});

export const runArtifactSchema = z.object({
  runId: z.string(),
  timestampUtc: z.string(),
  provider: z.object({
    model: z.string(),
    reasoning_effort: z.string(),
    max_completion_tokens: z.number(),
  }),
  forecasts: z.array(forecastSchema),
  betParams: z.array(betParamSchema),
  results: z.array(resultSchema),
});

export type RunArtifact = z.infer<typeof runArtifactSchema>;

function getRunsDir(): string {
  return join(process.cwd(), "..", "runs");
}

export async function listRunDates(): Promise<string[]> {
  const runsDir = getRunsDir();
  try {
    const files = await readdir(runsDir);
    return files
      .filter((f) => f.endsWith(".json") && /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.replace(".json", ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function loadRunArtifact(date: string): Promise<RunArtifact | null> {
  const runsDir = getRunsDir();
  const path = join(runsDir, `${date}.json`);
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return runArtifactSchema.parse(parsed);
  } catch {
    return null;
  }
}

export async function getRunSummaries(): Promise<
  Array<{
    date: string;
    runId: string;
    timestampUtc: string;
    forecastCount: number;
    betParamCount: number;
    resultCount: number;
    successCount: number;
    dryRunCount: number;
    skippedCount: number;
    failedCount: number;
  }>
> {
  const dates = await listRunDates();
  const summaries = [];
  for (const date of dates) {
    const artifact = await loadRunArtifact(date);
    if (!artifact) continue;
    const successCount = artifact.results.filter(
      (r) => r.txId && r.status === 22
    ).length;
    const dryRunCount = artifact.results.filter((r) => r.dryRun).length;
    const skippedCount = artifact.results.filter(
      (r) => r.skippedDuplicate
    ).length;
    const failedCount = artifact.results.filter((r) => r.error).length;
    summaries.push({
      date,
      runId: artifact.runId,
      timestampUtc: artifact.timestampUtc,
      forecastCount: artifact.forecasts.length,
      betParamCount: artifact.betParams.length,
      resultCount: artifact.results.length,
      successCount,
      dryRunCount,
      skippedCount,
      failedCount,
    });
  }
  return summaries;
}
