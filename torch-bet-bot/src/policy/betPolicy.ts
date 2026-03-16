/**
 * Deterministic conversion: Forecast -> Torch bet parameters.
 * Fixed-point price integers and HBAR stake for EVM msg.value in weibar (18 decimals by default).
 */

import { parseUnits } from "ethers";
import type { Forecast, TorchBetParams } from "../types.js";

/** Hedera EVM minimum non-zero msg.value is 1 tinybar = 10^10 weibar. */
const MIN_WEIBAR = 10_000_000_000n;

/**
 * Parse human-readable HBAR amount to EVM msg.value units (weibar, 18 decimals by default).
 * Throws if result is non-zero but below Hedera minimum (1 tinybar = 10^10 weibar).
 */
export function parseHbar(amount: string, decimals: number = 18): bigint {
  const value = parseUnits(amount, decimals);
  if (value > 0n && value < MIN_WEIBAR) {
    throw new Error(
      "BET_AMOUNT_HBAR must be at least 0.00000001 (1 tinybar) for non-zero stakes; current value is below Hedera's minimum msg.value. Increase BET_AMOUNT_HBAR."
    );
  }
  return value;
}

/** Price fixed-point decimals for Torch/frontend (always 8). */
const PRICE_DECIMALS = 8;

/**
 * Convert a forecast and stake amount into Torch bet params.
 * priceMin/priceMax use exact parsed strings with parseUnits(str, 8) for placeBet (same as frontend).
 * When priceLowStr/priceHighStr are present (from parser), use them; otherwise pad via toFixed(8).
 * Stake is converted to weibar using nativeValueDecimals (default 18) for msg.value.
 */
export function forecastToBetParams(
  forecast: Forecast,
  stakeHbar: string,
  _priceDecimals: number,
  nativeValueDecimals: number = 18
): TorchBetParams {
  const minStr = forecast.priceLowStr ?? forecast.priceLow.toFixed(PRICE_DECIMALS);
  const maxStr = forecast.priceHighStr ?? forecast.priceHigh.toFixed(PRICE_DECIMALS);
  const priceLowInt = parseUnits(minStr, PRICE_DECIMALS);
  const priceHighInt = parseUnits(maxStr, PRICE_DECIMALS);
  const stakeValue = parseHbar(stakeHbar, nativeValueDecimals);
  return {
    symbol: "HBAR",
    targetTimestamp: forecast.targetTimestamp,
    priceLowInt,
    priceHighInt,
    stakeValue,
  };
}
