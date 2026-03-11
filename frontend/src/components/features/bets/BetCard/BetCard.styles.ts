/**
 * BetCard styling primitives. Glassy card.
 */

export const betCardStyles = {
  card: 'rounded-xl border border-white/10 bg-card/80 backdrop-blur-sm overflow-hidden transition-colors hover:border-white/20',
  content: 'p-5 sm:p-6',
  header: 'flex items-center justify-between gap-3 mb-4',
  statusBadge: 'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
  statusActive: 'bg-primary/15 text-primary',
  statusWon: 'bg-destructive/15 text-destructive',
  statusLost: 'bg-muted text-muted-foreground',
  label: 'text-xs font-medium text-muted-foreground',
  value: 'text-sm font-semibold text-foreground tabular-nums',
  valueGreen: 'text-sm font-semibold text-destructive tabular-nums',
  footer: 'flex flex-wrap items-center justify-between gap-2 mt-4 pt-4 border-t border-white/10 text-xs text-muted-foreground',
  redeemButton: 'rounded-lg bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/90 transition-colors px-4 py-2',
} as const;
