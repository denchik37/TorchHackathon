/**
 * Dashboard header styling primitives.
 * Aligned with frontend: borders-only depth, no glassmorphism.
 */

export const headerStyles = {
  root:
    "sticky top-0 z-50 border-b border-white/[0.08] bg-background",
  inner:
    "mx-auto px-4 sm:px-6 h-12 flex items-center justify-between max-w-7xl",
  left: "flex items-center gap-6",
  right: "flex items-center gap-1",
  logoText: "text-sm font-semibold text-foreground",
  logoLink:
    "flex items-center gap-2 transition-opacity hover:opacity-90 focus:outline-none focus:ring-0 rounded-md",
  navLink: "px-2.5 py-1 text-[13px] font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground",
  navLinkActive: "text-foreground bg-[hsl(0_0%_11%)]",
} as const;
