export const appSkeletonStyles = {
  root: 'min-h-dvh bg-background',
  header:
    'sticky top-0 z-50 border-b border-white/[0.08] bg-background',
  headerInner: 'mx-auto px-4 sm:px-6 max-w-7xl',
  headerRow: 'h-12 flex items-center justify-between',
  main: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl',
  card: 'w-full',
  cardInner: 'rounded-xl border border-white/[0.08] bg-background overflow-hidden p-6',
  chartArea: 'h-48 rounded-md overflow-hidden',
  statBox: 'rounded-md border border-white/[0.08] p-3',
} as const;
