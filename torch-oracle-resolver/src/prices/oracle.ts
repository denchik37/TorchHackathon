import { getEnv } from '../config/env.js';
import { logger } from '../logger.js';

/**
 * Oracle provider: Chainlink or Pyth.
 * Returns latest available HBAR/USD price for divergence check.
 * For "historical" we use CoinGecko; oracle is cross-check at "now" or latest round.
 */
export async function fetchOraclePrice(): Promise<number | null> {
  const env = getEnv();
  if (env.ORACLE_PROVIDER === 'chainlink') {
    return fetchChainlinkHbarUsd();
  }
  if (env.ORACLE_PROVIDER === 'pyth') {
    return fetchPythHbarUsd();
  }
  logger.warn({ provider: env.ORACLE_PROVIDER }, 'Unknown oracle provider');
  return null;
}

/**
 * Chainlink: read latest round data from HBAR/USD feed.
 * Feed ID is network-dependent; use placeholder - in production set CHAINLINK_HBAR_USD_FEED.
 */
async function fetchChainlinkHbarUsd(): Promise<number | null> {
  const feedId = process.env.CHAINLINK_HBAR_USD_FEED;
  if (!feedId) {
    logger.debug('CHAINLINK_HBAR_USD_FEED not set, skipping oracle price');
    return null;
  }
  try {
    // If running in Node with Hedera SDK, we could use ContractCallQuery to read the feed.
    // For simplicity we use a public RPC/API if available, or return null (divergence check skipped).
    const res = await fetch(feedId);
    if (!res.ok) return null;
    const data = (await res.json()) as { answer?: string; result?: string };
    const raw = data.answer ?? data.result;
    if (raw == null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch (e) {
    logger.warn({ err: e }, 'Chainlink fetch failed');
    return null;
  }
}

/**
 * Pyth: latest HBAR/USD price from Pyth API or contract.
 * Set PYTH_HBAR_USD_PRICE_URL or similar for server-side fetch.
 */
async function fetchPythHbarUsd(): Promise<number | null> {
  const url = process.env.PYTH_HBAR_USD_PRICE_URL;
  if (!url) {
    logger.debug('PYTH_HBAR_USD_PRICE_URL not set, skipping oracle price');
    return null;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: number; value?: number };
    const value = data.price ?? data.value;
    return Number.isFinite(value) ? value : null;
  } catch (e) {
    logger.warn({ err: e }, 'Pyth fetch failed');
    return null;
  }
}
