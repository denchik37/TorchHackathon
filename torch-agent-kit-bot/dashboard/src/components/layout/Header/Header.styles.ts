/**
 * Dashboard header styling primitives.
 * Mirrors frontend Header layout: same rhythm, spacing, and premium feel.
 * Identity: Icon + "Bot" (dashboard counterpart to Torch branding).
 */

export const headerStyles = {
  root:
    "border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 transition-colors",
  inner:
    "container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between max-w-[1600px]",
  left: "flex items-center gap-6",
  right: "flex items-center gap-6",
  logoText: "text-xl font-bold text-foreground",
  logoLink:
    "flex items-center gap-2 transition-opacity hover:opacity-90 focus:outline-none focus:ring-0 rounded-md",
  navLink: "text-sm font-medium text-muted-foreground hover:text-foreground transition-colors",
} as const;
