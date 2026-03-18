export const betCardStyles = {
  card: 'rounded-xl border border-white/[0.08] bg-background overflow-hidden transition-colors hover:border-white/[0.12]',
  content: 'p-5 sm:p-6',
  header: 'flex items-center justify-between gap-3 mb-4',
  statusBadge: 'inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-semibold',
  statusActive: 'bg-primary/10 text-primary',
  statusWon: 'bg-emerald-500/10 text-emerald-400',
  statusLost: 'bg-white/[0.06] text-muted-foreground',
  label: 'text-xs font-medium text-muted-foreground',
  value: 'text-sm font-semibold text-foreground tabular-nums',
  valueGreen: 'text-sm font-semibold text-emerald-400 tabular-nums',
  footer: 'flex flex-wrap items-center justify-between gap-2 mt-4 pt-4 border-t border-white/[0.08] text-xs text-muted-foreground',
  redeemButton: 'rounded-md bg-primary text-white font-semibold hover:bg-primary/85 transition-colors px-4 py-2',
} as const;
