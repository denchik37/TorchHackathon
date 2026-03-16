/**
 * Operator sanity check: compare derived public key with on-chain account key.
 */

import {
  Client,
  AccountId,
  PrivateKey,
  PublicKey,
  AccountInfoQuery,
  KeyList,
} from "@hashgraph/sdk";

export interface OperatorCheckResult {
  match: boolean;
  isMultisig: boolean;
  derivedPublicKey: string;
  onChainKeyDesc: string;
}

/**
 * Queries AccountInfo for the given account and compares the account's key
 * with the public key derived from the given private key.
 * Requires a client that can execute the query (operator may be set to this account).
 */
export async function checkOperator(
  client: Client,
  accountId: AccountId,
  privateKey: PrivateKey
): Promise<OperatorCheckResult> {
  const info = await new AccountInfoQuery().setAccountId(accountId).execute(client);
  const onChainKey = info.key;
  const derived = privateKey.publicKey;

  const derivedPublicKey = derived.toStringDer();
  const onChainKeyDesc =
    typeof (onChainKey as { toString?: () => string }).toString === "function"
      ? (onChainKey as { toString: () => string }).toString()
      : String(onChainKey);

  if (onChainKey instanceof KeyList) {
    return {
      match: false,
      isMultisig: true,
      derivedPublicKey,
      onChainKeyDesc: "KeyList/ThresholdKey (multisig)",
    };
  }

  if (onChainKey instanceof PublicKey) {
    const match = derived.equals(onChainKey);
    return {
      match,
      isMultisig: false,
      derivedPublicKey,
      onChainKeyDesc,
    };
  }

  return {
    match: false,
    isMultisig: false,
    derivedPublicKey,
    onChainKeyDesc,
  };
}
