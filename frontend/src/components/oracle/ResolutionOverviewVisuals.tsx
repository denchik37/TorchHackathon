'use client';

import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const PURPLE = 'hsl(262 76% 53%)';

type BucketRow = {
  id: string;
  aggregationComplete: boolean;
};

type BetRow = {
  timestamp: string;
};

type FeeRow = {
  timestamp: string;
};

const tooltipStyle = {
  background:
    'linear-gradient(180deg, hsl(228 10% 11% / 0.96) 0%, hsl(228 8% 7% / 0.92) 100%)',
  border: '1px solid hsl(0 0% 100% / 0.18)',
  borderRadius: 12,
  fontSize: 12,
  padding: '8px 10px',
  color: 'hsl(0 0% 96%)',
  boxShadow: '0 14px 36px hsl(0 0% 0% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.08)',
  backdropFilter: 'blur(14px)',
};

function ChartShell({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/[0.08] bg-transparent backdrop-blur-sm ${className ?? ''}`}
    >
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        {subtitle ? <p className="mt-0.5 text-[11px] text-muted-foreground/80">{subtitle}</p> : null}
      </div>
      <div className="p-3 pt-2">{children}</div>
    </div>
  );
}

export function ResolutionOverviewVisuals({
  buckets,
  loading,
}: {
  buckets: BucketRow[];
  bets: BetRow[];
  fees: FeeRow[];
  loading: boolean;
}) {
  const bucketPie = useMemo(() => {
    let complete = 0;
    let open = 0;
    for (const b of buckets) {
      if (b.aggregationComplete) complete++;
      else open++;
    }
    return [
      { name: 'Aggregated', value: complete, key: 'c' },
      { name: 'Open', value: open, key: 'o' },
    ].filter((d) => d.value > 0);
  }, [buckets]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((k) => (
          <div
            key={k}
            className="h-52 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <ChartShell
          title="Bucket aggregation"
          subtitle="On-chain buckets: aggregated vs still open"
        >
          <div className="h-[200px] w-full">
            {bucketPie.length === 0 ? (
              <p className="py-16 text-center text-xs text-muted-foreground">No bucket data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bucketPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {bucketPie.map((entry, i) => (
                      <Cell
                        key={entry.key}
                        fill={i === 0 ? PURPLE : 'hsl(262 40% 35%)'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [v, 'Buckets']}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: 'hsl(0 0% 98%)', fontWeight: 600 }}
                    labelStyle={{ color: 'hsl(0 0% 100%)', fontWeight: 700 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartShell>
      </div>
    </div>
  );
}
