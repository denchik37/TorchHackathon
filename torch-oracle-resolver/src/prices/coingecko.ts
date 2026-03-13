import { getEnv } from '../config/env.js';
import { logger } from '../logger.js';

const COINGECKO_RANGE =
  'https://api.coingecko.com/api/v3/coins/hedera-hashgraph/market_chart/range';

export interface CoinGeckoRangePoint {
  timestampMs: number;
  priceUsd: number;
}

/**
 * Fetch HBAR price history around a target timestamp.
 * Uses market_chart/range with ±300s window, then picks closest point to ts (or avg within ±60s).
 */
export async function fetchPriceAtTimestamp(
  targetTimestampSeconds: number
): Promise<number | null> {
  const env = getEnv();
  const from = targetTimestampSeconds - 300;
  const to = targetTimestampSeconds + 300;
  const url = `${COINGECKO_RANGE}?vs_currency=usd&from=${from}&to=${to}${
    env.COINGECKO_API_KEY ? `&x_cg_pro_api_key=${env.COINGECKO_API_KEY}` : ''
  }`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn({ status: res.status, targetTimestampSeconds }, 'CoinGecko range request failed');
      return null;
    }
    const json = (await res.json()) as { prices?: [number, number][] };
    const prices = json.prices ?? [];
    if (prices.length === 0) return null;

    const targetMs = targetTimestampSeconds * 1000;
    const within60s = prices.filter(
      ([t]) => Math.abs(t - targetMs) <= 60 * 1000
    );
    const use = within60s.length >= 2 ? within60s : prices;

    let closest = use[0];
    let minDiff = Math.abs(use[0][0] - targetMs);
    for (let i = 1; i < use.length; i++) {
      const d = Math.abs(use[i][0] - targetMs);
      if (d < minDiff) {
        minDiff = d;
        closest = use[i];
      }
    }
    return closest[1];
  } catch (e) {
    logger.error({ err: e, targetTimestampSeconds }, 'CoinGecko fetch error');
    return null;
  }
}

/**
 * Current HBAR price (for dashboard / oracle cross-check).
 */
export async function fetchCurrentPrice(): Promise<number | null> {
  const env = getEnv();
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd${
    env.COINGECKO_API_KEY ? `&x_cg_pro_api_key=${env.COINGECKO_API_KEY}` : ''
  }`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { 'hedera-hashgraph'?: { usd?: number } };
    return json['hedera-hashgraph']?.usd ?? null;
  } catch (e) {
    logger.error({ err: e }, 'CoinGecko current price error');
    return null;
  }
}
