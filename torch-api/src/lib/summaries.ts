function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type BettingRunSummary = {
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
};

export function computeBettingRunSummary(
  date: string,
  fileJson: unknown
): BettingRunSummary | null {
  if (!isObject(fileJson)) return null;

  const rawResults = Array.isArray(fileJson.results) ? fileJson.results : [];
  const results = rawResults.filter(isObject);

  const successCount = results.filter(
    (r) => typeof r.txId === 'string' && typeof r.status === 'number' && r.status === 22
  ).length;
  const dryRunCount = results.filter((r) => r.dryRun === true).length;
  const skippedCount = results.filter((r) => r.skippedDuplicate === true).length;
  const failedCount = results.filter(
    (r) => typeof r.error === 'string' && (r.error as string).length > 0
  ).length;

  const forecasts = Array.isArray(fileJson.forecasts) ? fileJson.forecasts : [];
  const betParams = Array.isArray(fileJson.betParams) ? fileJson.betParams : [];

  return {
    date,
    runId: typeof fileJson.runId === 'string' ? fileJson.runId : '',
    timestampUtc: typeof fileJson.timestampUtc === 'string' ? fileJson.timestampUtc : '',
    forecastCount: forecasts.length,
    betParamCount: betParams.length,
    resultCount: results.length,
    successCount,
    dryRunCount,
    skippedCount,
    failedCount,
  };
}

export type ResolverRunSummary = {
  id: string;
  filename: string;
  timestampUtc: string;
  mode: string;
  acceptedCount?: number;
  blockedCount?: number;
};

export function computeResolverRunSummary(
  id: string,
  filename: string,
  fileJson: unknown
): ResolverRunSummary | null {
  if (!isObject(fileJson)) return null;

  const rawChecks = Array.isArray(fileJson.priceChecks) ? fileJson.priceChecks : [];
  const checks = rawChecks.filter(isObject);

  const acceptedCount = checks.filter((c) => c.status === 'accepted').length;
  const blockedCount = checks.filter((c) => c.status === 'blocked').length;

  return {
    id,
    filename,
    timestampUtc: typeof fileJson.timestampUtc === 'string' ? fileJson.timestampUtc : '',
    mode: typeof fileJson.mode === 'string' ? fileJson.mode : 'live',
    acceptedCount,
    blockedCount,
  };
}
