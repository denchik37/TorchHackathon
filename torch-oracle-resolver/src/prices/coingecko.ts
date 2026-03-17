import { getEnv } from '../config/env.js';
import { logger } from '../logger.js';

const COINGECKO_RANGE =
  'https://api.coingecko.com/api/v3/coins/hedera-hashgraph/market_chart/range';

export interface CoinGeckoRangePoint {
  timestampMs: number;
  priceUsd: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;

async function fetchWithBackoff(
  url: string,
  targetTimestampSeconds: number
): Promise<Response> {
  const env = getEnv();
  const {
    COINGECKO_MIN_DELAY_MS,
    COINGECKO_MAX_RETRIES,
    COINGECKO_BACKOFF_BASE_MS,
    COINGECKO_BACKOFF_MAX_MS,
    COINGECKO_JITTER_PCT,
  } = env;

  for (let attempt = 0; attempt <= COINGECKO_MAX_RETRIES; attempt++) {
    const now = Date.now();
    const sinceLast = now - lastRequestAt;
    if (sinceLast < COINGECKO_MIN_DELAY_MS) {
      await sleep(COINGECKO_MIN_DELAY_MS - sinceLast);
    }

    const res = await fetch(url);
    lastRequestAt = Date.now();

    if (res.status !== 429) {
      return res;
    }

    const baseDelay = Math.min(
      COINGECKO_BACKOFF_MAX_MS,
      COINGECKO_BACKOFF_BASE_MS * Math.pow(2, attempt)
    );
    const jitterFactor = 1 + (Math.random() * 2 - 1) * COINGECKO_JITTER_PCT;
    const delayMs = Math.max(0, Math.floor(baseDelay * jitterFactor));

    logger.warn(
      { ts: targetTimestampSeconds, attempt, delayMs },
      'CoinGecko rate limited; backing off'
    );
    await sleep(delayMs);
  }

  throw new Error(
    `CoinGecko 429 after max retries for ts=${targetTimestampSeconds}`
  );
}

const FETCH_WINDOW_SEC = 3600;
const PREFERRED_WINDOW_SEC = 900;
const MAX_DISTANCE_SEC = 7200;

function isValidPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Fetch HBAR price history around a target timestamp.
 * Uses market_chart/range with a wide window (target ±3600s), then either
 * averages points within ±900s or uses the single nearest point if within 7200s.
 */
export async function fetchPriceAtTimestamp(
  targetTimestampSeconds: number
): Promise<number | null> {
  const env = getEnv();
  const from = targetTimestampSeconds - FETCH_WINDOW_SEC;
  const to = targetTimestampSeconds + FETCH_WINDOW_SEC;
  const url = `${COINGECKO_RANGE}?vs_currency=usd&from=${from}&to=${to}${
    env.COINGECKO_API_KEY ? `&x_cg_pro_api_key=${env.COINGECKO_API_KEY}` : ''
  }`;

  logger.debug(
    { targetTimestampSeconds, from, to },
    'CoinGecko historical fetch range'
  );

  try {
    const res = await fetchWithBackoff(url, targetTimestampSeconds);
    if (!res.ok) {
      logger.warn(
        { status: res.status, targetTimestampSeconds, from, to },
        'CoinGecko range request failed'
      );
      return null;
    }

    const raw = await res.json();
    const pricesRaw = raw?.prices;
    if (!Array.isArray(pricesRaw)) {
      logger.warn(
        { targetTimestampSeconds, hasPrices: !!pricesRaw },
        'CoinGecko response missing or invalid prices array'
      );
      return null;
    }

    const targetMs = targetTimestampSeconds * 1000;
    const points: { timestampMs: number; price: number }[] = [];
    for (const entry of pricesRaw) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const t = entry[0];
      const p = entry[1];
      if (typeof t !== 'number' || !Number.isFinite(t)) continue;
      if (!isValidPrice(p)) continue;
      points.push({ timestampMs: t, price: p });
    }

    logger.info(
      { targetTimestampSeconds, from, to, pointCount: points.length },
      'CoinGecko historical price points returned'
    );

    if (points.length === 0) {
      logger.warn(
        { targetTimestampSeconds, from, to },
        'CoinGecko returned no valid price points; reason: no valid points in range'
      );
      return null;
    }

    const withinPreferred = points.filter(
      (pt) => Math.abs(pt.timestampMs - targetMs) <= PREFERRED_WINDOW_SEC * 1000
    );

    let selectedPrice: number | null = null;

    if (withinPreferred.length >= 1) {
      const avg =
        withinPreferred.reduce((sum, pt) => sum + pt.price, 0) /
        withinPreferred.length;
      if (isValidPrice(avg)) {
        selectedPrice = avg;
        const nearestInGroup = withinPreferred.reduce((best, pt) =>
          Math.abs(pt.timestampMs - targetMs) <
          Math.abs(best.timestampMs - targetMs)
            ? pt
            : best
        );
        const diffSec = Math.abs(nearestInGroup.timestampMs - targetMs) / 1000;
        logger.info(
          {
            targetTimestampSeconds,
            nearestPointTimestampSec: Math.round(nearestInGroup.timestampMs / 1000),
            diffSec: Math.round(diffSec * 10) / 10,
            pointsAveraged: withinPreferred.length,
            selectedPrice: avg,
          },
          'CoinGecko historical: using average of points within preferred window'
        );
      } else {
        logger.warn(
          { targetTimestampSeconds, avg, pointsAveraged: withinPreferred.length },
          'CoinGecko historical: average of points within ±900s invalid (non-finite or <= 0), falling back to nearest'
        );
      }
    }

    if (selectedPrice == null) {
      let nearest = points[0];
      let minDiffMs = Math.abs(points[0].timestampMs - targetMs);
      for (let i = 1; i < points.length; i++) {
        const d = Math.abs(points[i].timestampMs - targetMs);
        if (d < minDiffMs) {
          minDiffMs = d;
          nearest = points[i];
        }
      }
      const diffSec = minDiffMs / 1000;

      if (diffSec > MAX_DISTANCE_SEC) {
        logger.warn(
          {
            targetTimestampSeconds,
            nearestPointTimestampSec: Math.round(nearest.timestampMs / 1000),
            diffSec: Math.round(diffSec * 10) / 10,
            maxAllowedSec: MAX_DISTANCE_SEC,
          },
          'CoinGecko historical: nearest point too far; reason: exceeds max distance'
        );
        return null;
      }

      if (!isValidPrice(nearest.price)) {
        logger.warn(
          { targetTimestampSeconds, nearestPrice: nearest.price },
          'CoinGecko historical: nearest point price invalid; reason: non-finite or <= 0'
        );
        return null;
      }

      selectedPrice = nearest.price;
      logger.info(
        {
          targetTimestampSeconds,
          nearestPointTimestampSec: Math.round(nearest.timestampMs / 1000),
          diffSec: Math.round(diffSec * 10) / 10,
          selectedPrice: nearest.price,
        },
        'CoinGecko historical: using single nearest point'
      );
    }

    return selectedPrice;
  } catch (e) {
    logger.error(
      { err: e, targetTimestampSeconds },
      'CoinGecko fetch error'
    );
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
