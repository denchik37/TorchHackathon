#!/usr/bin/env node
import { getEnv } from '../config/env.js';
import { runResolveOnce } from '../resolve/algorithm.js';
import { logger } from '../logger.js';

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function main() {
  const env = getEnv();
  const intervalMs = env.RESOLVE_LOOP_INTERVAL_MS
    ? Number(env.RESOLVE_LOOP_INTERVAL_MS)
    : INTERVAL_MS;

  logger.info({ intervalMinutes: intervalMs / 60_000 }, 'Resolver loop started');

  const run = async () => {
    try {
      await runResolveOnce();
    } catch (e) {
      logger.error({ err: e }, 'Resolver loop iteration failed');
    }
  };

  await run();
  setInterval(run, intervalMs);
}

main().catch((e) => {
  logger.error(e, 'resolve-loop failed');
  process.exit(1);
});
