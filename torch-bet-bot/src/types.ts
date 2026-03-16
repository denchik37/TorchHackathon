/**
 * Forecast: raw price range from a provider (e.g. OpenAI "Min: x, Max: y").
 */
export interface Forecast {
  targetTimestamp: number;
  dayLabel: string; // e.g. "on March 6"
  priceLow: number;
  priceHigh: number;
  /** Exact min string from response (for 8-decimal parseUnits). */
  priceLowStr?: string;
  /** Exact max string from response (for 8-decimal parseUnits). */
  priceHighStr?: string;
  raw?: string;
  prompt?: string;
}

/**
 * Result of parsing a single forecast response (may fail).
 */
export type ForecastParseResult = { ok: true; forecast: Forecast } | { ok: false; error: string };

/** Result per target: success with forecast or failure with error (skip betting). */
export type ForecastResult =
  | { ok: true; forecast: Forecast }
  | { ok: false; targetTimestamp: number; dayLabel: string; error: string };

/**
 * Provider interface: fetch forecasts for the given target timestamps.
 */
export interface ForecastProvider {
  readonly name: string;
  getForecasts(params: {
    symbol: string;
    confidencePercent: number;
    targets: Array<{ timestamp: number; dayLabel: string }>;
  }): Promise<ForecastResult[]>;
}

/**
 * Torch bet parameters (deterministic from Forecast + config).
 */
export interface TorchBetParams {
  symbol: string;
  targetTimestamp: number;
  priceLowInt: bigint;
  priceHighInt: bigint;
  stakeValue: bigint;
}

/**
 * Result of placing a bet (dry run, tx, or skipped duplicate).
 */
export interface BetResult {
  betKey: string;
  targetTimestamp: number;
  /** OpenAI prompt sent for this target. */
  prompt?: string;
  /** Raw model output line (e.g. "Min: [0.04800], Max: [0.06200]"). */
  raw?: string;
  /** Extracted min price string. */
  priceMinStr?: string;
  /** Extracted max price string. */
  priceMaxStr?: string;
  /** True when bet was skipped because already placed today. */
  skippedDuplicate?: boolean;
  dryRun?: boolean;
  txHash?: string;
  status?: number;
  error?: string;
}

/**
 * Run artifact persisted to runs/YYYY-MM-DD.json
 */
export interface RunArtifact {
  runId: string;
  timestampUtc: string;
  provider: string;
  forecasts: Array<{
    targetTimestamp: number;
    dayLabel: string;
    priceLow?: number;
    priceHigh?: number;
    priceLowStr?: string;
    priceHighStr?: string;
    raw?: string;
    prompt?: string;
    error?: string;
  }>;
  betParams: Array<{
    targetTimestamp: number;
    priceLowInt: string;
    priceHighInt: string;
    priceMinStr: string;
    priceMaxStr: string;
    stakeValue: string;
  }>;
  results: BetResult[];
  skippedDuplicates: string[];
}
