import {
  Client,
  AccountId,
  PrivateKey,
  ContractId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractCallQuery,
  Long,
  TransactionReceipt,
  TransactionResponse,
} from '@hashgraph/sdk';
import { getEnv } from '../config/env.js';
import { logger } from '../logger.js';

export function createHederaClient(): Client {
  const env = getEnv();
  const client =
    env.NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const accountId = AccountId.fromString(env.ADMIN_ACCOUNT_ID);
  const keyStr = env.ADMIN_PRIVATE_KEY;
  const privateKey = keyStr.startsWith('30')
    ? PrivateKey.fromStringDer(keyStr)
    : PrivateKey.fromString(keyStr);
  client.setOperator(accountId, privateKey);
  return client;
}

function bigintToLong(value: bigint): Long {
  return Long.fromString(value.toString(), true);
}

function toLongArray(values: bigint[]): Long[] {
  return values.map((v) => bigintToLong(v));
}

/**
 * Call setPricesForTimestamps(timestamps, prices) on TorchPredictionMarket.
 * Prices must be 8-decimal (contract format).
 */
export async function setPricesForTimestamps(
  client: Client,
  timestamps: number[],
  prices8dp: bigint[]
): Promise<{ txId: string; receipt: TransactionReceipt }> {
  const env = getEnv();
  const contractId = ContractId.fromString(env.TORCH_CONTRACT_ID);

  const tsLongs = timestamps.map((t) => Long.fromNumber(t, true));
  const tx = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(5_000_000)
    .setFunction(
      'setPricesForTimestamps',
      new ContractFunctionParameters()
        .addUint256Array(tsLongs)
        .addUint256Array(toLongArray(prices8dp))
    );

  const response = (await tx.execute(client)) as TransactionResponse;
  const receipt = await response.getReceipt(client);
  const txId = response.transactionId?.toString() ?? '';
  logger.info({ txId, count: timestamps.length }, 'setPricesForTimestamps sent');
  return { txId, receipt };
}

/**
 * Call processBatch(bucket) on TorchPredictionMarket.
 */
export async function processBatch(
  client: Client,
  bucketIndex: number
): Promise<{ txId: string; receipt: TransactionReceipt }> {
  const env = getEnv();
  const contractId = ContractId.fromString(env.TORCH_CONTRACT_ID);

  const tx = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(10_000_000)
    .setFunction(
      'processBatch',
      new ContractFunctionParameters().addUint256(
        Long.fromNumber(bucketIndex, true)
      )
    );

  const response = (await tx.execute(client)) as TransactionResponse;
  const receipt = await response.getReceipt(client);
  const txId = response.transactionId?.toString() ?? '';
  logger.info({ txId, bucket: bucketIndex }, 'processBatch sent');
  return { txId, receipt };
}

export interface BucketInfo {
  totalBets: number;
  totalWinningWeight: bigint;
  nextProcessIndex: number;
  aggregationComplete: boolean;
}

/**
 * Read getBucketInfo(bucket) from contract (view).
 */
export async function getBucketInfo(
  client: Client,
  bucketIndex: number
): Promise<BucketInfo | null> {
  const env = getEnv();
  const contractId = ContractId.fromString(env.TORCH_CONTRACT_ID);

  try {
    const query = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100_000)
      .setFunction(
        'getBucketInfo',
        new ContractFunctionParameters().addUint256(
          Long.fromNumber(bucketIndex, true)
        )
      );

    const result = await query.execute(client);
    if (!result) return null;

    const totalBets = Number(result.getUint256(0).toString());
    const totalWinningWeight = BigInt(result.getUint256(1).toString());
    const nextProcessIndex = Number(result.getUint256(2).toString());
    const aggregationComplete = result.getBool(3);

    return {
      totalBets,
      totalWinningWeight,
      nextProcessIndex,
      aggregationComplete,
    };
  } catch (e) {
    logger.warn({ err: e, bucket: bucketIndex }, 'getBucketInfo failed');
    return null;
  }
}
