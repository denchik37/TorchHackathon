"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Copy, Check, ExternalLink, Coins } from "lucide-react";
import { dashboardStyles } from "@/components/layout/DashboardStyles";

interface Health {
  lastRun: {
    date: string;
    timestampUtc: string;
    successCount: number;
    dryRunCount: number;
    failedCount: number;
    skippedCount: number;
  } | null;
  nextTargetTimestamp: number;
  nextTargetDate: string;
}

interface RunSummary {
  date: string;
  runId: string;
  timestampUtc: string;
  successCount: number;
  dryRunCount: number;
  skippedCount: number;
  failedCount: number;
  resultCount: number;
}

interface AccountSummary {
  accountId: string;
  network: string;
  balance: { hbar: number };
}

/** Option A API returns { nowUtc, lastBettingRun, lastResolverRun }; legacy returns { lastRun, nextTargetTimestamp, nextTargetDate }. */
function normalizeHealth(raw: unknown): Health | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.lastRun != null && o.nextTargetDate != null) {
    return raw as Health;
  }
  const lastBetting = o.lastBettingRun as Record<string, unknown> | null | undefined;
  if (lastBetting && typeof lastBetting === "object") {
    const nextTarget = (() => {
      const now = new Date();
      const leadMs = 24 * 60 * 60 * 1000;
      const anchor = new Date(now.getTime() + leadMs);
      const y = anchor.getUTCFullYear();
      const m = anchor.getUTCMonth();
      const d = anchor.getUTCDate();
      return Math.floor(new Date(Date.UTC(y, m, d, 12, 0, 0, 0)).getTime() / 1000);
    })();
    return {
      lastRun: {
        date: String(lastBetting.date ?? ""),
        timestampUtc: String(lastBetting.timestampUtc ?? ""),
        successCount: Number(lastBetting.successCount ?? 0),
        dryRunCount: Number(lastBetting.dryRunCount ?? 0),
        failedCount: Number(lastBetting.failedCount ?? 0),
        skippedCount: Number(lastBetting.skippedCount ?? 0),
      },
      nextTargetTimestamp: nextTarget,
      nextTargetDate: new Date(nextTarget * 1000).toISOString(),
    };
  }
  return null;
}

function formatDateTimeUtc(isoOrTimestamp: string | number): string {
  try {
    const date = typeof isoOrTimestamp === "number"
      ? new Date(isoOrTimestamp * 1000)
      : new Date(isoOrTimestamp);
    if (!Number.isFinite(date.getTime())) return "—";
    return format(date, "dd MMM yyyy, HH:mm") + " UTC";
  } catch {
    return "—";
  }
}

const HASHSCAN_NETWORK: Record<string, string> = {
  mainnet: "mainnet",
  testnet: "testnet",
  previewnet: "previewnet",
};

export default function OverviewPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/health").then((r) => r.json()),
      fetch("/api/betting/runs").then((r) => r.json()).then((d) => (Array.isArray(d) ? d : [])),
      fetch("/api/account").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([h, r, a]) => {
        setHealth(normalizeHealth(h));
        setRuns(r);
        setAccount(a);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCopyAccount = async () => {
    if (account?.accountId) {
      await navigator.clipboard.writeText(account.accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hashscanUrl = account?.accountId && account?.network
    ? `https://hashscan.io/${HASHSCAN_NETWORK[account.network] ?? "testnet"}/account/${account.accountId}`
    : null;

  if (loading) {
    return (
      <div className={dashboardStyles.page}>
        <div className="h-8 w-48 rounded bg-card animate-pulse" />
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${dashboardStyles.kpiCard} h-24 animate-pulse rounded-xl border border-border`} />
          ))}
        </div>
      </div>
    );
  }

  const lastRun = health?.lastRun;
  const attempted = lastRun ? lastRun.successCount + lastRun.dryRunCount + lastRun.skippedCount : 0;
  const succeeded = lastRun?.successCount ?? 0;

  return (
    <div className={dashboardStyles.page}>
      <header className={dashboardStyles.pageHeader}>
        <h1 className={dashboardStyles.pageTitle}>Overview</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <p className={dashboardStyles.kpiLabel}>Last run</p>
          <p className={dashboardStyles.kpiValue}>
            {lastRun ? formatDateTimeUtc(lastRun.timestampUtc) : "—"}
          </p>
          <p className={dashboardStyles.kpiSub}>
            {lastRun ? `${lastRun.successCount} ok, ${lastRun.failedCount} failed` : "No runs yet"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <p className={dashboardStyles.kpiLabel}>Bets attempted / succeeded</p>
          <p className={dashboardStyles.kpiValue}>
            {lastRun ? `${attempted} / ${succeeded}` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <p className={dashboardStyles.kpiLabel}>Next target (12:00 UTC)</p>
          <p className={dashboardStyles.kpiValue}>
            {health?.nextTargetDate
              ? formatDateTimeUtc(health.nextTargetDate)
              : "—"}
          </p>
        </div>
      </div>

      {account && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 mb-8">
          <h2 className={dashboardStyles.kpiLabel}>Torch Bot</h2>
          <div className="mt-3 flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-xl font-semibold text-foreground tabular-nums">
              {Number(account.balance?.hbar ?? 0).toLocaleString("en-GB", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 8,
              })}{" "}
              HBAR
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-foreground">{account.accountId}</span>
            <button
              type="button"
              onClick={handleCopyAccount}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
              aria-label={copied ? "Copied" : "Copy address"}
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </button>
            {hashscanUrl && (
              <a
                href={hashscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                aria-label="View on HashScan"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <div className={dashboardStyles.emptyState}>
          No runs yet — run the bot first (e.g.{" "}
          <code className="bg-card px-2 py-1 rounded border border-border font-mono text-xs">npm run daily</code>).
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className={dashboardStyles.kpiLabel + " mb-4"}>Recent runs</h2>
          <p className="text-sm text-muted-foreground">
            View full history in the <Link href="/runs" className="text-primary hover:underline">Runs</Link> tab.
          </p>
        </div>
      )}
    </div>
  );
}
