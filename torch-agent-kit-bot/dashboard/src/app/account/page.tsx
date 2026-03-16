"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  ReceiptText,
  RefreshCw,
  Server,
  Wallet,
} from "lucide-react";
import { dashboardStyles } from "@/components/layout/DashboardStyles";
import { cn } from "@/lib/utils";

const API_PATH = "/api/account";
const REFRESH_INTERVAL_MS = 30_000;

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
    dateStyle: "medium",
    timeStyle: "medium",
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
  }).format(hbar)} ℏ`;
}

function truncateMiddle(value?: string | null, start = 8, end = 6): string {
  if (!value) return "—";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function getNetworkBadgeClass(network?: string): string {
  switch (network) {
    case "mainnet":
      return dashboardStyles.badgeSuccess;
    case "previewnet":
      return dashboardStyles.badgePrimary;
    default:
      return dashboardStyles.badgeWarning;
  }
}

function getResultBadgeClass(result?: string): string {
  const normalized = (result ?? "").toUpperCase();
  if (normalized === "SUCCESS") return dashboardStyles.badgeSuccess;
  if (normalized.includes("FAIL") || normalized.includes("ERROR")) {
    return "bg-magenta/15 text-magenta";
  }
  return dashboardStyles.badgeMuted;
}

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
};

function StatCard({ icon, label, value, subtext }: StatCardProps) {
  return (
    <div className={cn(dashboardStyles.card, dashboardStyles.cardPadding, "flex items-start gap-4")}>
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className={dashboardStyles.kpiLabel}>{label}</div>
        <div className={dashboardStyles.kpiValue + " break-words"}>{value}</div>
        {subtext ? (
          <div className="text-sm text-muted-foreground mt-1 break-words">{subtext}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function AccountPage() {
  const [data, setData] = useState<AccountApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className={dashboardStyles.page}>
      <header className={dashboardStyles.pageHeader}>
        <div>
          <h1 className={dashboardStyles.pageTitle}>Bot Account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hedera account state, balance, and latest transactions.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {data?.network ? (
            <span className={cn(dashboardStyles.badge, getNetworkBadgeClass(data.network))}>
              {data.network}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-border bg-card/60 backdrop-blur-sm text-foreground hover:bg-muted/40 hover:border-primary/30 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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
        <div className="flex gap-3 items-start p-4 rounded-xl border border-magenta/30 bg-magenta/10 mb-6">
          <AlertTriangle className="w-5 h-5 text-magenta flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-foreground">Unable to load account data</div>
            <div className="text-sm text-muted-foreground mt-1">{error}</div>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className={cn(dashboardStyles.card, "min-h-[180px] flex items-center justify-center")}>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard
              icon={<Wallet className="w-5 h-5" />}
              label="Balance"
              value={`${formatHbar(data.balance.hbar)} ℏ`}
              subtext={`${data.balance.tinybar} tinybar`}
            />
            <StatCard
              icon={<Server className="w-5 h-5" />}
              label="Account"
              value={truncateMiddle(data.account)}
              subtext={
                data.evmAddress
                  ? `EVM: ${truncateMiddle(data.evmAddress)}`
                  : "No EVM address"
              }
            />
            <StatCard
              icon={<ReceiptText className="w-5 h-5" />}
              label="Transactions"
              value={String(transactionCount)}
              subtext="Latest 25 mirror-node records"
            />
          </div>

          <div className={dashboardStyles.card}>
            <div className={dashboardStyles.cardPadding + " border-b border-border"}>
              <h2 className="text-base font-semibold text-foreground">Recent Transactions</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Explorer links open directly on HashScan.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className={dashboardStyles.tableHead}>
                    <th className={dashboardStyles.tableTh}>Type</th>
                    <th className={dashboardStyles.tableTh}>Status</th>
                    <th className={dashboardStyles.tableTh}>Time</th>
                    <th className={dashboardStyles.tableTh}>Fee</th>
                    <th className={dashboardStyles.tableTh}>Transaction ID</th>
                    <th className={dashboardStyles.tableTh}>Entity</th>
                    <th className={dashboardStyles.tableTh}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    data.transactions.map((tx) => (
                      <tr
                        key={`${tx.consensusTimestamp ?? "tx"}-${tx.transactionId ?? tx.name}`}
                        className={dashboardStyles.tableRowHover}
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
                            <Clock className="w-3.5 h-3.5" />
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
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border border-border bg-card/40 text-foreground hover:border-primary/30 hover:bg-primary/10 transition-colors"
                            >
                              <span>View</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
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
          </div>
        </>
      ) : null}
    </div>
  );
}
