/**
 * Place bet via Hedera SDK ContractExecuteTransaction (Agent Kit style).
 * placeBet(targetTimestamp, priceMin, priceMax) payable; amount in HBAR (SDK uses tinybars).
 */

import {
  Client,
  ContractId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  Long,
  TransactionReceipt,
} from "@hashgraph/sdk";
import { getEnv } from "../config/env.js";
import type { TorchBetParams } from "../policy/betPolicy.js";

export interface PlaceBetResult {
  txId: string;
  status?: number;
  receipt?: TransactionReceipt;
}

function bigintToLong(value: bigint): Long {
  return Long.fromString(value.toString(), true);
}

export async function placeBet(
  client: Client,
  params: TorchBetParams
): Promise<PlaceBetResult> {
  const env = getEnv();
  const contractId = ContractId.fromString(env.TORCH_CONTRACT_ID);
  const payableAmount = Hbar.fromString(params.stakeHbar);

  const transaction = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(env.GAS_LIMIT)
    .setPayableAmount(payableAmount)
    .setFunction(
      "placeBet",
      new ContractFunctionParameters()
        .addUint256(Long.fromNumber(params.targetTimestamp, true))
        .addUint256(bigintToLong(params.priceMinInt))
        .addUint256(bigintToLong(params.priceMaxInt))
    );

  const txResponse = await transaction.execute(client);
  const receipt = await txResponse.getReceipt(client);

  const txId = txResponse.transactionId?.toString() ?? "";
  const status =
    receipt.status != null
      ? (receipt.status as unknown as { _code?: number })._code
      : undefined;

  return { txId, status, receipt };
}
