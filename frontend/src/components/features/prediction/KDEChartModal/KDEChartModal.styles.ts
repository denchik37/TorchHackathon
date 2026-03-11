/**
 * KDEChartModal styling primitives.
 */

export const kdeChartModalStyles = {
  backdrop: 'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm',
  modal:
    'fixed inset-4 z-50 flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden sm:inset-6 lg:inset-8',
  header:
    'flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 border-b border-border bg-muted/20',
  headerTitle: 'text-lg font-semibold text-foreground',
  headerSubtitle: 'text-sm text-muted-foreground mt-0.5',
  headerMeta: 'flex items-center gap-3 text-xs text-muted-foreground',
  zoomGroup: 'flex items-center gap-1',
  zoomButton:
    'h-9 w-9 p-0 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors',
  zoomLabel: 'text-xs tabular-nums text-muted-foreground min-w-[2.5rem] text-center',
  closeButton: 'h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors',
  infoPanel: 'p-4 border-b border-border bg-muted/10',
  infoGrid: 'grid grid-cols-1 md:grid-cols-3 gap-6 text-sm',
  infoSectionTitle: 'font-semibold text-foreground mb-2',
  infoList: 'space-y-1 text-xs text-muted-foreground',
  chartArea: 'flex-1 min-h-0 p-4 overflow-auto',
} as const;
