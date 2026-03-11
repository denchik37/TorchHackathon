/**
 * NoBetsContainer styling primitives (empty state when user has no bets).
 */

export const noBetsContainerStyles = {
  root: 'flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center',
  content: 'space-y-2 max-w-sm',
  title: 'text-xl font-semibold text-foreground',
  description: 'text-sm text-muted-foreground',
} as const;
