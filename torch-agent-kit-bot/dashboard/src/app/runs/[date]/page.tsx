"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { dashboardStyles } from "@/components/layout/DashboardStyles";

interface RunArtifact {
  runId: string;
  timestampUtc: string;
  provider: { model: string; reasoning_effort: string; max_completion_tokens: number };
  forecasts: Array<{
    betKey: string;
    targetTimestamp: number;
    monthDay: string;
    prompt: string;
    raw: string;
    minStr: string;
    maxStr: string;
  }>;
  betParams: Array<{
    betKey: string;
    priceMinStr: string;
    priceMaxStr: string;
    priceMinInt: string;
    priceMaxInt: string;
    stakeHbar: string;
  }>;
  results: Array<{
    betKey: string;
    targetTimestamp: number;
    dryRun?: boolean;
    skippedDuplicate?: boolean;
    txId?: string;
    status?: number;
    error?: string;
    prompt?: string;
    raw?: string;
    minStr?: string;
    maxStr?: string;
  }>;
}

type Tab = "forecasts" | "bets" | "transactions" | "logs";

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export default function RunDetailPage() {
  const params = useParams();
  const date = params.date as string;
  const [artifact, setArtifact] = useState<RunArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("forecasts");

  useEffect(() => {
    if (!date) return;
    fetch(`/api/betting/runs/${date}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setArtifact)
      .catch(() => setArtifact(null))
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) {
    return (
      <div className={dashboardStyles.pageNarrow}>
        <div className="h-8 w-48 rounded bg-card animate-pulse" />
        <div className="mt-6 h-64 rounded-xl glass-card animate-pulse" />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className={dashboardStyles.pageNarrow}>
        <p className="text-muted-foreground">Run not found or invalid date.</p>
        <Link href="/runs" className="mt-4 inline-block text-primary hover:underline text-sm font-medium">
          ← Back to runs
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "forecasts", label: "Forecasts" },
    { id: "bets", label: "Bets" },
    { id: "transactions", label: "Transactions" },
    { id: "logs", label: "Logs" },
  ];

  const tabPanelClass = `${dashboardStyles.card} ${dashboardStyles.cardPadding}`;

  return (
    <div className={dashboardStyles.pageNarrow}>
      <div className="mb-6">
        <Link
          href="/runs"
          className="text-sm text-muted-foreground hover:text-primary mb-2 inline-block font-medium"
        >
          ← Back to runs
        </Link>
        <h1 className={dashboardStyles.pageTitle}>Run — {date}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {artifact.runId} · {format(new Date(artifact.timestampUtc), "PPpp")} UTC
        </p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              dashboardStyles.tabButton,
              tab === t.id ? dashboardStyles.tabActive : dashboardStyles.tabInactive
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "forecasts" && (
        <div className="space-y-4">
          {artifact.forecasts.map((f) => (
            <div key={f.betKey} className={tabPanelClass}>
              <div className="flex justify-between items-start gap-2">
                <span className="font-mono text-primary text-sm">{f.betKey}</span>
                <span className="text-muted-foreground text-sm">{f.monthDay}</span>
              </div>
              <p className="text-muted-foreground text-sm mt-2 line-clamp-2">{f.prompt}</p>
              <p className="text-foreground font-mono text-sm mt-2 bg-background/80 p-2 rounded-lg border border-border">
                {f.raw}
              </p>
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                <span className="text-destructive">Min: {f.minStr}</span>
                <span className="text-torch-orange">Max: {f.maxStr}</span>
                <button
                  onClick={() => copyToClipboard(f.prompt)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Copy prompt
                </button>
                <button
                  onClick={() => copyToClipboard(f.raw)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Copy raw
                </button>
              </div>
              <div className="mt-3 h-2 bg-card rounded overflow-hidden flex border border-border">
                <div className="bg-primary/30" style={{ width: "30%" }} />
                <div className="bg-primary" style={{ width: "40%" }} />
                <div className="bg-primary/30" style={{ width: "30%" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "bets" && (
        <div className="space-y-4">
          {artifact.betParams.map((b) => (
            <div key={b.betKey} className={tabPanelClass}>
              <p className="font-mono text-primary text-sm">{b.betKey}</p>
              <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Min (str): </span>
                  <span className="text-foreground">{b.priceMinStr}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max (str): </span>
                  <span className="text-foreground">{b.priceMaxStr}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Min (int): </span>
                  <span className="font-mono text-foreground">{b.priceMinInt}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max (int): </span>
                  <span className="font-mono text-foreground">{b.priceMaxInt}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Stake: </span>
                  <span className="text-foreground">{b.stakeHbar} HBAR</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "transactions" && (
        <div className="space-y-4">
          {artifact.results
            .filter((r) => r.txId || r.dryRun || r.skippedDuplicate)
            .map((r, i) => (
              <div key={r.betKey + String(i)} className={tabPanelClass}>
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="font-mono text-sm text-foreground">{r.betKey}</span>
                  <span>
                    {r.dryRun && (
                      <span className={dashboardStyles.badge + " " + dashboardStyles.badgePrimary}>
                        Dry run
                      </span>
                    )}
                    {r.skippedDuplicate && (
                      <span className={dashboardStyles.badge + " " + dashboardStyles.badgeWarning + " ml-1"}>
                        Skipped
                      </span>
                    )}
                    {r.txId && (
                      <span className={dashboardStyles.badge + " " + dashboardStyles.badgeSuccess + " ml-1"}>
                        {r.status === 22 ? "Success" : `Status ${r.status}`}
                      </span>
                    )}
                  </span>
                </div>
                {r.txId && (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="text-xs text-muted-foreground font-mono truncate max-w-md">
                      {r.txId}
                    </code>
                    <button
                      onClick={() => copyToClipboard(r.txId!)}
                      className="text-muted-foreground hover:text-foreground text-xs font-medium"
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {tab === "logs" && (
        <div className="space-y-4">
          {artifact.results.filter((r) => r.error || r.skippedDuplicate).length === 0 ? (
            <p className="text-muted-foreground">No errors or skipped entries.</p>
          ) : (
            artifact.results
              .filter((r) => r.error || r.skippedDuplicate)
              .map((r, i) => (
                <div key={r.betKey + String(i)} className={tabPanelClass}>
                  <p className="font-mono text-sm text-foreground">{r.betKey}</p>
                  {r.skippedDuplicate && (
                    <p className="text-torch-orange text-sm mt-1">Skipped (duplicate)</p>
                  )}
                  {r.error && (
                    <p className="text-magenta text-sm mt-1">{r.error}</p>
                  )}
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
