/**
 * PriceRangeSelector styling primitives.
 * Uses .glass, .glass-bar, .glass-range from globals (dark theme).
 */

export const priceRangeSelectorStyles = {
  root: 'space-y-4',
  stepBadge: 'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary text-xs font-semibold text-primary',
  stepTitle: 'text-sm font-medium text-foreground',
  histogram: 'relative h-44 rounded-xl cursor-crosshair overflow-hidden bg-muted/25 border border-white/10',
  bar: 'flex-1 rounded-t transition-all duration-200 bg-primary/60',
  input: 'w-full px-3 py-2.5 rounded-xl border border-white/15 bg-background/80 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 backdrop-blur-sm',
  rangeOverlay: 'absolute top-0 bottom-0 pointer-events-none z-10 bg-muted/40',
  handleMin: 'absolute top-0 bottom-0 w-full bg-primary/80 backdrop-blur-sm',
  handleMax: 'absolute top-0 bottom-0 w-full bg-destructive/80 backdrop-blur-sm',
  currentPriceLine: 'absolute top-0 bottom-0 w-0.5 bg-destructive pointer-events-none',
  currentPriceDot: 'absolute -top-1 -left-1 w-3 h-3 rounded-full border-2 border-card bg-destructive',
} as const;
