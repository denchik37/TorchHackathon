/**
 * Parse "Min: x, Max: y" from model output.
 * Accepts: "Min: [0.09543], Max: [0.10690]" or "Min: 0.09543, Max: 0.10690" with optional trailing period.
 */

const MIN_MAX_REGEX =
  /^Min:\s*\[?(\d+(?:\.\d+)?)\]?\s*,\s*Max:\s*\[?(\d+(?:\.\d+)?)\]?\s*\.?\s*$/i;

export interface MinMaxResult {
  minStr: string;
  maxStr: string;
  min: number;
  max: number;
}

export interface ParseMinMaxSuccess {
  ok: true;
  minStr: string;
  maxStr: string;
  min: number;
  max: number;
}

export interface ParseMinMaxFailure {
  ok: false;
  error: string;
}

export type ParseMinMaxOut = ParseMinMaxSuccess | ParseMinMaxFailure;

export function parseMinMax(text: string): ParseMinMaxOut {
  const trimmed = text.trim();
  const match = trimmed.match(MIN_MAX_REGEX);
  if (!match) {
    return { ok: false, error: `Could not find "Min: x, Max: y" in: ${trimmed.slice(0, 100)}` };
  }

  const minStr = match[1].trim();
  const maxStr = match[2].trim();
  const min = Number(minStr);
  const max = Number(maxStr);

  if (Number.isNaN(min) || Number.isNaN(max)) {
    return { ok: false, error: `Non-numeric min/max: ${minStr}, ${maxStr}` };
  }
  if (min <= 0) {
    return { ok: false, error: `Min must be > 0, got ${min}` };
  }
  if (max <= min) {
    return { ok: false, error: `Max must be > Min, got Min=${min} Max=${max}` };
  }

  return { ok: true, minStr, maxStr, min, max };
}
