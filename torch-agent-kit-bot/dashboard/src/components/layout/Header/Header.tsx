"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { headerStyles } from "./Header.styles";

const SITE_LINKS = [
  { label: "Website", href: "https://torch.bet/", external: true },
  { label: "Oracle", href: "https://torch-hackathon.vercel.app/oracle", external: true },
  { label: "Bot", href: "https://torch-agent.vercel.app/", external: true },
] as const;

const NAV_LINKS = [
  { label: "Runs", href: "/runs" },
  { label: "Account", href: "/account" },
] as const;

export function Header() {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className={headerStyles.root}>
      <div className={headerStyles.inner}>
        <div className={headerStyles.left}>
          <Link href="/" className={headerStyles.logoLink} aria-label="Dashboard home">
            <Image src="/logo.svg" alt="Bot" width={20} height={20} />
            <span className={headerStyles.logoText}>Bot</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            <div className="relative" ref={ref}>
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className={cn(headerStyles.navLink, "flex items-center gap-1.5 outline-none focus:ring-0")}
                aria-label="Open links menu"
              >
                <span>Links</span>
                <ChevronDown className="size-3.5 opacity-70" aria-hidden />
              </button>
              {dropdownOpen && (
                <div className="absolute left-0 top-full mt-1 min-w-[10rem] rounded-xl border border-white/[0.08] bg-background py-1 z-50">
                  {SITE_LINKS.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-white/[0.03] outline-none rounded-md"
                      onClick={() => setDropdownOpen(false)}
                    >
                      {item.label}
                      <ExternalLink className="size-3.5 opacity-70" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
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
        </div>
      </div>
    </header>
  );
}
