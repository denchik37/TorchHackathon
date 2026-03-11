/**
 * KDEChart styling primitives.
 */

export const kdeChartStyles = {
  root: 'w-full',
  header: 'flex items-center justify-between gap-4 mb-2 flex-wrap',
  headerTitle: 'text-sm font-medium text-foreground',
  headerPrice: 'text-sm font-semibold text-primary tabular-nums',
  controlsWrap: 'flex items-center gap-2',
  controlsButton:
    'h-8 w-8 p-0 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors',
  expandButton:
    'h-8 px-3 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors text-xs font-medium gap-1.5',
} as const;
