/**
 * NoBetsContainer styling primitives (empty state when user has no bets).
 */

export const noBetsContainerStyles = {
  root: 'flex flex-col items-center justify-center py-20 sm:py-28 px-4 text-center gap-6',
  content: 'space-y-2 max-w-sm',
  title: 'text-xl font-semibold text-foreground',
  description: 'text-sm text-muted-foreground',
} as const;
