"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  ReceiptText,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { dashboardStyles } from "@/components/layout/DashboardStyles";
import { cn } from "@/lib/utils";

const API_PATH = "/api/account";
const REFRESH_INTERVAL_MS = 30_000;
const TRANSACTIONS_PAGE_SIZE = 10;

type AccountApiTransaction = {
  consensusTimestamp: string | null;
  transactionId: string | null;
  name: string;
  result: string;
  entityId: string | null;
  feeTinybar: string | null;
  scheduled: boolean;
  hashscanUrl: string | null;
};

type AccountApiResponse = {
  accountId: string;
  network: "mainnet" | "testnet" | "previewnet" | string;
  mirrorBase: string;
  account: string;
  evmAddress: string | null;
  balance: {
    tinybar: string;
    hbar: number;
  };
  transactions: AccountApiTransaction[];
  error?: string;
};

function hederaTimestampToDate(timestamp?: string | null): Date | null {
  if (!timestamp) return null;
  const [secondsStr, nanosStr = "0"] = timestamp.split(".");
  const seconds = Number(secondsStr);
  const nanos = Number(nanosStr.padEnd(9, "0").slice(0, 9));
  if (!Number.isFinite(seconds) || !Number.isFinite(nanos)) return null;
  const milliseconds = seconds * 1000 + Math.floor(nanos / 1e6);
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimestamp(timestamp?: string | null): string {
  const date = hederaTimestampToDate(timestamp);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatHbar(value?: number): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(amount);
}

function formatFee(value?: string | null): string {
  const tinybar = Number(value ?? 0);
  if (!Number.isFinite(tinybar)) return "—";
  const hbar = tinybar / 1e8;
  return `${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(hbar)} HBAR`;
}

function truncateMiddle(value?: string | null, start = 8, end = 6): string {
  if (!value) return "—";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function getResultBadgeClass(result?: string): string {
  const normalized = (result ?? "").toUpperCase();
  if (normalized === "SUCCESS") return dashboardStyles.badgeSuccess;
  if (normalized.includes("FAIL") || normalized.includes("ERROR")) {
    return "bg-red-500/10 text-red-400";
  }
  return dashboardStyles.badgeMuted;
}

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className={cn("rounded-xl bg-transparent px-3 py-2 sm:px-4 sm:py-2.5", "flex items-center gap-3")}>
      <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className={dashboardStyles.kpiLabel}>{label}</div>
        <div className={dashboardStyles.kpiValue + " break-words"}>{value}</div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const [data, setData] = useState<AccountApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txPage, setTxPage] = useState(0);

  const loadData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const response = await fetch(API_PATH, { cache: "no-store" });
      const payload = (await response.json()) as AccountApiResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load account data");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false);
    const intervalId = window.setInterval(() => void loadData(true), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadData]);

  const transactionCount = useMemo(
    () => data?.transactions.length ?? 0,
    [data?.transactions.length]
  );

  const totalTxPages = Math.max(
    1,
    Math.ceil(transactionCount / TRANSACTIONS_PAGE_SIZE)
  );

  const paginatedTransactions = useMemo(() => {
    if (!data?.transactions.length) return [];
    const start = txPage * TRANSACTIONS_PAGE_SIZE;
    return data.transactions.slice(start, start + TRANSACTIONS_PAGE_SIZE);
  }, [data?.transactions, txPage]);

  useEffect(() => {
    if (!data) return;
    const maxPage = Math.max(
      0,
      Math.ceil(data.transactions.length / TRANSACTIONS_PAGE_SIZE) - 1
    );
    if (txPage > maxPage) setTxPage(maxPage);
  }, [data, txPage]);

  return (
    <div className={dashboardStyles.page}>
      <header className={cn(dashboardStyles.pageHeader, "pb-4 mb-3")}>
        <div>
          <h1 className={dashboardStyles.pageTitle}>Torch Bot</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-primary text-white hover:bg-primary/85 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : undefined}
            />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex gap-3 items-start p-4 rounded-xl border border-red-500/20 bg-red-500/10 mb-6">
          <AlertTriangle className="size-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-foreground">Unable to load account data</div>
            <div className="text-sm text-muted-foreground mt-1">{error}</div>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className={cn("dashboard-future-surface no-hover-transform", "min-h-[180px] flex items-center justify-center rounded-xl")}>
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <StatCard
              icon={<Wallet className="size-5" />}
              label="Balance"
              value={`${formatHbar(data.balance.hbar)} HBAR`}
            />
            <StatCard
              icon={<ReceiptText className="size-5" />}
              label="Transactions"
              value={String(transactionCount)}
            />
          </div>

          <div className="no-hover-transform rounded-xl border border-white/[0.1] bg-background/40 overflow-hidden shadow-[0_8px_30px_hsl(0_0%_0%_/_0.2)]">
            <div className="px-4 py-2.5 border-b border-white/[0.08]">
              <h2 className="text-sm font-semibold text-foreground">Transactions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs border-collapse">
                <thead>
                  <tr className={dashboardStyles.tableHead}>
                    <th className={dashboardStyles.tableTh + " border-b border-white/[0.06]"}>Type</th>
                    <th className={dashboardStyles.tableTh + " border-b border-white/[0.06]"}>Status</th>
                    <th className={dashboardStyles.tableTh + " border-b border-white/[0.06]"}>Time</th>
                    <th className={dashboardStyles.tableTh + " border-b border-white/[0.06]"}>Fee</th>
                    <th className={dashboardStyles.tableTh + " border-b border-white/[0.06]"}>Transaction ID</th>
                    <th className={dashboardStyles.tableTh + " border-b border-white/[0.06]"}>Entity</th>
                    <th className={dashboardStyles.tableTh + " border-b border-white/[0.06]"}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-muted-foreground border-b border-white/[0.06]"
                      >
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((tx) => (
                      <tr
                        key={`${tx.consensusTimestamp ?? "tx"}-${tx.transactionId ?? tx.name}`}
                        className={cn(
                          dashboardStyles.tableRowHover,
                          "border-b border-white/[0.06] last:border-b-0"
                        )}
                      >
                        <td className={dashboardStyles.tableTd}>
                          <div className="font-medium text-foreground">{tx.name}</div>
                          {tx.scheduled ? (
                            <div className="text-xs text-muted-foreground mt-0.5">Scheduled</div>
                          ) : null}
                        </td>
                        <td className={dashboardStyles.tableTd}>
                          <span
                            className={cn(
                              dashboardStyles.badge,
                              getResultBadgeClass(tx.result)
                            )}
                          >
                            {tx.result}
                          </span>
                        </td>
                        <td className={dashboardStyles.tableTd}>
                          <div className="inline-flex items-center gap-2 text-muted-foreground">
                            <Clock className="size-3.5" />
                            <span>{formatTimestamp(tx.consensusTimestamp)}</span>
                          </div>
                        </td>
                        <td className={dashboardStyles.tableTd}>{formatFee(tx.feeTinybar)}</td>
                        <td className={dashboardStyles.tableTd + " font-mono text-xs"}>
                          {truncateMiddle(tx.transactionId, 10, 10)}
                        </td>
                        <td className={dashboardStyles.tableTd + " font-mono text-xs"}>
                          {truncateMiddle(tx.entityId, 8, 6)}
                        </td>
                        <td className={dashboardStyles.tableTd}>
                          {tx.hashscanUrl ? (
                            <a
                              href={tx.hashscanUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-white/[0.1] text-foreground hover:border-white/[0.14] hover:bg-white/[0.04] transition-colors"
                            >
                              <span>View</span>
                              <ArrowUpRight className="size-3.5" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {data.transactions.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] px-4 py-2.5 text-xs text-muted-foreground">
                <span>
                  Showing{" "}
                  <span className="font-mono text-foreground">
                    {txPage * TRANSACTIONS_PAGE_SIZE + 1}
                  </span>
                  –
                  <span className="font-mono text-foreground">
                    {Math.min(
                      (txPage + 1) * TRANSACTIONS_PAGE_SIZE,
                      transactionCount
                    )}
                  </span>{" "}
                  of <span className="font-mono text-foreground">{transactionCount}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={txPage <= 0}
                    onClick={() => setTxPage((p) => Math.max(0, p - 1))}
                    className="rounded-md border border-white/[0.1] px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-white/[0.05] disabled:pointer-events-none disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="tabular-nums text-muted-foreground">
                    {txPage + 1} / {totalTxPages}
                  </span>
                  <button
                    type="button"
                    disabled={txPage >= totalTxPages - 1}
                    onClick={() =>
                      setTxPage((p) => Math.min(totalTxPages - 1, p + 1))
                    }
                    className="rounded-md border border-white/[0.1] px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-white/[0.05] disabled:pointer-events-none disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
