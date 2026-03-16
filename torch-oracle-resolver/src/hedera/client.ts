import {
  Client,
  AccountId,
  PrivateKey,
  ContractId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractCallQuery,
  TransactionRecordQuery,
  Long,
  TransactionReceipt,
  TransactionResponse,
} from '@hashgraph/sdk';
import { getEnv } from '../config/env.js';
import { logger } from '../logger.js';

function parsePrivateKey(input: string): PrivateKey {
  const raw = input.trim();
  const withoutPrefix = raw.startsWith('0x') || raw.startsWith('0X') ? raw.slice(2) : raw;

  if (/^[0-9a-fA-F]{64}$/.test(withoutPrefix)) {
    // Raw 32-byte ECDSA private key
    return PrivateKey.fromStringECDSA(withoutPrefix);
  }

  if (withoutPrefix.startsWith('302e')) {
    // DER hex
    return PrivateKey.fromStringDer(withoutPrefix);
  }

  return PrivateKey.fromString(raw);
}

function parseContractId(input: string): ContractId {
  const raw = input.trim();
  if ((raw.startsWith('0x') || raw.startsWith('0X')) && raw.length === 42) {
    return ContractId.fromSolidityAddress(raw.slice(2));
  }
  return ContractId.fromString(raw);
}

export function createHederaClient(): Client {
  const env = getEnv();
  const client =
    env.NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

  const accountId = AccountId.fromString(env.ADMIN_ACCOUNT_ID);
  const keyStr = env.ADMIN_PRIVATE_KEY;
  const privateKey = parsePrivateKey(keyStr);

  client.setOperator(accountId, privateKey);

  logger.info(
    {
      adminAccountId: env.ADMIN_ACCOUNT_ID,
      network: env.NETWORK,
      contractId: env.TORCH_CONTRACT_ID,
      keyFormat: keyStr.trim().startsWith('0x') || keyStr.trim().startsWith('0X') ? 'hex' : 'other',
    },
    'Resolver Hedera client configured'
  );

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
  const contractId = parseContractId(env.TORCH_CONTRACT_ID);

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
export interface ProcessBatchResultOk {
  ok: true;
  txId: string;
  receipt: TransactionReceipt;
}

export interface ProcessBatchResultError {
  ok: false;
  txId: string;
  status?: string;
  errorMessage?: string;
}

export async function processBatch(
  client: Client,
  bucketIndex: number
): Promise<ProcessBatchResultOk | ProcessBatchResultError> {
  const env = getEnv();
  const contractId = parseContractId(env.TORCH_CONTRACT_ID);

  let txId = '';
  try {
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
    txId = response.transactionId?.toString() ?? '';
    const receipt = await response.getReceipt(client);
    logger.info({ txId, bucket: bucketIndex }, 'processBatch sent');
    return { ok: true, txId, receipt };
  } catch (err) {
    const e = err as any;
    let errorMessage: string | undefined;
    let statusStr: string | undefined;
    try {
      const txIdObj = e?.transactionId;
      if (txIdObj) {
        const record = await new TransactionRecordQuery()
          .setTransactionId(txIdObj)
          .execute(client);
        errorMessage = record.contractFunctionResult?.errorMessage ?? undefined;
        statusStr = record.receipt?.status?.toString?.();
        txId = txId || txIdObj.toString?.() || '';
      }
    } catch {
      // ignore record fetch errors
    }

    logger.error(
      { bucketIndex, txId, status: statusStr, errorMessage, err: e },
      'processBatch revert or error'
    );

    return {
      ok: false,
      txId,
      status: statusStr,
      errorMessage,
    };
  }
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
  const contractId = parseContractId(env.TORCH_CONTRACT_ID);

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
