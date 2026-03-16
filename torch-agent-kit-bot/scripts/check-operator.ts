/**
 * Operator sanity check script: verify PRIVATE_KEY matches on-chain key for ACCOUNT_ID.
 * Exit 0 = match and single key; 2 = mismatch; 3 = multisig (KeyList/ThresholdKey).
 *
 * Usage: npm run doctor   or   npx tsx scripts/check-operator.ts
 */

import "dotenv/config";
import { Client, AccountId } from "@hashgraph/sdk";
import { getEnv } from "../src/config/env.js";
import { parseEcdsaPrivateKey } from "../src/utils/keys.js";
import { checkOperator } from "../src/hedera/operatorCheck.js";

async function main(): Promise<void> {
  const env = getEnv();
  const privateKey = parseEcdsaPrivateKey(env.PRIVATE_KEY);
  const accountId = AccountId.fromString(env.ACCOUNT_ID);

  const client =
    env.NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(accountId, privateKey);

  const result = await checkOperator(client, accountId, privateKey);

  console.log("ACCOUNT_ID:", env.ACCOUNT_ID);
  console.log("Derived public key:", result.derivedPublicKey);
  console.log("On-chain key:", result.onChainKeyDesc);
  console.log("MATCH:", result.match);

  if (result.isMultisig) {
    console.error(
      "On-chain key is KeyList/ThresholdKey (multisig). Single ECDSA key expected."
    );
    process.exit(3);
  }
  if (!result.match) {
    process.exit(2);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
