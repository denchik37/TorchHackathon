/**
 * Ethers-based client for Torch prediction market on Hedera.
 * Uses Hedera JSON-RPC; signs with ECDSA secp256k1 (Wallet). placeBet(targetTimestamp, priceMin, priceMax) payable; value is sent in weibar (18 decimals), and the stake conversion is handled in betPolicy.
 * Transactions are sent sequentially for nonce safety.
 */

import { Contract, Wallet, JsonRpcProvider } from "ethers";
import type { TorchBetParams } from "../types.js";
import torchAbi from "./abi/torch.json" with { type: "json" };

export interface TorchClientConfig {
  rpcUrl: string;
  chainId: number;
  contractAddress: string;
  privateKey: string;
  /** Contract function name (default placeBet). Used when ABI is placeholder. */
  functionName?: string;
}

export interface PlaceBetResult {
  txHash: string;
  receipt?: { status: number };
}

export class TorchClient {
  private contract: Contract;
  private wallet: Wallet;
  private functionName: string;

  constructor(config: TorchClientConfig) {
    const network = { chainId: config.chainId, name: "hedera" };
    const provider = new JsonRpcProvider(config.rpcUrl, network);
    this.wallet = new Wallet(config.privateKey, provider);
    const abi = (torchAbi as { abi: unknown }).abi;
    this.contract = new Contract(
      config.contractAddress,
      abi as import("ethers").InterfaceAbi,
      this.wallet
    );
    this.functionName = config.functionName ?? "placeBet";
  }

  async placeBet(params: TorchBetParams): Promise<PlaceBetResult> {
    const fn = this.contract.getFunction(this.functionName);
    const tx = await fn(params.targetTimestamp, params.priceLowInt, params.priceHighInt, {
      value: params.stakeValue,
    });
    const receipt = await tx.wait();
    return {
      txHash: tx.hash,
      receipt: receipt ? { status: receipt.status } : undefined,
    };
  }
}
