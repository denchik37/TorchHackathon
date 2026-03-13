import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 30;

const MIRROR_BASE = {
  mainnet: "https://mainnet.mirrornode.hedera.com",
  testnet: "https://testnet.mirrornode.hedera.com",
  previewnet: "https://previewnet.mirrornode.hedera.com",
} as const;

const HASHSCAN_NETWORK = {
  mainnet: "mainnet",
  testnet: "testnet",
  previewnet: "previewnet",
} as const;

type SupportedNetwork = keyof typeof MIRROR_BASE;

type MirrorAccountResponse = {
  account?: string;
  evm_address?: string | null;
  balance?: number | string | { balance?: number | string };
};

type MirrorTransaction = {
  consensus_timestamp?: string;
  transaction_id?: string;
  name?: string;
  result?: string;
  entity_id?: string | null;
  charged_tx_fee?: number | string | null;
  scheduled?: boolean | null;
};

type MirrorTransactionsResponse = {
  transactions?: MirrorTransaction[];
};

function normalizeNetwork(network?: string): SupportedNetwork {
  if (network === "mainnet" || network === "previewnet" || network === "testnet") {
    return network;
  }
  return "testnet";
}

function getHashscanTxUrl(
  consensusTimestamp: string | null | undefined,
  network: SupportedNetwork
): string | null {
  if (!consensusTimestamp) return null;
  return `https://hashscan.io/${HASHSCAN_NETWORK[network]}/transaction/${consensusTimestamp}`;
}

function getBalanceTinybar(account: MirrorAccountResponse): number {
  const raw =
    typeof account.balance === "object" && account.balance !== null
      ? account.balance.balance
      : account.balance;

  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTransaction(tx: MirrorTransaction, network: SupportedNetwork) {
  return {
    consensusTimestamp: tx.consensus_timestamp ?? null,
    transactionId: tx.transaction_id ?? null,
    name: tx.name ?? "UNKNOWN",
    result: tx.result ?? "UNKNOWN",
    entityId: tx.entity_id ?? null,
    feeTinybar:
      tx.charged_tx_fee !== null && tx.charged_tx_fee !== undefined
        ? String(tx.charged_tx_fee)
        : null,
    scheduled: Boolean(tx.scheduled),
    hashscanUrl: getHashscanTxUrl(tx.consensus_timestamp, network),
  };
}

export async function GET() {
  const accountId = process.env.BOT_ACCOUNT_ID?.trim();
  const network = normalizeNetwork(process.env.BOT_NETWORK);
  const base = MIRROR_BASE[network];

  if (!accountId) {
    return NextResponse.json(
      { error: "BOT_ACCOUNT_ID not configured" },
      { status: 503 }
    );
  }

  try {
    const encodedAccountId = encodeURIComponent(accountId);

    const [accountRes, txRes] = await Promise.all([
      fetch(`${base}/api/v1/accounts/${encodedAccountId}`, {
        next: { revalidate: 30 },
      }),
      fetch(
        `${base}/api/v1/transactions?account.id=${encodedAccountId}&limit=25&order=desc`,
        {
          next: { revalidate: 30 },
        }
      ),
    ]);

    if (!accountRes.ok) {
      const detail = await accountRes.text();
      return NextResponse.json(
        {
          error: "Failed to fetch Hedera account data",
          detail,
        },
        { status: accountRes.status }
      );
    }

    const account = (await accountRes.json()) as MirrorAccountResponse;
    const txPayload = txRes.ok
      ? ((await txRes.json()) as MirrorTransactionsResponse)
      : { transactions: [] };

    const balanceTinybar = getBalanceTinybar(account);
    const transactions = (txPayload.transactions ?? []).map((tx) =>
      normalizeTransaction(tx, network)
    );

    return NextResponse.json({
      accountId,
      network,
      mirrorBase: base,
      account: account.account ?? accountId,
      evmAddress: account.evm_address ?? null,
      balance: {
        tinybar: String(balanceTinybar),
        hbar: balanceTinybar / 1e8,
      },
      transactions,
    });
  } catch (error) {
    console.error("[api/account] Unexpected error:", error);

    return NextResponse.json(
      { error: "Failed to fetch account data" },
      { status: 500 }
    );
  }
}