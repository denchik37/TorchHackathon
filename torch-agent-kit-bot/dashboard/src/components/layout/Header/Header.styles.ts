/**
 * Dashboard header layout primitives.
 * Surface glass treatment lives in globals.css (.elite-nav, .elite-dropdown).
 */

export const headerStyles = {
  /** Shell: full width; glass from .elite-nav on <header> */
  root: "sticky top-0 z-50 w-full elite-nav",
  /** Inner row: aligns with main content width */
  inner:
    "mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8",
  /** Brand + primary nav cluster */
  left: "flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:gap-5",
  /** Align with frontend wallet cluster: same row height and end padding */
  right: "flex h-14 shrink-0 items-center justify-end gap-2",
  logoText: "text-sm font-semibold tracking-tight text-foreground",
  logoLink:
    "flex items-center gap-2 rounded-md px-1 py-1 sm:px-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  navLink:
    "inline-flex h-9 items-center px-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground",
  navLinkActive: "text-primary",
} as const;
