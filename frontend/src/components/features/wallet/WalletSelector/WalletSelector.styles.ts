export const walletSelectorStyles = {
  /** Header trigger — solid purple, compact */
  trigger:
    'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-[13px] font-medium text-white transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',

  /** Dialog — tight, elevated one level above page */
  dialogContent:
    'sm:max-w-[380px] rounded-lg border border-white/[0.08] bg-background p-0 gap-0 overflow-hidden [&>button]:text-muted-foreground [&>button]:hover:text-foreground [&>button]:opacity-100 [&>button]:right-3.5 [&>button]:top-3.5',
  dialogHeader: 'px-5 pt-5 pb-1',
  dialogTitle: 'text-[15px] font-semibold text-foreground',
  dialogSubtitle: 'px-5 pb-4 text-xs text-muted-foreground',

  /** Wallet list — divided rows, clean separation */
  optionsList: 'border-t border-border divide-y divide-border',
  optionButton:
    'w-full flex items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-[hsl(0_0%_11%)] group relative',
  optionIcon:
    'size-10 rounded-full flex items-center justify-center text-xl shrink-0 bg-background border border-border',
  optionContent: 'flex flex-col items-start min-w-0 flex-1',
  optionName: 'text-[13px] font-medium text-foreground',
  optionDesc: 'text-[11px] text-muted-foreground mt-0.5',
  /** Purple left accent on hover */
  optionAccent:
    'absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity',

  spinner: 'size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin',

  /** Connected state (standalone, outside Header) */
  balanceButton:
    'border border-border text-muted-foreground',
  addressButton:
    'bg-[hsl(0_0%_11%)] text-foreground hover:bg-[hsl(0_0%_13%)] transition-colors',
  walletBadge:
    'border border-border text-muted-foreground',
} as const;
