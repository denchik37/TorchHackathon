export const priceRangeSelectorStyles = {
  root: 'space-y-4',
  stepBadge: 'flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-primary text-[11px] font-bold text-primary',
  stepTitle: 'text-sm font-medium text-foreground',
  histogram: 'relative h-44 rounded-md cursor-crosshair overflow-hidden bg-transparent border border-white/[0.06]',
  bar: 'flex-1 rounded-t transition-all duration-200 bg-primary/60',
  input: 'w-full px-3 py-2.5 rounded-md border border-white/[0.08] bg-transparent text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
  rangeOverlay: 'absolute top-0 bottom-0 pointer-events-none z-10 bg-primary/15',
  handleMin: 'absolute top-0 bottom-0 w-full bg-primary/80',
  handleMax: 'absolute top-0 bottom-0 w-full bg-destructive/80',
  currentPriceLine: 'absolute top-0 bottom-0 w-0.5 bg-destructive pointer-events-none',
  currentPriceDot: 'absolute -top-1 -left-1 size-3 rounded-full border-2 border-background bg-destructive',
} as const;
