/**
 * BetHistory styling primitives.
 */

export const betHistoryStyles = {
  root: 'w-full',
  table: 'w-full border-collapse',
  thead: 'border-b border-border',
  th: 'text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
  row: 'border-b border-border transition-colors hover:bg-muted/20',
  cell: 'py-3 px-4 text-sm text-foreground',
  cellMuted: 'py-3 px-4 text-sm text-muted-foreground',
  pagination: 'flex items-center justify-between mt-5 pt-4 border-t border-border',
  paginationButton:
    'rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:pointer-events-none',
} as const;
