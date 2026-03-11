/**
 * BetPlacingModal styling primitives.
 */

export const betPlacingModalStyles = {
  overlay: 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4',
  panel: 'relative w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl',
  closeButton: 'absolute top-4 right-4 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors',
  title: 'text-lg font-semibold text-foreground text-center',
  description: 'text-center text-sm text-muted-foreground mt-2 space-y-1',
} as const;
