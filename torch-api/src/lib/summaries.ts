type BettingRunArtifact = {
  runId?: string;
  timestampUtc?: string;
  forecasts?: unknown[];
  betParams?: unknown[];
  results?: Array<{
    txId?: string;
    status?: number;
    dryRun?: boolean;
    skippedDuplicate?: boolean;
    error?: string;
  }>;
};

export function computeBettingRunSummary(
  date: string,
  fileJson: BettingRunArtifact | null
): {
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
} | null {
  if (!fileJson) return null;
  const results = fileJson.results ?? [];
  const successCount = results.filter((r) => r.txId && r.status === 22).length;
  const dryRunCount = results.filter((r) => r.dryRun).length;
  const skippedCount = results.filter((r) => r.skippedDuplicate).length;
  const failedCount = results.filter((r) => r.error).length;
  return {
    date,
    runId: fileJson.runId ?? '',
    timestampUtc: fileJson.timestampUtc ?? '',
    forecastCount: fileJson.forecasts?.length ?? 0,
    betParamCount: fileJson.betParams?.length ?? 0,
    resultCount: results.length,
    successCount,
    dryRunCount,
    skippedCount,
    failedCount,
  };
}

type ResolverRunArtifact = {
  runId?: string;
  timestampUtc?: string;
  mode?: string;
  priceChecks?: Array<{ status?: string }>;
};

export function computeResolverRunSummary(
  id: string,
  filename: string,
  fileJson: ResolverRunArtifact | null
): {
  id: string;
  filename: string;
  timestampUtc: string;
  mode: string;
  acceptedCount?: number;
  blockedCount?: number;
} | null {
  if (!fileJson) return null;
  const checks = fileJson.priceChecks ?? [];
  const acceptedCount = checks.filter((c) => c.status === 'accepted').length;
  const blockedCount = checks.filter((c) => c.status === 'blocked').length;
  return {
    id,
    filename,
    timestampUtc: fileJson.timestampUtc ?? '',
    mode: fileJson.mode ?? 'live',
    acceptedCount,
    blockedCount,
  };
}
