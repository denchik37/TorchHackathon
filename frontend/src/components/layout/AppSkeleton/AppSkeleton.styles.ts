/**
 * AppSkeleton layout styling primitives.
 */

export const appSkeletonStyles = {
  root: 'min-h-screen bg-background',
  header: 'border-b border-border bg-card',
  headerInner: 'container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl',
  headerRow: 'h-16 flex items-center justify-between',
  main: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl',
  card: 'w-full',
  cardInner: 'rounded-xl border border-border bg-card p-6',
  chartArea: 'h-48 rounded-xl bg-muted/50',
  statBox: 'rounded-xl bg-muted/30 p-3',
} as const;
