/**
 * Convert parsed min/max strings to 8dp fixed-point bigint; stake to Hbar.
 * parseUnits(str, 8) => bigint (no ethers dependency).
 */

const PRICE_DECIMALS = 8;
const ONE = 10n ** BigInt(PRICE_DECIMALS);

/**
 * Parse a decimal string to 8-decimal fixed-point bigint (same as frontend).
 */
export function parseUnits(value: string, decimals: number = PRICE_DECIMALS): bigint {
  const s = value.trim();
  const [intPart, fracPart = ""] = s.split(".");
  const fracPadded = fracPart.slice(0, decimals).padEnd(decimals, "0");
  const combined = (intPart === "" || intPart === "-" ? "0" : intPart) + fracPadded;
  if (!/^\d+$/.test(combined)) {
    throw new Error(`Invalid number for parseUnits: ${value}`);
  }
  return BigInt(combined);
}

/** Minimum payable: 1 tinybar = 1e8 tinybars per HBAR, so 1 tinybar = 1 (in tinybars). */
const MIN_TINYBAR = 1n;

/**
 * Parse HBAR amount string to tinybars (1 HBAR = 1e8 tinybars).
 * Enforce >= 1 tinybar for non-zero stake.
 */
export function parseStakeHbar(stakeHbar: string): bigint {
  const [intPart, fracPart = ""] = stakeHbar.trim().split(".");
  const fracPadded = fracPart.slice(0, 8).padEnd(8, "0");
  const combined = (intPart === "" ? "0" : intPart) + fracPadded;
  if (!/^\d+$/.test(combined)) {
    throw new Error(`Invalid HBAR amount: ${stakeHbar}`);
  }
  const tinybars = BigInt(combined);
  if (tinybars > 0n && tinybars < MIN_TINYBAR) {
    throw new Error(
      "Stake must be at least 0.00000001 HBAR (1 tinybar) for non-zero stakes."
    );
  }
  return tinybars;
}

export interface TorchBetParams {
  targetTimestamp: number;
  priceMinInt: bigint;
  priceMaxInt: bigint;
  stakeTinybar: bigint;
  stakeHbar: string;
}

/**
 * Build bet params from parsed min/max strings and stake.
 */
export function buildBetParams(
  targetTimestamp: number,
  minStr: string,
  maxStr: string,
  stakeHbar: string
): TorchBetParams {
  const priceMinInt = parseUnits(minStr, PRICE_DECIMALS);
  const priceMaxInt = parseUnits(maxStr, PRICE_DECIMALS);
  const stakeTinybar = parseStakeHbar(stakeHbar);
  return { targetTimestamp, priceMinInt, priceMaxInt, stakeTinybar, stakeHbar };
}
