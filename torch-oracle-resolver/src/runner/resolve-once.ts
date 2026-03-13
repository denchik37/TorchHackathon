#!/usr/bin/env node
import { runResolveOnce } from '../resolve/algorithm.js';
import { logger } from '../logger.js';

async function main() {
  logger.info('Starting resolve-once run');
  const artifact = await runResolveOnce();
  logger.info(
    {
      runId: artifact.runId,
      mode: artifact.mode,
      unresolvedCounts: artifact.unresolvedCounts,
      eligibleCount: artifact.eligibleTimestamps.length,
      acceptedPrices: artifact.priceChecks.filter((p) => p.status === 'accepted').length,
      setPricesTxCount: artifact.txs.setPricesBatchTxIds.length,
    },
    'Resolve-once finished'
  );
  process.exit(artifact.errors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  logger.error(e, 'resolve-once failed');
  process.exit(1);
});
