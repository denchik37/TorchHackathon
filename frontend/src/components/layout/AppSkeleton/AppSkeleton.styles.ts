/**
 * AppSkeleton layout styling primitives.
 * Matches dashboard Header (border, backdrop-blur) and PredictionCard (glass-card, border-white/10).
 */

export const appSkeletonStyles = {
  root: 'min-h-screen bg-background',
  header:
    'border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 transition-colors',
  headerInner: 'container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl',
  headerRow: 'h-16 flex items-center justify-between',
  main: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl',
  card: 'w-full',
  cardInner: 'rounded-xl border border-white/10 bg-card/95 backdrop-blur-sm overflow-hidden p-6',
  chartArea: 'h-48 rounded-xl glass-card overflow-hidden',
  statBox: 'rounded-xl glass-card p-3',
} as const;
