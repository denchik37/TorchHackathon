/**
 * Main: daily bet run (Hedera Agent Kit style).
 * One prompt per target → Min/Max line → parse → encode → placeBet → persist run artifact.
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import pino from "pino";
import { getEnv } from "../config/env.js";
import { buildPrompt, getForecastLine } from "../openai/forecast.js";
import { parseMinMax } from "../parse/minmax.js";
import { getNextEligibleTargets } from "../time/targets.js";
import { buildBetParams } from "../policy/betPolicy.js";
import { createHederaClient } from "../hedera/client.js";
import { placeBet } from "../hedera/torch.js";
import {
  betKey,
  loadRunArtifact,
  getSuccessfulBetKeys,
  saveArtifact,
  type RunArtifact,
} from "../storage/runStore.js";

const RUNS_DIR = "runs";

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
  return new Date().toISOString().slice(0, 10);
}

export async function main(): Promise<void> {
  const env = getEnv();
  const log = getLogger();
  const dateStr = todayStr();
  const runId = randomUUID();

  log.info({ runId, dateStr }, "Starting daily bet run (Hedera Agent Kit)");

  const runsDir = RUNS_DIR;
  let artifact = await loadRunArtifact(runsDir, dateStr);
  const successfulKeys = artifact ? getSuccessfulBetKeys(artifact) : new Set<string>();

  const targets = getNextEligibleTargets({
    minLeadSeconds: env.MIN_TARGET_LEAD_SECONDS,
    daysAhead: env.DAYS_AHEAD,
  });

  if (targets.length === 0) {
    log.warn("No targets (DAYS_AHEAD or lead time issue)");
    process.exit(0);
  }

  const provider = {
    model: env.OPENAI_MODEL,
    reasoning_effort: env.OPENAI_REASONING_EFFORT,
    max_completion_tokens: env.OPENAI_MAX_COMPLETION_TOKENS,
  };

  const forecasts: RunArtifact["forecasts"] = [];
  const betParamsList: { params: ReturnType<typeof buildBetParams>; betKey: string; prompt: string; raw: string; minStr: string; maxStr: string }[] = [];
  const results: RunArtifact["results"] = [];

  for (const target of targets) {
    const key = betKey(env.SYMBOL, target.timestamp);
    const prompt = buildPrompt(target.monthDay, env.CONFIDENCE_PERCENT);

    let raw: string;
    try {
      raw = await getForecastLine(target.monthDay);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      log.error({ betKey: key, error: errMsg }, "Forecast failed");
      results.push({
        betKey: key,
        targetTimestamp: target.timestamp,
        error: errMsg,
        prompt,
        raw: "",
      });
      continue;
    }

    log.info({ raw }, "Forecast output");

    const parsed = parseMinMax(raw);
    if (!parsed.ok) {
      log.error({ betKey: key, error: parsed.error }, "Parse failed");
      results.push({
        betKey: key,
        targetTimestamp: target.timestamp,
        error: parsed.error,
        prompt,
        raw,
      });
      continue;
    }

    forecasts.push({
      betKey: key,
      targetTimestamp: target.timestamp,
      monthDay: target.monthDay,
      prompt,
      raw,
      minStr: parsed.minStr,
      maxStr: parsed.maxStr,
    });

    const params = buildBetParams(
      target.timestamp,
      parsed.minStr,
      parsed.maxStr,
      env.STAKE_HBAR
    );
    betParamsList.push({
      params,
      betKey: key,
      prompt,
      raw,
      minStr: parsed.minStr,
      maxStr: parsed.maxStr,
    });
  }

  const betParamsForArtifact: RunArtifact["betParams"] = betParamsList.map(({ params, betKey: key, minStr, maxStr }) => ({
    betKey: key,
    priceMinStr: minStr,
    priceMaxStr: maxStr,
    priceMinInt: params.priceMinInt.toString(),
    priceMaxInt: params.priceMaxInt.toString(),
    stakeHbar: params.stakeHbar,
  }));

  if (artifact) {
    artifact.runId = runId;
    artifact.timestampUtc = new Date().toISOString();
    artifact.provider = provider;
    artifact.forecasts = forecasts;
    artifact.betParams = betParamsForArtifact;
  } else {
    artifact = {
      runId,
      timestampUtc: new Date().toISOString(),
      provider,
      forecasts,
      betParams: betParamsForArtifact,
      results: [],
    };
  }

  const client = env.DRY_RUN ? null : createHederaClient();

  for (const { params, betKey: key, prompt, raw, minStr, maxStr } of betParamsList) {
    if (successfulKeys.has(key)) {
      log.info({ betKey: key }, "Skipping duplicate (already placed today)");
      results.push({
        betKey: key,
        targetTimestamp: params.targetTimestamp,
        skippedDuplicate: true,
        prompt,
        raw,
        minStr,
        maxStr,
      });
      continue;
    }

    if (env.DRY_RUN) {
      log.info({ betKey: key, targetTimestamp: params.targetTimestamp }, "DRY_RUN: would place bet");
      results.push({
        betKey: key,
        targetTimestamp: params.targetTimestamp,
        dryRun: true,
        prompt,
        raw,
        minStr,
        maxStr,
      });
      continue;
    }

    try {
      const placeResult = await placeBet(client!, params);
      results.push({
        betKey: key,
        targetTimestamp: params.targetTimestamp,
        txId: placeResult.txId,
        status: placeResult.status,
        prompt,
        raw,
        minStr,
        maxStr,
      });
      if (placeResult.txId && placeResult.status === 22) {
        successfulKeys.add(key); // 22 = Hedera SUCCESS
      }
      log.info({ betKey: key, txId: placeResult.txId }, "Bet placed");
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      log.error({ betKey: key, error: errMsg }, "Bet failed");
      results.push({
        betKey: key,
        targetTimestamp: params.targetTimestamp,
        error: errMsg,
        prompt,
        raw,
        minStr,
        maxStr,
      });
    }
  }

  artifact.results = [...(artifact.results ?? []), ...results];
  await saveArtifact(runsDir, dateStr, artifact);
  log.info({ runId }, "Daily run finished");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
