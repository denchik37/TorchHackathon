import { z } from "zod";
import type { Client } from "@hashgraph/sdk";
import { placeBet, type PlaceBetResult } from "../hedera/torch.js";

/**
 * Custom Hedera Agent Kit plugin tool:
 * - Exposes a single deterministic action: TorchPredictionMarket.placeBet(...)
 * - Tool input uses JSON-safe strings for bigint values.
 * - Execution reuses your existing placeBet() so on-chain behavior stays identical.
 */

export const TORCH_PLACE_BET_TOOL = "TORCH_PLACE_BET_TOOL" as const;

export type TorchPlaceBetToolInput = {
  targetTimestamp: number;
  priceMinInt: string; // bigint decimal string (8dp fixed point)
  priceMaxInt: string; // bigint decimal string (8dp fixed point)
  stakeTinybar: string; // bigint decimal string
  stakeHbar: string; // payable HBAR amount as string (used by placeBet for payableAmount)
};

const torchPlaceBetToolParams = z.object({
  targetTimestamp: z.coerce.number().int(),
  priceMinInt: z.string().min(1),
  priceMaxInt: z.string().min(1),
  stakeTinybar: z.string().min(1),
  stakeHbar: z.string().min(1),
});

export async function executeTorchPlaceBet(
  client: Client,
  input: TorchPlaceBetToolInput
): Promise<PlaceBetResult> {
  // Convert JSON-safe string inputs back to the exact types expected by placeBet().
  return placeBet(client, {
    targetTimestamp: input.targetTimestamp,
    priceMinInt: BigInt(input.priceMinInt),
    priceMaxInt: BigInt(input.priceMaxInt),
    stakeTinybar: BigInt(input.stakeTinybar),
    stakeHbar: input.stakeHbar,
  });
}

// Hedera Agent Kit plugin shape:
// - tools: (context) => Tool[]
// We keep types loose here to avoid tight coupling to internal toolkit type exports.
export const torchPlaceBetPlugin = {
  name: "torch-place-bet-plugin",
  version: "1.0.0",
  description:
    "Custom tool that executes TorchPredictionMarket.placeBet via your existing Hedera SDK implementation.",
  tools: () => [
    {
      method: TORCH_PLACE_BET_TOOL,
      name: "TorchPredictionMarket.placeBet",
      description:
        "Execute a TorchPredictionMarket.placeBet(targetTimestamp, priceMin, priceMax) payable transaction.",
      parameters: torchPlaceBetToolParams,
      execute: async (
        client: Client,
        _context: unknown,
        params: TorchPlaceBetToolInput
      ) => {
        const parsed = torchPlaceBetToolParams.parse(params);
        return executeTorchPlaceBet(client, parsed);
      },
    },
  ],
} as const;

export const torchPlaceBetPluginToolNames = {
  TORCH_PLACE_BET_TOOL,
} as const;

