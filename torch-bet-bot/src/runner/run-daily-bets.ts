/**
 * Main entrypoint: daily bet run.
 * Fetches 7 forecasts (D+1..D+7, 12:00 UTC), converts to bet params, enforces guardrails, places bets (or dry-run).
 * Idempotent: re-run same day skips already-placed bets.
 */

import { randomUUID } from "crypto";
import pino from "pino";
import "dotenv/config";
import { getEnv, checkRpcConnectivity } from "../config/env.js";
import { getForecastProvider } from "../providers/index.js";
import { forecastToBetParams, parseHbar } from "../policy/betPolicy.js";
import { TorchClient } from "../torch/torchClient.js";
import {
  betKey,
  loadRunArtifact,
  getSuccessfulBetKeys,
  appendResultAndSave,
  createArtifact,
} from "../storage/runStore.js";
import { getNextSevenTargets } from "../utils/time.js";
import type { RunArtifact, BetResult, ForecastResult } from "../types.js";

const RUNS_DIR = "runs";
const SYMBOL = "HBAR";
const CONFIDENCE_PERCENT = 60;

function getLogger() {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });
}

function todayStr(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

/**
 * Enforce spend guardrails: refuse if total intended spend > MAX_DAILY_SPEND_HBAR
 * or any single bet > MAX_BET_AMOUNT_HBAR (if set).
 */
function enforceGuardrails(
  stakeHbar: string,
  numBets: number,
  maxDailyHbar: string,
  maxBetHbar: string | undefined,
  nativeValueDecimals: number
): void {
  const stake = parseHbar(stakeHbar, nativeValueDecimals);
  const total = stake * BigInt(numBets);
  const maxDaily = parseHbar(maxDailyHbar, nativeValueDecimals);
  if (total > maxDaily) {
    throw new Error(
      `Total intended spend ${numBets} × ${stakeHbar} HBAR exceeds MAX_DAILY_SPEND_HBAR=${maxDailyHbar}`
    );
  }
  if (maxBetHbar) {
    const maxBet = parseHbar(maxBetHbar, nativeValueDecimals);
    if (stake > maxBet) {
      throw new Error(`Per-bet amount ${stakeHbar} HBAR exceeds MAX_BET_AMOUNT_HBAR=${maxBetHbar}`);
    }
  }
}

export async function main(): Promise<void> {
  const env = getEnv();
  const log = getLogger();

  const dateStr = todayStr();
  const runId = randomUUID();

  log.info({ runId, dateStr }, "Starting daily bet run");

  await checkRpcConnectivity(env.RPC_URL);

  const runsDir = RUNS_DIR;
  let artifact = await loadRunArtifact(runsDir, dateStr);
  const successfulKeys = artifact ? getSuccessfulBetKeys(artifact) : new Set<string>();

  const targets = getNextSevenTargets();
  const provider = getForecastProvider();
  log.info({ provider: provider.name }, "Fetching forecasts");

  const forecastResults: ForecastResult[] = await provider.getForecasts({
    symbol: SYMBOL,
    confidencePercent: CONFIDENCE_PERCENT,
    targets,
  });

  const forecastsForArtifact: RunArtifact["forecasts"] = forecastResults.map((r) => {
    if (r.ok) {
      return {
        targetTimestamp: r.forecast.targetTimestamp,
        dayLabel: r.forecast.dayLabel,
        priceLow: r.forecast.priceLow,
        priceHigh: r.forecast.priceHigh,
        priceLowStr: r.forecast.priceLowStr,
        priceHighStr: r.forecast.priceHighStr,
        raw: r.forecast.raw,
        prompt: r.forecast.prompt,
      };
    }
    return {
      targetTimestamp: r.targetTimestamp,
      dayLabel: r.dayLabel,
      error: r.error,
    };
  });

  const successfulForecasts = forecastResults.filter(
    (r): r is ForecastResult & { ok: true } => r.ok
  );
  for (const r of successfulForecasts) {
    log.info(
      { dayLabel: r.forecast.dayLabel, targetTimestamp: r.forecast.targetTimestamp, raw: r.forecast.raw },
      "Forecast output"
    );
  }
  if (successfulForecasts.length === 0) {
    log.error("All forecasts failed");
    if (!artifact) {
      artifact = createArtifact(runId, provider.name, forecastsForArtifact, []);
      await appendResultAndSave(runsDir, dateStr, artifact, {
        betKey: "_run",
        targetTimestamp: 0,
        error: "All forecasts failed",
      });
    }
    process.exit(1);
  }

  const betParamsList = successfulForecasts.map((r) =>
    forecastToBetParams(
      r.forecast,
      env.BET_AMOUNT_HBAR,
      env.PRICE_DECIMALS,
      env.NATIVE_VALUE_DECIMALS
    )
  );

  enforceGuardrails(
    env.BET_AMOUNT_HBAR,
    betParamsList.length,
    env.MAX_DAILY_SPEND_HBAR,
    env.MAX_BET_AMOUNT_HBAR,
    env.NATIVE_VALUE_DECIMALS
  );

  const betParamsForArtifact: RunArtifact["betParams"] = betParamsList.map((p, idx) => {
    const f = successfulForecasts[idx].forecast;
    return {
      targetTimestamp: p.targetTimestamp,
      priceLowInt: p.priceLowInt.toString(),
      priceHighInt: p.priceHighInt.toString(),
      priceMinStr: f.priceLowStr ?? f.priceLow.toFixed(8),
      priceMaxStr: f.priceHighStr ?? f.priceHigh.toFixed(8),
      stakeValue: p.stakeValue.toString(),
    };
  });

  if (!artifact) {
    artifact = createArtifact(runId, provider.name, forecastsForArtifact, betParamsForArtifact);
  } else {
    artifact.forecasts = forecastsForArtifact;
    artifact.betParams = betParamsForArtifact;
  }

  let torch: TorchClient | null = null;
  if (!env.DRY_RUN) {
    torch = new TorchClient({
      rpcUrl: env.RPC_URL,
      chainId: env.CHAIN_ID,
      contractAddress: env.TORCH_CONTRACT_ADDRESS,
      privateKey: env.PRIVATE_KEY,
      functionName: env.TORCH_FUNCTION_NAME,
    });
  }

  let atLeastOneSuccess = false;
  for (let i = 0; i < betParamsList.length; i++) {
    const params = betParamsList[i];
    const key = betKey(params.targetTimestamp);
    const forecast = successfulForecasts[i].forecast;
    const priceMinStr = forecast.priceLowStr ?? forecast.priceLow.toFixed(8);
    const priceMaxStr = forecast.priceHighStr ?? forecast.priceHigh.toFixed(8);
    const raw = forecast.raw;
    const prompt = forecast.prompt;

    if (successfulKeys.has(key)) {
      log.info({ betKey: key }, "Skipping duplicate (already placed today)");
      artifact.skippedDuplicates.push(key);
      const skipResult: BetResult = {
        betKey: key,
        targetTimestamp: params.targetTimestamp,
        skippedDuplicate: true,
        prompt,
        raw,
        priceMinStr,
        priceMaxStr,
      };
      await appendResultAndSave(runsDir, dateStr, artifact, skipResult);
      atLeastOneSuccess = true;
      continue;
    }

    log.info(
      {
        betKey: key,
        targetTimestamp: params.targetTimestamp,
        priceMinStr,
        priceMaxStr,
        priceLowInt: params.priceLowInt.toString(),
        priceHighInt: params.priceHighInt.toString(),
      },
      "Bet params (price 8dp fixed-point)"
    );

    if (env.DRY_RUN) {
      log.info(
        { betKey: key, targetTimestamp: params.targetTimestamp },
        "DRY_RUN: would place bet"
      );
      const result: BetResult = {
        betKey: key,
        targetTimestamp: params.targetTimestamp,
        prompt,
        raw,
        priceMinStr,
        priceMaxStr,
        dryRun: true,
      };
      await appendResultAndSave(runsDir, dateStr, artifact, result);
      atLeastOneSuccess = true;
      continue;
    }

    try {
      const placeResult = await torch!.placeBet(params);
      const result: BetResult = {
        betKey: key,
        targetTimestamp: params.targetTimestamp,
        prompt,
        raw,
        priceMinStr,
        priceMaxStr,
        txHash: placeResult.txHash,
        status: placeResult.receipt?.status,
      };
      await appendResultAndSave(runsDir, dateStr, artifact, result);
      log.info({ betKey: key, txHash: placeResult.txHash }, "Bet placed");
      atLeastOneSuccess = true;
      if (placeResult.receipt) successfulKeys.add(key);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      log.error({ betKey: key, error: errMsg }, "Bet failed");
      const result: BetResult = {
        betKey: key,
        targetTimestamp: params.targetTimestamp,
        prompt,
        raw,
        priceMinStr,
        priceMaxStr,
        error: errMsg,
      };
      await appendResultAndSave(runsDir, dateStr, artifact, result);
    }
  }

  if (!atLeastOneSuccess) {
    log.error("No bets placed and no dry-run completions");
    process.exit(1);
  }
  log.info({ runId }, "Daily run finished");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
