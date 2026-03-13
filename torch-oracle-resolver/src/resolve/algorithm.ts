import { parseUnits } from 'ethers';
import { getEnv } from '../config/env.js';
import { logger } from '../logger.js';
import type { UnresolvedWork, PriceCheckResult, ResolverRunArtifact, ResolverState } from '../types.js';
import { fetchUnresolvedBets } from '../subgraph/client.js';
import { fetchPriceAtTimestamp } from '../prices/coingecko.js';
import { fetchOraclePrice } from '../prices/oracle.js';
import { loadState, saveState, persistRunArtifact } from '../state/persist.js';
import {
  createHederaClient,
  setPricesForTimestamps,
  processBatch,
  getBucketInfo,
} from '../hedera/client.js';

const MAX_TIMESTAMPS_PER_RUN_MULTIPLIER = 2;

export async function runResolveOnce(): Promise<ResolverRunArtifact> {
  const env = getEnv();
  const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const timestampUtc = new Date().toISOString();
  const mode = env.DRY_RUN ? 'dryRun' : 'live';
  const errors: ResolverRunArtifact['errors'] = [];
  const priceChecks: PriceCheckResult[] = [];
  const setPricesBatchTxIds: string[] = [];
  const processBatchTxIds: ResolverRunArtifact['txs']['processBatchTxIds'] = [];
  const bucketResults: ResolverRunArtifact['bucketResults'] = [];

  let unresolvedCounts = { bets: 0, buckets: 0, uniqueTimestamps: 0 };
  let eligibleTimestamps: number[] = [];
  let skippedTooSoon: number[] = [];
  let skippedTooOld: number[] = [];

  const nowUnix = Math.floor(Date.now() / 1000);
  const bufferSec = env.FINALIZATION_BUFFER_SECONDS;
  const maxAgeSec = env.BACKLOG_MAX_AGE_DAYS * 24 * 60 * 60;
  const cutoffOld = nowUnix - maxAgeSec;
  const cutoffEligible = nowUnix - bufferSec;

  let backlogStart: number | null = null;
  if (env.BACKLOG_START_FROM !== 'auto') {
    backlogStart = Math.floor(new Date(env.BACKLOG_START_FROM).getTime() / 1000);
  }

  try {
    const work = await fetchUnresolvedBets();
    unresolvedCounts = {
      bets: work.bets.length,
      buckets: work.bucketsById.size,
      uniqueTimestamps: work.timestampsToBets.size,
    };

    const allTimestamps = Array.from(work.timestampsToBets.keys()).sort((a, b) => a - b);

    for (const ts of allTimestamps) {
      if (ts > cutoffEligible) {
        skippedTooSoon.push(ts);
        continue;
      }
      if (backlogStart != null && ts < backlogStart) {
        skippedTooOld.push(ts);
        continue;
      }
      if (backlogStart == null && ts < cutoffOld) {
        skippedTooOld.push(ts);
        continue;
      }
      eligibleTimestamps.push(ts);
    }

    const maxTsPerRun =
      env.MAX_TIMESTAMPS_PER_TX * MAX_TIMESTAMPS_PER_RUN_MULTIPLIER;
    eligibleTimestamps = eligibleTimestamps.slice(0, maxTsPerRun);

    const state = await loadState();
    const acceptedTimestamps: number[] = [];
    const acceptedPrices8dp: bigint[] = [];

    for (const ts of eligibleTimestamps) {
      if (state.resolvedTimestamps[String(ts)]) {
        continue;
      }
      const cgPrice = await fetchPriceAtTimestamp(ts);
      let oraclePrice: number | null = null;
      try {
        oraclePrice = await fetchOraclePrice();
      } catch (e) {
        logger.warn({ err: e }, 'Oracle price fetch failed');
      }

      let divergencePct: number | null = null;
      let status: PriceCheckResult['status'] = 'accepted';
      let reason: string | undefined;

      if (cgPrice == null || cgPrice <= 0) {
        status = 'blocked';
        reason = 'CoinGecko price missing or invalid';
        if (state.blockedTimestamps[String(ts)] == null) {
          state.blockedTimestamps[String(ts)] = {
            reason,
            lastSeenAt: timestampUtc,
          };
        }
      } else if (oraclePrice != null && oraclePrice > 0 && env.MAX_PRICE_DIVERGENCE_PCT > 0) {
        divergencePct = Math.abs(cgPrice - oraclePrice) / cgPrice * 100;
        if (divergencePct > env.MAX_PRICE_DIVERGENCE_PCT) {
          status = 'blocked';
          reason = `Divergence ${divergencePct.toFixed(2)}% > ${env.MAX_PRICE_DIVERGENCE_PCT}%`;
          state.blockedTimestamps[String(ts)] = { reason, lastSeenAt: timestampUtc };
        }
      }

      priceChecks.push({
        timestamp: ts,
        coinGeckoPrice: cgPrice,
        oraclePrice,
        divergencePct,
        status,
        reason,
      });

      if (status === 'accepted' && cgPrice != null) {
        acceptedTimestamps.push(ts);
        acceptedPrices8dp.push(parseUnits(cgPrice.toFixed(8), 8));
      }
    }

    state.lastRunAt = timestampUtc;

    if (!env.DRY_RUN && (acceptedTimestamps.length > 0 || work.bucketsById.size > 0)) {
      const client = createHederaClient();

      if (acceptedTimestamps.length > 0) {
        const batchSize = env.MAX_TIMESTAMPS_PER_TX;
        for (let i = 0; i < acceptedTimestamps.length; i += batchSize) {
          const tsBatch = acceptedTimestamps.slice(i, i + batchSize);
          const priceBatch = acceptedPrices8dp.slice(i, i + batchSize);
          const { txId } = await setPricesForTimestamps(client, tsBatch, priceBatch);
          setPricesBatchTxIds.push(txId);
          for (let j = 0; j < tsBatch.length; j++) {
            state.resolvedTimestamps[String(tsBatch[j])] = txId;
          }
        }
      }

      const bucketsToProcess = Array.from(work.bucketsById.keys()).map(Number).slice(0, env.MAX_BUCKETS_PER_RUN);

      for (const bucketIndex of bucketsToProcess) {
        const bucketId = String(bucketIndex);
        const txIds: string[] = [];
        let completed = false;
        let nextProcessIndex: number | undefined;
        let totalBets: number | undefined;
        const client = createHederaClient();
        let txCount = 0;

        while (txCount < env.MAX_PROCESS_BATCH_TX_PER_BUCKET) {
          const info = await getBucketInfo(client, bucketIndex);
          if (info?.aggregationComplete) {
            completed = true;
            nextProcessIndex = info.nextProcessIndex;
            totalBets = info.totalBets;
            break;
          }
          const res = await processBatch(client, bucketIndex);
          txIds.push(res.txId);
          txCount++;
          const updated = await getBucketInfo(client, bucketIndex);
          if (updated?.aggregationComplete) {
            completed = true;
            nextProcessIndex = updated.nextProcessIndex;
            totalBets = updated.totalBets;
            break;
          }
        }

        bucketResults.push({
          bucketId,
          processedTxCount: txIds.length,
          completed,
          nextProcessIndex,
          totalBets,
        });
        processBatchTxIds.push({ bucketId, txIds });
      }
    } else if (acceptedTimestamps.length > 0 && env.DRY_RUN) {
      logger.info(
        { count: acceptedTimestamps.length, timestamps: acceptedTimestamps },
        'DRY_RUN: would setPricesForTimestamps and process buckets'
      );
    }

    await saveState(state);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    errors.push({ message: err.message, stack: err.stack });
    logger.error({ err }, 'Resolver run error');
  }

  const artifact: ResolverRunArtifact = {
    runId,
    timestampUtc,
    mode,
    unresolvedCounts,
    eligibleTimestamps,
    skippedTooSoon,
    skippedTooOld,
    priceChecks,
    txs: {
      setPricesBatchTxIds,
      processBatchTxIds,
    },
    bucketResults,
    errors,
  };

  await persistRunArtifact(artifact);
  return artifact;
}
