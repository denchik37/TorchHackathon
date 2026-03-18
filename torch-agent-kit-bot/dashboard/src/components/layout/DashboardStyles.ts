/**
 * Shared dashboard styling tokens.
 * Aligned with frontend: borders-only depth, no glassmorphism, bg-background for cards.
 */

export const dashboardStyles = {
  page: "container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 max-w-6xl",
  pageNarrow: "container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 max-w-4xl",
  pageHeader:
    "flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-6 mb-8",
  pageTitle: "text-xl font-semibold text-foreground",
  card: "rounded-xl border border-white/[0.08] bg-background overflow-hidden",
  cardPadding: "p-4 sm:p-5",
  kpiCard: "rounded-xl border border-white/[0.08] bg-background p-4 sm:p-5",
  kpiLabel: "text-sm font-medium text-muted-foreground",
  kpiValue: "mt-1 text-lg font-semibold text-foreground",
  kpiSub: "text-xs text-muted-foreground mt-1",
  tableWrap: "rounded-xl border border-white/[0.08] bg-background overflow-hidden",
  tableHead: "bg-[hsl(0_0%_7%)] border-b border-white/[0.08] text-muted-foreground text-sm",
  tableTh: "px-4 py-3 font-medium text-left",
  tableTd: "px-4 py-3 text-foreground",
  tableRowHover: "hover:bg-white/[0.03] transition-colors",
  badge: "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
  badgePrimary: "bg-primary/10 text-primary",
  badgeSuccess: "bg-emerald-500/10 text-emerald-400",
  badgeWarning: "bg-amber-500/10 text-amber-500",
  badgeMuted: "bg-white/[0.06] text-muted-foreground",
  emptyState: "rounded-xl border border-white/[0.08] bg-background p-12 text-center text-muted-foreground text-sm",
  tabButton:
    "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
  tabActive: "bg-primary text-white",
  tabInactive: "text-muted-foreground hover:text-foreground",
} as const;
