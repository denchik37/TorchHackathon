import { z } from "zod";
import type { Client } from "@hashgraph/sdk";
import {
  ContractId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  Long,
  type TransactionReceipt,
} from "@hashgraph/sdk";
import type { Context, Tool } from "hedera-agent-kit";

const PRICE_DECIMALS = 8;
const MIN_TINYBAR = 1n;

export const TORCH_PLACE_BET_TOOL = "TORCH_PLACE_BET_TOOL" as const;

export type TorchPlaceBetResult = {
  // tx result
  txId: string;
  status?: number;
  receipt?: TransactionReceipt;

  // parse-only + artifact fields
  forecastRaw: string;
  minStr: string;
  maxStr: string;
  priceMinStr: string;
  priceMaxStr: string;
  priceMinInt: string; // 8dp fixed point bigint as string
  priceMaxInt: string; // 8dp fixed point bigint as string
  stakeHbar: string;
  stakeTinybar: string;
  executed: boolean;
};

export type TorchPlaceBetToolInput = {
  torchContractId: string;
  gasLimit: number;
  targetTimestamp: number;
  stakeHbar: string;
  forecastRaw: string; // exact "Min: x, Max: y" line
  execute: boolean; // parse-only when false
};

const torchPlaceBetToolParams = z.object({
  torchContractId: z.string().min(1),
  gasLimit: z.coerce.number().int().positive(),
  targetTimestamp: z.coerce.number().int().nonnegative(),
  stakeHbar: z.string().min(1),
  forecastRaw: z.string().min(1),
  execute: z.boolean(),
});

// Must match `src/parse/minmax.ts` so artifacts stay stable.
const MIN_MAX_REGEX =
  /^Min:\s*\[?(\d+(?:\.\d+)?)\]?\s*,\s*Max:\s*\[?(\d+(?:\.\d+)?)\]?\s*\.?\s*$/i;

function parseMinMax(text: string): { minStr: string; maxStr: string } {
  const trimmed = text.trim();
  const match = trimmed.match(MIN_MAX_REGEX);
  if (!match) {
    throw new Error(
      `Could not find "Min: x, Max: y" in: ${trimmed.slice(0, 100)}`
    );
  }

  const minStr = match[1].trim();
  const maxStr = match[2].trim();

  const min = Number(minStr);
  const max = Number(maxStr);
  if (Number.isNaN(min) || Number.isNaN(max)) {
    throw new Error(`Non-numeric min/max: ${minStr}, ${maxStr}`);
  }
  if (min <= 0) {
    throw new Error(`Min must be > 0, got ${min}`);
  }
  if (max <= min) {
    throw new Error(`Max must be > Min, got Min=${min} Max=${max}`);
  }

  return { minStr, maxStr };
}

function parseUnits(value: string, decimals: number = PRICE_DECIMALS): bigint {
  const s = value.trim();
  const [intPart, fracPart = ""] = s.split(".");
  const fracPadded = fracPart.slice(0, decimals).padEnd(decimals, "0");
  const combined =
    (intPart === "" || intPart === "-" ? "0" : intPart) + fracPadded;
  if (!/^\d+$/.test(combined)) {
    throw new Error(`Invalid number for parseUnits: ${value}`);
  }
  return BigInt(combined);
}

function parseStakeHbar(stakeHbar: string): bigint {
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

function bigintToLong(value: bigint): Long {
  return Long.fromString(value.toString(), true);
}

export async function executeTorchPlaceBet(
  client: any,
  _context: Context,
  input: TorchPlaceBetToolInput
): Promise<TorchPlaceBetResult> {
  const { minStr, maxStr } = parseMinMax(input.forecastRaw);
  const priceMinInt = parseUnits(minStr, PRICE_DECIMALS);
  const priceMaxInt = parseUnits(maxStr, PRICE_DECIMALS);
  const stakeTinybar = parseStakeHbar(input.stakeHbar);

  if (!input.execute) {
    return {
      txId: "",
      status: undefined,
      receipt: undefined,
      forecastRaw: input.forecastRaw,
      minStr,
      maxStr,
      priceMinStr: minStr,
      priceMaxStr: maxStr,
      priceMinInt: priceMinInt.toString(),
      priceMaxInt: priceMaxInt.toString(),
      stakeHbar: input.stakeHbar,
      stakeTinybar: stakeTinybar.toString(),
      executed: false,
    };
  }

  const contractId = ContractId.fromString(input.torchContractId);
  const payableAmount = Hbar.fromString(input.stakeHbar);

  const transaction = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(input.gasLimit)
    .setPayableAmount(payableAmount)
    .setFunction(
      "placeBet",
      new ContractFunctionParameters()
        .addUint256(Long.fromNumber(input.targetTimestamp, true))
        .addUint256(bigintToLong(priceMinInt))
        .addUint256(bigintToLong(priceMaxInt))
    );

  const txResponse = await transaction.execute(client as Client);
  const receipt = await txResponse.getReceipt(client as Client);

  const txId = txResponse.transactionId?.toString() ?? "";
  const status =
    receipt.status != null
      ? (receipt.status as unknown as { _code?: number })._code
      : undefined;

  return {
    txId,
    status,
    receipt,
    forecastRaw: input.forecastRaw,
    minStr,
    maxStr,
    priceMinStr: minStr,
    priceMaxStr: maxStr,
    priceMinInt: priceMinInt.toString(),
    priceMaxInt: priceMaxInt.toString(),
    stakeHbar: input.stakeHbar,
    stakeTinybar: stakeTinybar.toString(),
    executed: true,
  };
}

export const torchPlaceBetPluginToolNames = {
  TORCH_PLACE_BET_TOOL,
} as const;

export const torchPlaceBetTool = (context: Context): Tool => {
  void context;

  return {
    method: TORCH_PLACE_BET_TOOL,
    name: "TorchPredictionMarket.placeBet (custom tool)",
    description:
      "Parse forecastRaw ('Min: x, Max: y') and optionally execute TorchPredictionMarket.placeBet with payable HBAR.",
    parameters: torchPlaceBetToolParams,
    execute: async (client: any, _context: Context, params: unknown) => {
      const input = torchPlaceBetToolParams.parse(params);
      return executeTorchPlaceBet(client, _context, input);
    },
  };
};

