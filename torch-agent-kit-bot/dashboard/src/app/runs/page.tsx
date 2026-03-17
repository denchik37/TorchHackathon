"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { dashboardStyles } from "@/components/layout/DashboardStyles";

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
        <div className="h-8 w-32 rounded bg-card animate-pulse mb-6" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-xl glass-card animate-pulse" />
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
        <div className="flex gap-2">
          {filterButtons.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`${dashboardStyles.badge} transition-colors ${
                filter === key
                  ? dashboardStyles.badgePrimary
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-white/15"
              }`}
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
            <tbody className="divide-y divide-border">
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
                    <span className="text-destructive">{r.successCount}</span>
                    {" / "}
                    <span className="text-magenta">{r.failedCount}</span>
                  </td>
                  <td className={dashboardStyles.tableTd}>
                    <Link
                      href={`/runs/${r.date}`}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      Details →
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
