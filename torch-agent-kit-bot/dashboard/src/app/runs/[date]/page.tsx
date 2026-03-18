"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { Copy, FileText, Check } from "lucide-react";
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

function useCopyFeedback() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  return { copy, copiedId };
}

export default function RunDetailPage() {
  const params = useParams();
  const date = params.date as string;
  const [artifact, setArtifact] = useState<RunArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("forecasts");
  const { copy, copiedId } = useCopyFeedback();

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
        <div className="h-8 w-48 rounded bg-white/[0.06] animate-pulse" />
        <div className="mt-6 h-64 rounded-xl border border-white/[0.08] bg-white/[0.06] animate-pulse" />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className={dashboardStyles.pageNarrow}>
        <p className="text-muted-foreground">Run not found or invalid date.</p>
        <Link href="/runs" className="mt-4 inline-block text-primary hover:underline text-sm font-medium">
          Back to runs
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

  const cardClass = "rounded-xl border border-white/[0.08] bg-background overflow-hidden";

  return (
    <div className={dashboardStyles.pageNarrow}>
      <div className="mb-6">
        <Link
          href="/runs"
          className="text-sm text-muted-foreground hover:text-primary mb-2 inline-block font-medium"
        >
          Back to runs
        </Link>
        <h1 className={dashboardStyles.pageTitle}>Run — {date}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {artifact.runId} · {format(new Date(artifact.timestampUtc), "PPpp")} UTC
        </p>
      </div>

      {/* Pill tabs */}
      <div className="flex gap-1 rounded-lg bg-[hsl(0_0%_7%)] p-0.5 border border-white/[0.06] mb-6">
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
            <div key={f.betKey} className={cardClass}>
              <div className="p-4 sm:p-5">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <span className="font-mono text-sm font-medium text-primary">{f.betKey}</span>
                    <span className="text-muted-foreground text-sm ml-2">{f.monthDay}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => copy(f.prompt, `prompt-${f.betKey}`)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-colors"
                      title="Copy prompt"
                      aria-label="Copy prompt"
                    >
                      {copiedId === `prompt-${f.betKey}` ? (
                        <Check className="size-4 text-primary" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(f.raw, `raw-${f.betKey}`)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-colors"
                      title="Copy raw"
                      aria-label="Copy raw"
                    >
                      {copiedId === `raw-${f.betKey}` ? (
                        <Check className="size-4 text-primary" />
                      ) : (
                        <FileText className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prompt</p>
                    <p className="text-sm text-foreground mt-1 line-clamp-3">{f.prompt}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model output</p>
                    <p className="text-sm font-mono text-foreground mt-1 bg-[hsl(0_0%_7%)] p-3 rounded-lg border border-white/[0.08] break-words">
                      {f.raw}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 pt-2 border-t border-white/[0.08]">
                    <span className="text-sm"><span className="text-muted-foreground">Min:</span> <span className="font-medium text-foreground">{f.minStr}</span></span>
                    <span className="text-sm"><span className="text-muted-foreground">Max:</span> <span className="font-medium text-foreground">{f.maxStr}</span></span>
                  </div>
                </div>
                <div className="mt-4 h-1.5 bg-white/[0.06] rounded-full overflow-hidden flex">
                  <div className="bg-primary/40 rounded-l-full" style={{ width: "30%" }} />
                  <div className="bg-primary rounded-none" style={{ width: "40%" }} />
                  <div className="bg-primary/40 rounded-r-full" style={{ width: "30%" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "bets" && (
        <div className="space-y-4">
          {artifact.betParams.map((b) => (
            <div key={b.betKey} className={cardClass}>
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-mono text-sm font-semibold text-primary">{b.betKey}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-white/[0.08] bg-[hsl(0_0%_7%)] p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Price range (display)</p>
                    <p className="text-sm font-medium text-foreground mt-1">{b.priceMinStr} – {b.priceMaxStr}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-[hsl(0_0%_7%)] p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Price range (int)</p>
                    <p className="text-sm font-mono text-foreground mt-1">{b.priceMinInt} – {b.priceMaxInt}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-primary/10 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stake</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{b.stakeHbar} HBAR</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "transactions" && (
        <div className="space-y-4">
          {artifact.results
            .filter((r) => r.txId || r.skippedDuplicate)
            .map((r, i) => (
              <div key={r.betKey + String(i)} className={cardClass}>
                <div className="p-4 sm:p-5">
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <span className="font-mono text-sm font-medium text-foreground">{r.betKey}</span>
                    <div className="flex flex-wrap gap-2">
                      {r.skippedDuplicate && (
                        <span className={dashboardStyles.badge + " " + dashboardStyles.badgeWarning}>
                          Skipped
                        </span>
                      )}
                      {r.txId && (
                        <span className={dashboardStyles.badge + " " + dashboardStyles.badgeSuccess}>
                          {r.status === 22 ? "Success" : `Status ${r.status}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {r.txId && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono text-muted-foreground truncate max-w-full sm:max-w-md bg-[hsl(0_0%_7%)] px-2 py-1.5 rounded border border-white/[0.08]">
                        {r.txId}
                      </code>
                      <button
                        type="button"
                        onClick={() => copy(r.txId!, `tx-${r.betKey}-${i}`)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        {copiedId === `tx-${r.betKey}-${i}` ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        {copiedId === `tx-${r.betKey}-${i}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                </div>
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
                <div key={r.betKey + String(i)} className={cardClass}>
                  <div className="p-4 sm:p-5">
                    <p className="font-mono text-sm font-medium text-foreground">{r.betKey}</p>
                    {r.skippedDuplicate && (
                      <p className="text-amber-500 text-sm mt-2">Skipped (duplicate)</p>
                    )}
                    {r.error && (
                      <p className="text-red-400 text-sm mt-2 font-mono break-words">{r.error}</p>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
