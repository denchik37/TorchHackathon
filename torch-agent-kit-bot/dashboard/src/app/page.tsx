"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
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

export default function OverviewPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className={dashboardStyles.page}>
        <div className="h-8 w-48 rounded bg-card animate-pulse" />
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${dashboardStyles.kpiCard} h-24 animate-pulse`} />
          ))}
        </div>
      </div>
    );
  }

  const lastRun = health?.lastRun;
  const successRateData =
    runs.length > 0
      ? runs.slice(0, 7).reverse().map((r) => ({
          date: r.date.slice(5),
          rate: r.resultCount > 0 ? Math.round((r.successCount / r.resultCount) * 100) : 0,
        }))
      : [];
  const stakeData =
    runs.length > 0
      ? runs.slice(0, 7).reverse().map((r) => ({
          date: r.date.slice(5),
          count: r.successCount + r.dryRunCount,
        }))
      : [];

  const chartGrid = "hsl(var(--border))";
  const chartText = "hsl(var(--muted-foreground))";
  const chartPrimary = "hsl(var(--primary))";
  const tooltipBg = "hsl(var(--card))";
  const tooltipBorder = "hsl(var(--border))";

  return (
    <div className={dashboardStyles.page}>
      <header className={dashboardStyles.pageHeader}>
        <h1 className={dashboardStyles.pageTitle}>Overview</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className={dashboardStyles.badge + " " + dashboardStyles.badgeMuted}>
            runs/
          </span>
          {lastRun && (
            <span className={dashboardStyles.badge + " " + dashboardStyles.badgePrimary}>
              Last: {format(new Date(lastRun.timestampUtc), "MMM d, HH:mm")} UTC
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className={dashboardStyles.kpiCard}>
          <p className={dashboardStyles.kpiLabel}>Last run</p>
          <p className={dashboardStyles.kpiValue}>
            {lastRun
              ? format(new Date(lastRun.timestampUtc), "MMM d, yyyy HH:mm") + " UTC"
              : "—"}
          </p>
          <p className={dashboardStyles.kpiSub}>
            {lastRun ? `${lastRun.successCount} ok, ${lastRun.failedCount} failed` : "No runs yet"}
          </p>
        </div>
        <div className={dashboardStyles.kpiCard}>
          <p className={dashboardStyles.kpiLabel}>Bets attempted / succeeded</p>
          <p className={dashboardStyles.kpiValue}>
            {lastRun
              ? `${lastRun.successCount + lastRun.dryRunCount + lastRun.skippedCount} / ${lastRun.successCount}`
              : "—"}
          </p>
        </div>
        <div className={dashboardStyles.kpiCard}>
          <p className={dashboardStyles.kpiLabel}>DRY_RUN</p>
          <p className="mt-1 text-lg font-semibold text-primary">
            {lastRun?.dryRunCount ? `${lastRun.dryRunCount} dry-run` : "—"}
          </p>
        </div>
        <div className={dashboardStyles.kpiCard}>
          <p className={dashboardStyles.kpiLabel}>Next target (12:00 UTC)</p>
          <p className={dashboardStyles.kpiValue}>
            {health?.nextTargetDate
              ? format(new Date(health.nextTargetDate), "MMM d, yyyy HH:mm") + " UTC"
              : "—"}
          </p>
        </div>
      </div>

      {account && (
        <div className={`${dashboardStyles.card} ${dashboardStyles.cardPadding} mb-8`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className={dashboardStyles.kpiLabel}>Bot account (on-chain)</h2>
              <p className="mt-1 font-mono text-sm text-foreground">{account.accountId}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {Number(account.balance?.hbar ?? 0).toFixed(4)} HBAR
                <span className="text-muted-foreground font-normal text-sm ml-2">{account.network}</span>
              </p>
            </div>
            <Link
              href="/account"
              className="text-sm font-medium text-primary hover:underline"
            >
              View account →
            </Link>
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <div className={dashboardStyles.emptyState}>
          No runs yet — run the bot first (e.g.{" "}
          <code className="bg-card px-2 py-1 rounded border border-border font-mono text-xs">DRY_RUN=true npm run daily</code>).
        </div>
      ) : (
        <>
          <div className={`${dashboardStyles.card} ${dashboardStyles.cardPadding} mb-6`}>
            <h2 className={dashboardStyles.kpiLabel + " mb-4"}>7-day success rate trend</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={successRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                  <XAxis dataKey="date" stroke={chartText} fontSize={12} />
                  <YAxis stroke={chartText} fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}` }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke={chartPrimary}
                    strokeWidth={2}
                    name="Success %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={`${dashboardStyles.card} ${dashboardStyles.cardPadding}`}>
            <h2 className={dashboardStyles.kpiLabel + " mb-4"}>Stake volume per day (count)</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stakeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                  <XAxis dataKey="date" stroke={chartText} fontSize={12} />
                  <YAxis stroke={chartText} fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}` }}
                  />
                  <Bar dataKey="count" fill={chartPrimary} name="Bets" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
