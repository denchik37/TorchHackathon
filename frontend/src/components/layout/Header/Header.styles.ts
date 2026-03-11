/**
 * Header layout styling primitives.
 * Tailwind class names only; no business logic.
 */

export const headerStyles = {
  root:
    'border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 transition-colors',
  inner: 'container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between max-w-[1600px]',
  left: 'flex items-center gap-6',
  right: 'flex items-center gap-8',
  logoText: 'text-xl font-bold text-foreground',
  logoLink: 'flex items-center gap-2 transition-opacity hover:opacity-90 focus:outline-none focus:ring-0 rounded-md',
  navLink: 'text-sm font-medium text-muted-foreground hover:text-foreground transition-colors',
  /** Balance only when connected; separate from Connected dropdown */
  walletCapsuleBalance:
    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground bg-card/60 backdrop-blur-sm rounded-l-full border border-r-0 border-white/10',
  /** Connected dropdown trigger: purple dot + Connected + chevron */
  connectedTriggerWrap: 'inline-flex items-center rounded-r-full border border-white/10 bg-card/60 backdrop-blur-sm overflow-hidden',
  connectedTrigger:
    'flex items-center gap-2 pl-3 pr-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors data-[state=open]:bg-muted/40',
  connectedDot: 'w-2 h-2 rounded-full bg-primary flex-shrink-0',
  dropdownContent: 'min-w-[14rem] w-full rounded-xl border border-white/10 bg-card/95 backdrop-blur-md py-1 shadow-xl',
  /** Full-width row: address text + copy icon (tick turns primary when copied) */
  dropdownCopyRow: 'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-foreground outline-none',
  dropdownCopyAddress: 'font-mono text-xs truncate min-w-0',
  dropdownCopyIcon: 'flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground transition-colors',
  dropdownCopyIconCopied: 'text-primary',
  dropdownItemDanger: 'w-full flex items-center gap-2 cursor-pointer px-3 py-2.5 text-sm text-destructive outline-none',
  spinner: 'w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0',
} as const;
