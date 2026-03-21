'use client';

import React, { useState } from 'react';
import { Layers, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { formatTinybarsToHbar, cn } from '@/lib/utils';

export type OracleBucketRow = {
  id: string;
  totalBets: number;
  totalStaked: string;
  aggregationComplete: boolean;
  nextProcessIndex: number;
  totalWinningWeight: string;
};

export function BucketFuturisticCard({ bucket: b, index }: { bucket: OracleBucketRow; index: number }) {
  const [open, setOpen] = useState(false);
  const processPct =
    b.totalBets > 0 ? Math.min(100, (b.nextProcessIndex / Math.max(b.totalBets, 1)) * 100) : 0;
  const staggerMs = Math.min(index * 70, 600);

  return (
    <article
      className={cn(
        'bucket-card-enter bucket-futuristic-card group relative overflow-hidden rounded-xl border border-white/[0.1]',
        !b.aggregationComplete && 'bucket-card-pending'
      )}
      style={{ animationDelay: `${staggerMs}ms` }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
        style={{
          background:
            'linear-gradient(135deg, hsl(0 0% 100% / 0.04) 0%, transparent 42%, hsl(0 0% 100% / 0.03) 100%)',
        }}
      />
      <div className="relative z-[1]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-white/[0.03]"
        >
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.05]">
            <Layers className="size-5 text-primary" />
            {!b.aggregationComplete ? (
              <span className="bucket-corner-ping absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-400" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Bucket <span className="font-mono text-primary">{b.id}</span>
              </h2>
              <Sparkles className="size-3.5 text-primary/70 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {b.totalBets} bets · {formatTinybarsToHbar(b.totalStaked)} HBAR staked
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="bucket-progress-shine h-full rounded-full bg-gradient-to-r from-primary/50 via-primary to-primary/70"
                style={{ width: `${processPct}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] font-mono text-muted-foreground">
              Process index {b.nextProcessIndex} / {b.totalBets}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                b.aggregationComplete
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400'
              )}
            >
              {b.aggregationComplete ? 'Complete' : 'Open'}
            </span>
            {open ? (
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            )}
          </div>
        </button>
        {open ? (
          <div className="border-t border-white/[0.08] px-4 pb-4 pt-3">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <dt className="text-muted-foreground">Total staked</dt>
              <dd className="font-medium text-foreground">{formatTinybarsToHbar(b.totalStaked)} HBAR</dd>
              <dt className="text-muted-foreground">Winning weight</dt>
              <dd className="truncate font-mono text-xs text-foreground" title={b.totalWinningWeight}>
                {b.totalWinningWeight}
              </dd>
              <dt className="text-muted-foreground">Next index</dt>
              <dd className="font-mono text-foreground">{b.nextProcessIndex}</dd>
            </dl>
          </div>
        ) : null}
      </div>
    </article>
  );
}
