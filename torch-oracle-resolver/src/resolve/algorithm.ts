import { parseUnits } from 'ethers';
import { getEnv } from '../config/env.js';
import { logger } from '../logger.js';
import type { PriceCheckResult, ResolverRunArtifact } from '../types.js';
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
  const bucketBlocked: NonNullable<ResolverRunArtifact['bucketBlocked']> = [];
  const bucketErrors: NonNullable<ResolverRunArtifact['bucketErrors']> = [];
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

    const state = await loadState();
    let stateDirty = false;
    let newCacheCount = 0;

    const allTimestamps = Array.from(work.timestampsToBets.keys()).sort((a, b) => a - b);
    const eligibilityPool: number[] = [];
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
      eligibilityPool.push(ts);
    }

    const unresolvedEligible = eligibilityPool.filter(
      (ts) => !state.resolvedTimestamps[String(ts)]
    );
    const maxTsPerRun =
      env.MAX_TIMESTAMPS_PER_TX * MAX_TIMESTAMPS_PER_RUN_MULTIPLIER;
    eligibleTimestamps = unresolvedEligible.slice(0, maxTsPerRun);
    const acceptedTimestamps: number[] = [];
    const acceptedPrices8dp: bigint[] = [];
    const acceptedPriceByTs = new Map<number, number>();

    const getCachedPrice = (ts: number): number | null => {
      const key = String(ts);
      const entry = state.priceCache[key];
      if (entry && entry.source === 'coingecko') {
        logger.debug({ ts }, 'CoinGecko cache hit');
        return entry.priceUsd;
      }
      return null;
    };

    const setCachedPrice = (ts: number, price: number) => {
      const key = String(ts);
      const exists = Boolean(state.priceCache[key]);
      state.priceCache[key] = {
        priceUsd: price,
        fetchedAtUtc: timestampUtc,
        source: 'coingecko',
      };
      if (!exists) {
        state.priceCacheOrder.push(key);
      }
      stateDirty = true;
      newCacheCount += 1;
      logger.info({ ts, priceUsd: price }, 'Cached CoinGecko price');

      const envLocal = env;
      let evicted = 0;
      while (state.priceCacheOrder.length > envLocal.COINGECKO_CACHE_MAX_ENTRIES) {
        const oldest = state.priceCacheOrder.shift();
        if (oldest && state.priceCache[oldest]) {
          delete state.priceCache[oldest];
          evicted += 1;
        }
      }
      if (evicted > 0) {
        logger.warn({ evictedCount: evicted }, 'Evicted old entries from CoinGecko cache');
      }
    };

    const maybePersistState = async () => {
      if (stateDirty && newCacheCount >= 10) {
        await saveState(state);
        stateDirty = false;
        newCacheCount = 0;
      }
    };

    for (const ts of eligibleTimestamps) {
      if (state.resolvedTimestamps[String(ts)]) {
        continue;
      }

      let cgPrice = getCachedPrice(ts);
      if (cgPrice == null) {
        cgPrice = await fetchPriceAtTimestamp(ts);
        if (cgPrice != null && cgPrice > 0) {
          setCachedPrice(ts, cgPrice);
          await maybePersistState();
        }
      }
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
        ...(reason !== undefined && { reason }),
      });

      if (status === 'accepted' && cgPrice != null) {
        acceptedTimestamps.push(ts);
        acceptedPrices8dp.push(parseUnits(cgPrice.toFixed(8), 8));
        acceptedPriceByTs.set(ts, cgPrice);
      }
    }

    state.lastRunAt = timestampUtc;
    stateDirty = true;

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
            const key = String(tsBatch[j]);
            state.resolvedTimestamps[key] = txId;
            if (state.blockedTimestamps[key] != null) {
              delete state.blockedTimestamps[key];
            }
          }
          stateDirty = true;
        }
      }

      // Build bucket -> timestamps mapping and gate by price availability and eligibility
      const bucketToTimestamps = new Map<number, Set<number>>();
      for (const [ts, bets] of work.timestampsToBets.entries()) {
        for (const bet of bets) {
          const set = bucketToTimestamps.get(bet.bucket) ?? new Set<number>();
          set.add(ts);
          bucketToTimestamps.set(bet.bucket, set);
        }
      }

      const bucketsToProcess = Array.from(work.bucketsById.keys())
        .map(Number)
        .slice(0, env.MAX_BUCKETS_PER_RUN);

      for (const bucketIndex of bucketsToProcess) {
        const bucketId = String(bucketIndex);
        const txIds: string[] = [];
        let completed = false;
        let nextProcessIndex: number | undefined;
        let totalBets: number | undefined;
        const client = createHederaClient();
        let txCount = 0;

        const tsSet = bucketToTimestamps.get(bucketIndex) ?? new Set<number>();
        const uniqueTs = Array.from(tsSet.values());

        logger.info(
          { bucketIndex, tsCount: uniqueTs.length },
          'Processing bucket candidate'
        );

        const missingTs: number[] = [];
        const notEligibleTs: number[] = [];
        for (const ts of uniqueTs) {
          const hasAcceptedPrice = acceptedPriceByTs.has(ts);
          const wasPreviouslySet = state.resolvedTimestamps[String(ts)] != null;
          if (!hasAcceptedPrice && !wasPreviouslySet) {
            missingTs.push(ts);
          }
          if (ts > cutoffEligible) {
            notEligibleTs.push(ts);
          }
        }

        if (missingTs.length > 0 || notEligibleTs.length > 0) {
          bucketBlocked.push({
            bucketId,
            missingTs,
            notEligibleTs,
            reason: 'Bucket has timestamps without prices or not yet eligible',
          });
          logger.warn(
            {
              bucketIndex,
              missingCount: missingTs.length,
              notEligibleCount: notEligibleTs.length,
              sampleMissing: missingTs.slice(0, 3),
            },
            'Skipping bucket due to missing or not-eligible timestamps'
          );
          continue;
        }

        while (txCount < env.MAX_PROCESS_BATCH_TX_PER_BUCKET) {
          const info = await getBucketInfo(client, bucketIndex);
          if (info?.aggregationComplete) {
            completed = true;
            nextProcessIndex = info.nextProcessIndex;
            totalBets = info.totalBets;
            break;
          }
          const res = await processBatch(client, bucketIndex);
          if (!res.ok) {
            bucketErrors.push({
              bucketId,
              txId: res.txId,
              ...(res.status !== undefined && { status: res.status }),
              ...(res.errorMessage !== undefined && { errorMessage: res.errorMessage }),
            });
            logger.error(
              {
                bucketIndex,
                txId: res.txId,
                status: res.status,
                errorMessage: res.errorMessage,
              },
              'processBatch failed for bucket'
            );
            break;
          }
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
          ...(nextProcessIndex !== undefined && { nextProcessIndex }),
          ...(totalBets !== undefined && { totalBets }),
        });
        processBatchTxIds.push({ bucketId, txIds });
      }
    } else if (acceptedTimestamps.length > 0 && env.DRY_RUN) {
      logger.info(
        { count: acceptedTimestamps.length, timestamps: acceptedTimestamps },
        'DRY_RUN: would setPricesForTimestamps and process buckets'
      );
    }

    if (stateDirty) {
      await saveState(state);
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    errors.push({
      message: err.message,
      ...(err.stack !== undefined && { stack: err.stack }),
    });
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
    bucketBlocked,
    bucketErrors,
    errors,
  };

  await persistRunArtifact(artifact);
  return artifact;
}
