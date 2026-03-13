/**
 * Hedera Client (Agent Kit style): operator ACCOUNT_ID + PRIVATE_KEY (DER or raw supported by SDK).
 */

import {
  Client,
  AccountId,
  PrivateKey,
} from "@hashgraph/sdk";
import { getEnv } from "../config/env.js";

export function createHederaClient(): Client {
  const env = getEnv();
  const client =
    env.NETWORK === "mainnet"
      ? Client.forMainnet()
      : Client.forTestnet();

  const accountId = AccountId.fromString(env.ACCOUNT_ID);
  const privateKey = PrivateKey.fromString(env.PRIVATE_KEY);
  client.setOperator(accountId, privateKey);
  return client;
}
