/**
 * WalletSelector styling primitives.
 * Choose-your-wallet dialog matches Prediction Card: black bg, border-white/10, purple close.
 */

export const walletSelectorStyles = {
  trigger:
    'inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 text-primary px-4 py-2 text-sm font-medium transition-all hover:bg-primary/20 hover:border-primary focus:outline-none focus:ring-0 focus:border-primary/50',
  /** Dialog: same black/card look as Prediction Card */
  dialogContent:
    'sm:max-w-md rounded-xl border border-white/10 bg-card/95 backdrop-blur-sm p-0 gap-0 overflow-hidden [&>button]:text-primary [&>button]:hover:text-primary [&>button]:opacity-100 [&>button]:right-4 [&>button]:top-4',
  dialogHeader: 'px-6 pt-6 pb-4 border-b border-white/10',
  dialogTitle: 'text-lg font-semibold text-foreground pr-8',
  optionsList: 'grid gap-2 p-4',
  /** Connector sheet: one row per wallet = Icon | Name with sub text under */
  optionButton:
    'w-full flex items-center gap-3 rounded-xl border border-white/10 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all text-left py-3 px-4',
  optionIcon: 'w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xl flex-shrink-0 border border-primary/30',
  optionContent: 'flex flex-col items-start gap-0.5 min-w-0',
  optionName: 'font-semibold text-foreground text-sm',
  optionDesc: 'text-xs text-muted-foreground',
  spinner: 'w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin',
  /** Connected state when rendered inside Header is handled by Header; these are for standalone balance/address if ever used */
  balanceButton:
    'border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
  addressButton:
    'flex items-center gap-2 bg-muted/30 border border-border text-foreground hover:bg-muted/50',
  walletBadge:
    'flex items-center gap-2 border border-primary/40 text-primary bg-primary/10',
} as const;
