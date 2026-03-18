"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { dashboardStyles } from "@/components/layout/DashboardStyles";
import { cn } from "@/lib/utils";

interface RunSummary {
  date: string;
  runId: string;
  timestampUtc: string;
  forecastCount: number;
  betParamCount: number;
  resultCount: number;
  successCount: number;
  dryRunCount: number;
  skippedCount: number;
  failedCount: number;
}

export default function RunsListPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");

  useEffect(() => {
    fetch("/api/betting/runs")
      .then((r) => r.json())
      .then((d) => setRuns(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = runs.filter((r) => {
    if (filter === "success") return r.successCount > 0;
    if (filter === "failed") return r.failedCount > 0;
    return true;
  });

  if (loading) {
    return (
      <div className={dashboardStyles.page}>
        <div className="h-8 w-32 rounded bg-white/[0.06] animate-pulse mb-6" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-xl border border-white/[0.08] bg-white/[0.06] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const filterButtons: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "success", label: "Success" },
    { key: "failed", label: "Failed" },
  ];

  return (
    <div className={dashboardStyles.page}>
      <header className={dashboardStyles.pageHeader}>
        <h1 className={dashboardStyles.pageTitle}>Runs</h1>
        <div className="flex gap-1 rounded-lg bg-[hsl(0_0%_7%)] p-0.5 border border-white/[0.06]">
          {filterButtons.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                dashboardStyles.tabButton,
                filter === key
                  ? dashboardStyles.tabActive
                  : dashboardStyles.tabInactive
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className={dashboardStyles.emptyState}>
          No runs yet — run the bot first.
        </div>
      ) : (
        <div className={dashboardStyles.tableWrap}>
          <table className="w-full text-left">
            <thead className={dashboardStyles.tableHead}>
              <tr>
                <th className={dashboardStyles.tableTh}>Date</th>
                <th className={dashboardStyles.tableTh}>Run ID</th>
                <th className={dashboardStyles.tableTh}>Time (UTC)</th>
                <th className={dashboardStyles.tableTh}>Forecasts</th>
                <th className={dashboardStyles.tableTh}>Tx / Failed</th>
                <th className={dashboardStyles.tableTh}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08]">
              {filtered.map((r) => (
                <tr key={r.date} className={dashboardStyles.tableRowHover}>
                  <td className={dashboardStyles.tableTd + " font-mono"}>{r.date}</td>
                  <td className={dashboardStyles.tableTd + " text-muted-foreground font-mono text-xs truncate max-w-[120px]"}>
                    {r.runId}
                  </td>
                  <td className={dashboardStyles.tableTd + " text-muted-foreground text-sm"}>
                    {format(new Date(r.timestampUtc), "HH:mm:ss")}
                  </td>
                  <td className={dashboardStyles.tableTd}>{r.forecastCount}</td>
                  <td className={dashboardStyles.tableTd}>
                    <span className="text-emerald-400">{r.successCount}</span>
                    {" / "}
                    <span className="text-red-400">{r.failedCount}</span>
                  </td>
                  <td className={dashboardStyles.tableTd}>
                    <Link
                      href={`/runs/${r.date}`}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
