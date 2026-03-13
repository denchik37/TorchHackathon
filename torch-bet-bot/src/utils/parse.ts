/**
 * Robust parsing of "Min: x, Max: y" from model output.
 * Accepts both formats:
 *   - "Min: [0.09585], Max: [0.10737]."
 *   - "Min: 0.09543, Max: 0.10690"
 * (optional brackets, optional trailing period; anchored ^...$). Validates min > 0, max > min.
 */

import type { ForecastParseResult } from "../types.js";

// One line only: optional square brackets, optional trailing period; anchored so no extra text.
const MIN_MAX_REGEX =
  /^Min:\s*\[?(\d+(?:\.\d+)?)\]?\s*,\s*Max:\s*\[?(\d+(?:\.\d+)?)\]?\s*\.?\s*$/i;

/**
 * Parse a single line/response into numeric min/max.
 * Returns ok: false if format invalid or validation fails (min > 0, max > min).
 */
export function parseMinMax(
  text: string,
  targetTimestamp: number,
  dayLabel: string
): ForecastParseResult {
  const trimmed = text.trim();
  const match = trimmed.match(MIN_MAX_REGEX);
  if (!match) {
    return { ok: false, error: `Could not find "Min: x, Max: y" in: ${trimmed.slice(0, 100)}` };
  }

  const minStr = match[1].trim();
  const maxStr = match[2].trim();
  const priceLow = Number(minStr);
  const priceHigh = Number(maxStr);

  if (Number.isNaN(priceLow) || Number.isNaN(priceHigh)) {
    return { ok: false, error: `Non-numeric min/max: ${minStr}, ${maxStr}` };
  }
  if (priceLow <= 0) {
    return { ok: false, error: `Min must be > 0, got ${priceLow}` };
  }
  if (priceHigh <= priceLow) {
    return { ok: false, error: `Max must be > Min, got Min=${priceLow} Max=${priceHigh}` };
  }

  return {
    ok: true,
    forecast: {
      targetTimestamp,
      dayLabel,
      priceLow,
      priceHigh,
      priceLowStr: minStr,
      priceHighStr: maxStr,
      raw: trimmed,
    },
  };
}