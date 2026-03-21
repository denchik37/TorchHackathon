'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { gql, useQuery } from '@apollo/client';
import { PageLayout } from '@/components/layout';
import { formatDateUTC, formatTinybarsToHbar, formatResolverRunIdToDate } from '@/lib/utils';
import { ResolutionOverviewVisuals } from '@/components/oracle/ResolutionOverviewVisuals';
import { BucketFuturisticCard } from '@/components/oracle/BucketFuturisticCard';
import {
  LayoutDashboard,
  ListTodo,
  Layers,
  History,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const GET_UNRESOLVED = gql`
  query GetUnresolvedForOracle {
    bets(
      where: { bucketRef_: { aggregationComplete: false }, finalized: false }
      first: 1000
      orderBy: targetTimestamp
      orderDirection: asc
    ) {
      id
      stake
      priceMin
      priceMax
      targetTimestamp
      bucket
      bucketRef {
        id
        aggregationComplete
        nextProcessIndex
        totalBets
        totalStaked
        totalWinningWeight
      }
    }
  }
`;

const GET_BUCKETS = gql`
  query GetBucketsForOracle {
    buckets(first: 200, orderBy: id, orderDirection: asc) {
      id
      totalBets
      totalStaked
      aggregationComplete
      nextProcessIndex
      totalWinningWeight
    }
  }
`;

const GET_OVERVIEW_CHARTS = gql`
  query ResolutionOverviewCharts {
    bets(first: 2000, orderBy: timestamp, orderDirection: desc) {
      timestamp
      won
      finalized
    }
    fees(first: 80, orderBy: timestamp, orderDirection: desc) {
      id
      amount
      timestamp
    }
  }
`;

type TabId = 'overview' | 'unresolved' | 'buckets' | 'runs';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="size-4" /> },
  { id: 'unresolved', label: 'Unresolved', icon: <ListTodo className="size-4" /> },
  { id: 'buckets', label: 'Buckets', icon: <Layers className="size-4" /> },
  { id: 'runs', label: 'Resolver Runs', icon: <History className="size-4" /> },
];

