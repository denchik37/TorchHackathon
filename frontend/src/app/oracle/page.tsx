'use client';

import React, { useState, useMemo } from 'react';
import { gql, useQuery } from '@apollo/client';
import { Header } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateUTC, formatTinybarsToHbar, formatResolverRunIdToDate } from '@/lib/utils';
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

type TabId = 'overview' | 'unresolved' | 'buckets' | 'runs';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'unresolved', label: 'Unresolved', icon: <ListTodo className="w-4 h-4" /> },
  { id: 'buckets', label: 'Buckets', icon: <Layers className="w-4 h-4" /> },
  { id: 'runs', label: 'Resolver Runs', icon: <History className="w-4 h-4" /> },
];

export default function OraclePage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [expandedTs, setExpandedTs] = useState<Set<string>>(new Set());
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
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

  const unresolvedBets = unresolvedData?.bets ?? [];
  const buckets = bucketsData?.buckets ?? [];
  const unresolvedBuckets = buckets.filter((b: { aggregationComplete: boolean }) => !b.aggregationComplete);
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

  const toggleBucket = (id: string) => {
    setExpandedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refetchAll = () => {
    refetchUnresolved();
    refetchBuckets();
    fetch('/api/oracle/runs').then((r) => r.json()).then((d) => setRuns(d.runs ?? []));
    fetch('/api/oracle/price').then((r) => r.json()).then(setPrice);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Torch Oracle Dashboard</h1>
          <Button
            size="sm"
            className="rounded-lg gap-2 bg-primary text-white hover:bg-primary/90"
            onClick={refetchAll}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border pb-2 mb-6">
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              size="sm"
              className={`rounded-lg gap-2 ${activeTab === tab.id ? 'text-white hover:bg-primary/90' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-xl border border-border bg-card">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Bets unresolved</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {loadingUnresolved ? '…' : unresolvedBets.length}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border border-border bg-card">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Buckets unresolved</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {loadingBuckets ? '…' : unresolvedBuckets.length}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border border-border bg-card">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Last resolver run</p>
                  <p className="text-lg font-medium text-foreground">
                    {runs.length > 0 ? formatResolverRunIdToDate(runs[0].runId) : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border border-border bg-card">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Current HBAR price</p>
                  <p className="text-lg font-medium text-foreground">
                    {price.coinGecko != null ? `$${price.coinGecko.toFixed(4)}` : '—'}
                    {price.oracle != null && (
                      <span className="text-muted-foreground text-sm ml-2">Oracle: ${price.oracle.toFixed(4)}</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'unresolved' && (
          <Card className="rounded-xl border border-border bg-card overflow-hidden">
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {loadingUnresolved ? (
                  <div className="p-8 text-center text-muted-foreground">Loading…</div>
                ) : uniqueTimestamps.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No unresolved bets.</div>
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
                          className="w-full flex items-center gap-2 p-4 text-left hover:bg-muted/20 transition-colors"
                          onClick={() => toggleTs(tsStr)}
                        >
                          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <span className="font-mono text-sm text-foreground">{formatDateUTC(ts)}</span>
                          <span className="text-muted-foreground text-sm">{betsForTs.length} bet(s)</span>
                          <span className="text-muted-foreground text-sm">{bucketIds.length} bucket(s)</span>
                          {isEligible(ts) ? (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded font-medium">Eligible now</span>
                          ) : (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Not yet</span>
                          )}
                        </button>
                        {expanded && (
                          <div className="pl-6 pr-4 pb-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="text-left py-2">Bet ID</th>
                                  <th className="text-left py-2">Stake</th>
                                  <th className="text-left py-2">Min / Max</th>
                                  <th className="text-left py-2">Bucket</th>
                                </tr>
                              </thead>
                              <tbody>
                                {betsForTs.map((bet: { id: string; stake: string; priceMin: string; priceMax: string; bucket: number }) => (
                                  <tr key={bet.id} className="border-t border-border">
                                    <td className="py-2 font-mono">{bet.id}</td>
                                    <td className="py-2">{formatTinybarsToHbar(bet.stake)} HBAR</td>
                                    <td className="py-2">${Number(formatTinybarsToHbar(bet.priceMin)).toFixed(4)} / ${Number(formatTinybarsToHbar(bet.priceMax)).toFixed(4)}</td>
                                    <td className="py-2">{bet.bucket}</td>
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
            </CardContent>
          </Card>
        )}

        {activeTab === 'buckets' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
            {loadingBuckets ? (
              <div className="col-span-full p-8 text-center text-muted-foreground">Loading…</div>
            ) : buckets.length === 0 ? (
              <div className="col-span-full p-8 text-center text-muted-foreground">No buckets.</div>
            ) : (
              buckets.map((b: { id: string; totalBets: number; totalStaked: string; nextProcessIndex: number; aggregationComplete: boolean }) => {
                const expanded = expandedBuckets.has(b.id);
                return (
                  <Card key={b.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/20 transition-colors"
                      onClick={() => toggleBucket(b.id)}
                    >
                      {expanded ? <ChevronDown className="w-4 h-4 text-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-foreground flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">Bucket {b.id}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {b.totalBets} bets · {formatTinybarsToHbar(b.totalStaked)} HBAR staked
                        </p>
                      </div>
                      {b.aggregationComplete ? (
                        <span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-1 rounded font-medium flex-shrink-0">Complete</span>
                      ) : (
                        <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 rounded font-medium flex-shrink-0">Incomplete</span>
                      )}
                    </button>
                    {expanded && (
                      <CardContent className="pt-0 px-4 pb-4 border-t border-border">
                        <dl className="grid grid-cols-2 gap-2 text-sm">
                          <dt className="text-muted-foreground">Total staked</dt>
                          <dd className="font-medium text-foreground">{formatTinybarsToHbar(b.totalStaked)} HBAR</dd>
                          <dt className="text-muted-foreground">Bets count</dt>
                          <dd className="font-medium text-foreground">{b.totalBets}</dd>
                          <dt className="text-muted-foreground">Next process index</dt>
                          <dd className="font-mono text-foreground">{b.nextProcessIndex}</dd>
                          <dt className="text-muted-foreground">Status</dt>
                          <dd className="font-medium text-foreground">{b.aggregationComplete ? 'Complete' : 'Incomplete'}</dd>
                        </dl>
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'runs' && (
          <Card className="rounded-xl border border-border bg-card">
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2">Run ID</th>
                      <th className="text-left py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-4 text-center text-muted-foreground">No runs or Torch API not configured.</td>
                      </tr>
                    ) : (
                      runs.map((r) => (
                        <tr key={r.runId} className="border-b border-border">
                          <td className="py-2 font-mono text-foreground">{r.runId}</td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              className="rounded gap-1 bg-primary text-white hover:bg-primary/90"
                              onClick={() => fetchRunDetail(r.runId)}
                            >
                              View JSON
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={jsonModalOpen} onOpenChange={setJsonModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-foreground">Run details</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-end gap-2 mb-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded gap-1"
                onClick={copyJson}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-auto flex-1 min-h-0 text-foreground border border-border">
              {selectedRun != null ? JSON.stringify(selectedRun, null, 2) : '—'}
            </pre>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
