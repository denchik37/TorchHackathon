/**
 * Shared dashboard styling tokens.
 * Aligned with frontend: cards, panels, tables, badges, spacing.
 */

export const dashboardStyles = {
  page: "container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 max-w-6xl",
  pageNarrow: "container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 max-w-4xl",
  pageHeader:
    "flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6 mb-8",
  pageTitle: "text-xl font-semibold text-foreground",
  card: "rounded-xl border border-border bg-card overflow-hidden",
  cardPadding: "p-4 sm:p-5",
  kpiCard: "rounded-xl border border-border bg-card p-4 sm:p-5",
  kpiLabel: "text-sm font-medium text-muted-foreground",
  kpiValue: "mt-1 text-lg font-semibold text-foreground",
  kpiSub: "text-xs text-muted-foreground mt-1",
  tableWrap: "rounded-xl border border-white/10 glass-card overflow-hidden",
  tableHead: "bg-card/80 border-b border-border text-muted-foreground text-sm",
  tableTh: "px-4 py-3 font-medium text-left",
  tableTd: "px-4 py-3 text-foreground",
  tableRowHover: "hover:bg-primary/5 transition-colors",
  badge: "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
  badgePrimary: "bg-primary/15 text-primary",
  badgeSuccess: "bg-destructive/15 text-destructive",
  badgeWarning: "bg-torch-orange/20 text-torch-orange",
  badgeMuted: "bg-muted/20 text-muted-foreground",
  emptyState: "rounded-xl border border-border bg-card p-12 text-center text-muted-foreground text-sm",
  tabButton:
    "px-4 py-2 rounded-t-lg text-sm font-medium transition-colors border-b-2 -mb-px",
  tabActive: "border-primary text-foreground",
  tabInactive: "border-transparent text-muted-foreground hover:text-foreground",
} as const;
