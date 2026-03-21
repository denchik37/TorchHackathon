export const predictionCardStyles = {
  /** Card shell — bg-background, border-only, no blur */
  card: 'rounded-xl border border-white/[0.08] bg-background overflow-hidden',
  header: 'px-6 pt-5 pb-4',
  headerBottom: 'px-6 pb-4 border-b border-white/[0.08]',

  /** Token selector */
  tokenSelectorWrap: 'inline-flex rounded-lg border border-white/[0.08] p-0.5 bg-[hsl(0_0%_7%)]',
  tokenActive: 'inline-flex items-center gap-1.5 rounded-md bg-[hsl(0_0%_11%)] px-3 py-1.5 text-sm font-medium text-foreground',
  tokenDisabled: 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground opacity-40 cursor-not-allowed',
  tokenPlaceholderIcon: 'size-4 rounded-full bg-white/10 flex items-center justify-center text-[8px]',

  /** Active bets badge */
  activeBadge: 'text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium',

  /** Title & price */
  marketTitle: 'text-xl font-bold text-foreground',
  priceLabel: 'text-xs text-muted-foreground',

  /** Tabs */
  tabsList: 'flex gap-1 rounded-lg bg-[hsl(0_0%_7%)] p-0.5 border border-white/[0.06]',
  tabsTrigger: 'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
  tabsTriggerActive: 'bg-primary text-white',
  tabsTriggerInactive: 'text-muted-foreground hover:text-foreground',

  /** Divider between sections */
  divider: 'border-t border-white/[0.08]',

  /** Step indicators */
  stepBadge: 'flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-primary text-[11px] font-bold text-primary',
  stepTitle: 'text-sm font-medium text-foreground',
  stepHint: 'text-[10px] text-muted-foreground',

  /** Date/time picker */
  dateTimeGrid: 'grid grid-cols-2 gap-3',
  dateTimeBox: 'flex flex-col items-center rounded-md border border-white/[0.06] p-3 text-center',
  dateTimeLabel: 'text-[10px] text-muted-foreground mb-1.5',
  dateTimeValue: 'text-sm font-semibold tabular-nums text-foreground',
  dateTimeMeta: 'text-[10px] text-muted-foreground mt-1',
  dateTimeButton: 'size-6 rounded border border-white/[0.08] flex items-center justify-center text-muted-foreground hover:text-foreground',

  /** Bet quality chips */
  summaryLabel: 'text-xs text-muted-foreground',
  summaryChips: 'flex gap-2 mt-1.5',
  summaryChip: 'rounded-md border border-white/[0.08] px-3.5 py-2 text-xs',
  summaryChipLabel: 'text-muted-foreground',
  summaryChipValue: 'font-semibold text-foreground tabular-nums',

  /** Deposit module */
  amountInput: 'w-full rounded-md bg-transparent border border-white/[0.08] text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
  amountInputWrap: 'relative',
  amountSuffix: 'absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-muted-foreground',
  amountActions: 'flex justify-between items-center mt-2 text-xs',
  amountMax: 'font-medium text-primary cursor-pointer',
  protocolFeeRow: 'flex justify-between items-center mt-3 pt-3 border-t border-white/[0.06] text-sm',

  /** Callouts */
  calloutWarning: 'rounded-lg border border-primary/25 bg-primary/5 p-3.5',
  calloutError: 'rounded-lg border border-destructive/30 bg-destructive/5 p-3.5',
  calloutIcon: 'shrink-0 mt-0.5 text-primary',
  calloutWarningText: 'text-sm text-foreground/80',

  /** CTA */
  ctaButton: 'w-full rounded-lg h-12 text-base font-semibold transition-colors',
  ctaButtonDisabled: 'opacity-50 cursor-not-allowed',

  /** Bet tab layout */
  betTabRow: 'space-y-6',
  betSection: 'pb-6 border-b border-white/[0.08]',
  betSectionLast: '',
} as const;
