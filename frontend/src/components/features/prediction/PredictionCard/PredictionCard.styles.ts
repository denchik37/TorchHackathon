/**
 * PredictionCard styling primitives.
 * Glassy surfaces use .glass / .glass-card in dark theme (globals.css).
 */

export const predictionCardStyles = {
  card: 'rounded-xl border border-white/10 bg-card/95 backdrop-blur-sm overflow-hidden',
  header: 'border-b border-white/10',
  badge: 'inline-flex items-center rounded-md bg-primary/15 text-primary text-xs font-medium px-2.5 py-1',
  marketTitle: 'text-lg font-semibold text-foreground',
  priceLabel: 'text-xs text-muted-foreground',
  divider: 'border-t border-white/10 my-4',
  stepBadge: 'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary text-xs font-semibold text-primary',
  stepTitle: 'text-sm font-medium text-foreground',
  stepHint: 'text-xs text-muted-foreground',
  panel: 'rounded-xl glass-card p-4',
  dateTimeGrid: 'grid grid-cols-2 gap-3',
  dateTimeBox: 'flex flex-col items-center justify-center rounded-xl glass-card p-4 text-center',
  dateTimeLabel: 'text-xs font-medium text-muted-foreground mb-1',
  dateTimeValue: 'text-lg font-semibold tabular-nums text-foreground',
  dateTimeMeta: 'text-xs text-muted-foreground mt-1',
  amountModule: 'rounded-xl glass-card p-4',
  amountInput: 'rounded-lg bg-background/80 border border-white/15 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-border backdrop-blur-sm',
  amountInputWrap: 'relative',
  amountSuffix: 'absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm text-muted-foreground',
  amountActions: 'flex justify-end items-center gap-2 mt-2 text-xs',
  amountMax: 'font-medium text-primary hover:underline cursor-pointer',
  protocolFeeRow: 'flex justify-between items-center py-3 px-0 text-sm',
  /** Warning – same purple as step 1/2/3 numbers (border-primary, icon text-primary) */
  calloutWarning: 'rounded-xl border-2 border-primary/40 bg-primary/10 backdrop-blur-sm p-4',
  calloutError: 'rounded-xl border border-destructive/30 bg-destructive/10 p-4',
  calloutIcon: 'flex-shrink-0 mt-0.5 text-primary',
  calloutWarningText: 'text-sm text-foreground/90',
  summaryChips: 'flex flex-wrap gap-2',
  summaryChip: 'rounded-xl glass-card px-3 py-2 text-xs',
  summaryChipLabel: 'text-muted-foreground',
  summaryChipValue: 'font-semibold text-foreground tabular-nums',
  ctaButton: 'w-full rounded-xl h-12 text-base font-semibold transition-all',
  ctaButtonDisabled: 'opacity-60 cursor-not-allowed',
  betTabRow: 'space-y-6',
  betTabRowWithBorder: 'pt-6 border-t border-white/10',
} as const;