export default function OraclePage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [expandedTs, setExpandedTs] = useState<Set<string>>(new Set());
  const [runs, setRuns] = useState<{ runId: string; name: string }[]>([]);
  const [selectedRun, setSelectedRun] = useState<object | null>(null);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [price, setPrice] = useState<{ coinGecko: number | null; oracle: number | null }>({
    coinGecko: null,
    oracle: null,
  });
  const [copied, setCopied] = useState(false);

  const { data: unresolvedData, loading: loadingUnresolved, refetch: refetchUnresolved } = useQuery(GET_UNRESOLVED);
  const { data: bucketsData, loading: loadingBuckets, refetch: refetchBuckets } = useQuery(GET_BUCKETS);
  const { data: overviewChartsData, loading: loadingOverviewCharts, refetch: refetchOverviewCharts } = useQuery(
    GET_OVERVIEW_CHARTS,
    { skip: activeTab !== 'overview' }
  );

  const unresolvedBets = unresolvedData?.bets ?? [];
  const buckets = bucketsData?.buckets ?? [];
  const unresolvedBuckets = buckets.filter((b: { aggregationComplete: boolean }) => !b.aggregationComplete);
  const overviewBets = overviewChartsData?.bets ?? [];
  const overviewFees = overviewChartsData?.fees ?? [];

  const uniqueTimestamps = useMemo((): number[] => {
    const timestamps = unresolvedBets.map((b: { targetTimestamp: string }) => Number(b.targetTimestamp)) as number[];
    return Array.from(new Set(timestamps)).sort((a, b) => a - b);
  }, [unresolvedBets]);

  const nowUnix = Math.floor(Date.now() / 1000);
  const bufferSec = 120;
  const isEligible = (ts: number) => ts <= nowUnix - bufferSec;

  React.useEffect(() => {
    fetch('/api/oracle/runs')
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .catch(() => setRuns([]));
  }, [activeTab]);

  React.useEffect(() => {
    fetch('/api/oracle/price')
      .then((r) => r.json())
      .then(setPrice)
      .catch(() => setPrice({ coinGecko: null, oracle: null }));
  }, []);

  const fetchRunDetail = async (runId: string) => {
    try {
      const r = await fetch(`/api/oracle/runs/${encodeURIComponent(runId)}`);
      const data = await r.json();
      setSelectedRun(data);
      setJsonModalOpen(true);
    } catch {
      setSelectedRun(null);
    }
  };

  const copyJson = () => {
    if (selectedRun) {
      navigator.clipboard.writeText(JSON.stringify(selectedRun, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleTs = (ts: string) => {
    setExpandedTs((prev) => {
      const next = new Set(prev);
      if (next.has(ts)) next.delete(ts);
      else next.add(ts);
      return next;
    });
  };

  const refetchAll = useCallback(() => {
    void refetchUnresolved();
    void refetchBuckets();
    if (activeTab === 'overview') void refetchOverviewCharts();
    fetch('/api/oracle/runs')
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []));
    fetch('/api/oracle/price')
      .then((r) => r.json())
      .then(setPrice);
  }, [activeTab, refetchUnresolved, refetchBuckets, refetchOverviewCharts]);

  const cardClass = 'bucket-futuristic-card rounded-xl border border-white/[0.1] overflow-hidden';

  return (
    <PageLayout maxWidth="xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground">Resolution Dashboard</h1>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-primary/85"
          onClick={refetchAll}
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[hsl(0_0%_7%)] p-0.5 border border-white/[0.06] mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={cardClass + ' p-4'}>
              <p className="text-xs text-muted-foreground">Bets unresolved</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {loadingUnresolved ? '…' : unresolvedBets.length}
              </p>
            </div>
            <div className={cardClass + ' p-4'}>
              <p className="text-xs text-muted-foreground">Buckets unresolved</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {loadingBuckets ? '…' : unresolvedBuckets.length}
              </p>
            </div>
            <div className={cardClass + ' p-4'}>
              <p className="text-xs text-muted-foreground">Current HBAR price</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Image
                  src="/hedera-hbar-logo.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 opacity-90"
                  aria-hidden
                />
                <span>{price.coinGecko != null ? `$${price.coinGecko.toFixed(4)}` : '—'}</span>
                {price.oracle != null && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    Oracle: ${price.oracle.toFixed(4)}
                  </span>
                )}
              </p>
            </div>
            <div className={cardClass + ' p-4'}>
              <p className="text-xs text-muted-foreground">Last resolver run</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {runs.length > 0 ? formatResolverRunIdToDate(runs[0].runId) : '—'}
              </p>
            </div>
          </div>

          <ResolutionOverviewVisuals
            buckets={buckets}
            bets={overviewBets}
            fees={overviewFees}
            loading={loadingOverviewCharts || loadingBuckets}
          />
        </div>
      )}

      {activeTab === 'unresolved' && (
        <div className={cardClass + ' no-hover-transform relative'}>
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.28]"
            aria-hidden
            style={{
              backgroundImage:
                'radial-gradient(circle at 22% 18%, hsl(var(--primary) / 0.08), transparent 38%), radial-gradient(circle at 82% 68%, hsl(0 0% 100% / 0.05), transparent 44%)',
            }}
          />
          <div className="relative divide-y divide-white/[0.08] max-h-[600px] overflow-y-auto">
            {loadingUnresolved ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
            ) : uniqueTimestamps.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No unresolved bets.</div>
            ) : (
              uniqueTimestamps.map((ts) => {
                const tsStr = String(ts);
                const expanded = expandedTs.has(tsStr);
                const betsForTs = unresolvedBets.filter((b: { targetTimestamp: string }) => Number(b.targetTimestamp) === ts);
                const bucketIds = Array.from(new Set(betsForTs.map((b: { bucket: number }) => b.bucket)));
                return (
                  <div key={ts}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
                      onClick={() => toggleTs(tsStr)}
                    >
                      {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                      <span className="font-mono text-sm text-foreground">{formatDateUTC(ts)}</span>
                      <span className="text-muted-foreground text-xs">{betsForTs.length} bet(s)</span>
                      <span className="text-muted-foreground text-xs">{bucketIds.length} bucket(s)</span>
                      {isEligible(ts) ? (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md font-medium">Eligible now</span>
                      ) : (
                        <span className="text-xs bg-white/[0.06] text-muted-foreground px-2 py-0.5 rounded-md">Not yet</span>
                      )}
                    </button>
                    {expanded && (
                      <div className="pl-6 pr-4 pb-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground text-xs">
                              <th className="text-left py-2">Bet ID</th>
                              <th className="text-left py-2">Stake</th>
                              <th className="text-left py-2">Min / Max</th>
                              <th className="text-left py-2">Bucket</th>
                            </tr>
                          </thead>
                          <tbody>
                            {betsForTs.map((bet: { id: string; stake: string; priceMin: string; priceMax: string; bucket: number }) => (
                              <tr key={bet.id} className="border-t border-white/[0.06]">
                                <td className="py-2 font-mono text-xs">{bet.id}</td>
                                <td className="py-2 text-xs">{formatTinybarsToHbar(bet.stake)} HBAR</td>
                                <td className="py-2 text-xs tabular-nums">${Number(formatTinybarsToHbar(bet.priceMin)).toFixed(4)} / ${Number(formatTinybarsToHbar(bet.priceMax)).toFixed(4)}</td>
                                <td className="py-2 text-xs">{bet.bucket}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'buckets' && (
        <div className="space-y-4">
          {loadingBuckets ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-xl border border-white/[0.08] bg-white/[0.04]"
                />
              ))}
            </div>
          ) : buckets.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No buckets.</div>
          ) : (
            <div className="relative max-h-[min(70vh,720px)] overflow-y-auto pr-1">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                aria-hidden
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.08), transparent 40%), radial-gradient(circle at 80% 60%, hsl(var(--primary) / 0.06), transparent 45%)',
                }}
              />
              <div className="relative grid grid-cols-1 gap-4 md:grid-cols-2">
                {buckets.map(
                  (
                    b: {
                      id: string;
                      totalBets: number;
                      totalStaked: string;
                      nextProcessIndex: number;
                      aggregationComplete: boolean;
                      totalWinningWeight: string;
                    },
                    i: number
                  ) => (
                    <BucketFuturisticCard key={b.id} bucket={b} index={i} />
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'runs' && (
        <div className={cardClass + ' no-hover-transform relative'}>
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.28]"
            aria-hidden
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 12%, hsl(var(--primary) / 0.08), transparent 42%), radial-gradient(circle at 80% 60%, hsl(0 0% 100% / 0.05), transparent 45%)',
            }}
          />
          <div className="relative overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-white/[0.08]">
                  <th className="text-left py-2">Run ID</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-muted-foreground text-sm">No runs or Torch API not configured.</td>
                  </tr>
                ) : (
                  runs.map((r) => (
                    <tr key={r.runId} className="border-b border-white/[0.06]">
                      <td className="py-2.5 font-mono text-xs text-foreground">{r.runId}</td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/85 transition-colors"
                          onClick={() => fetchRunDetail(r.runId)}
                        >
                          View JSON
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={jsonModalOpen} onOpenChange={setJsonModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col border-white/[0.08] bg-background">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm font-semibold">Run details</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 mb-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={copyJson}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="text-xs bg-[hsl(0_0%_7%)] p-4 rounded-md overflow-auto flex-1 min-h-0 text-foreground border border-white/[0.06]">
            {selectedRun != null ? JSON.stringify(selectedRun, null, 2) : '—'}
          </pre>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
