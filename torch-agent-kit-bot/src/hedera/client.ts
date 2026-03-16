/**
 * Hedera Client (Agent Kit style): operator ACCOUNT_ID + PRIVATE_KEY (ECDSA only, raw or DER).
 */

import { Client, AccountId } from "@hashgraph/sdk";
import { getEnv } from "../config/env.js";
import { parseEcdsaPrivateKey, detectKeyFormat } from "../utils/keys.js";
import { checkOperator } from "./operatorCheck.js";

export interface CreateClientOptions {
  log?: { info: (obj: object, msg?: string) => void };
}

/**
 * Creates a Hedera client with operator set from env (ACCOUNT_ID, PRIVATE_KEY).
 * Parses PRIVATE_KEY as ECDSA only (raw 64-char hex or DER 302e...).
 * Runs operator sanity check; throws if key does not match on-chain account key.
 */
export async function createHederaClient(
  options?: CreateClientOptions
): Promise<Client> {
  const env = getEnv();
  const privateKey = parseEcdsaPrivateKey(env.PRIVATE_KEY);
  const keyFormat = detectKeyFormat(env.PRIVATE_KEY);

  const client =
    env.NETWORK === "mainnet"
      ? Client.forMainnet()
      : Client.forTestnet();

  const accountId = AccountId.fromString(env.ACCOUNT_ID);
  client.setOperator(accountId, privateKey);

  if (options?.log) {
    options.log.info(
      { accountId: env.ACCOUNT_ID, network: env.NETWORK, keyFormat },
      "Hedera client operator"
    );
  }

  const result = await checkOperator(client, accountId, privateKey);
  if (result.isMultisig) {
    throw new Error(
      "Operator account uses KeyList/ThresholdKey (multisig). Single ECDSA key expected. Fix /etc/torch/torch-agent-kit-bot.env"
    );
  }
  if (!result.match) {
    throw new Error(
      "Operator key does not match ACCOUNT_ID. Fix /etc/torch/torch-agent-kit-bot.env"
    );
  }

  return client;
}
