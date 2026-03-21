"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ExternalLink, ChevronDown, Menu, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { headerStyles } from "./Header.styles";

const QUICK_LINKS = [
  { label: "Website", href: "https://torch.bet/", external: true },
  { label: "Torch Prediction", href: "https://torch-hackathon.vercel.app/", external: true },
  { label: "Resolution", href: "https://torch-hackathon.vercel.app/oracle", external: true },
] as const;

/** X logomark — matches frontend (not the legacy bird icon) */
function XBrandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const NAV_LINKS = [
  { label: "Runs", href: "/runs" },
  { label: "Account", href: "/account" },
] as const;

export function Header() {
  const pathname = usePathname();
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (brandRef.current && !brandRef.current.contains(event.target as Node)) {
        setBrandMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const closeMobile = () => setMobileNavOpen(false);

  return (
    <header className={headerStyles.root} role="banner">
      <div className={headerStyles.inner}>
        <div className={headerStyles.left}>
          <div
            className="relative inline-flex shrink-0 flex-col items-start"
            ref={brandRef}
          >
            <div className="flex items-center gap-0.5">
              <Link
                href="/"
                className={headerStyles.logoLink}
                aria-label="Dashboard home"
              >
                <Image src="/logo.svg" alt="" width={22} height={22} aria-hidden />
                <span className={headerStyles.logoText}>Bot</span>
              </Link>
              <button
                type="button"
                className="inline-flex items-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => setBrandMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={brandMenuOpen}
                aria-label="Toggle links menu"
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    brandMenuOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
            </div>

            <div
              className={cn(
                "elite-dropdown absolute left-0 top-full z-[60] mt-1 min-w-[14rem] rounded-xl p-1 transition-all duration-200 ease-out",
                brandMenuOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              )}
              role="menu"
              aria-label="External links"
            >
              {QUICK_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setBrandMenuOpen(false)}
                  className="elite-link-item flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs text-foreground/90 hover:text-foreground"
                  role="menuitem"
                >
                  <span>{item.label}</span>
                  <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
                </a>
              ))}
              <div className="mx-2 my-1 h-px bg-white/10" />
              <div className="flex items-center gap-2 px-2 pb-1">
                <a
                  href="https://t.me/denisigin"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setBrandMenuOpen(false)}
                  aria-label="Telegram"
                  className="group/social inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-all duration-200 hover:scale-105 hover:text-primary"
                >
                  <Send className="size-4 transition-transform duration-200 group-hover/social:scale-125" />
                </a>
                <a
                  href="https://x.com/TorchBet"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setBrandMenuOpen(false)}
                  aria-label="X"
                  className="group/social inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-all duration-200 hover:scale-105 hover:text-primary"
                >
                  <XBrandIcon className="size-4 transition-transform duration-200 group-hover/social:scale-125" />
                </a>
              </div>
            </div>
          </div>

        </div>

        <div className={headerStyles.right}>
          <nav
            className="mr-0 hidden items-center gap-1 sm:flex"
            aria-label="Primary navigation"
          >
            {NAV_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    headerStyles.navLink,
                    isActive && headerStyles.navLinkActive
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            className="elite-link-item inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground sm:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls="dashboard-mobile-nav"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            {mobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile: full-width overlay + glass panel (no extra dependencies) */}
      {mobileNavOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] sm:hidden"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <div
            id="dashboard-mobile-nav"
            className="elite-dropdown elite-mobile-panel fixed left-3 right-3 top-[3.75rem] z-50 max-h-[min(70vh,calc(100dvh-5rem))] overflow-y-auto rounded-xl p-2 shadow-xl sm:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <nav className="flex flex-col gap-0.5" aria-label="Primary navigation">
              {NAV_LINKS.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMobile}
                    className={cn(
                      "elite-link-item rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground",
                      isActive && "elite-nav-link-active text-foreground"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-2 border-t border-white/[0.08] pt-2">
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                More
              </p>
              {QUICK_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobile}
                  className="elite-link-item flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs text-foreground/90"
                >
                  <span>{item.label}</span>
                  <ExternalLink className="size-3.5 opacity-60" />
                </a>
              ))}
              <div className="mt-1 flex items-center gap-2 px-2 pb-1">
                <a
                  href="https://t.me/denisigin"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobile}
                  aria-label="Telegram"
                  className="group/social inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-all duration-200 hover:scale-105 hover:text-primary"
                >
                  <Send className="size-4 transition-transform duration-200 group-hover/social:scale-125" />
                </a>
                <a
                  href="https://x.com/TorchBet"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobile}
                  aria-label="X"
                  className="group/social inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-all duration-200 hover:scale-105 hover:text-primary"
                >
                  <XBrandIcon className="size-4 transition-transform duration-200 group-hover/social:scale-125" />
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
