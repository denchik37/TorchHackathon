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

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        headerStyles.navLink,
        "text-sm font-medium",
        isActive && "text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

export function Header() {
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
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
              <Image src="/logo.svg" alt="Bot" width={40} height={40} />
            </div>
            <span className={headerStyles.logoText}>Bot</span>
          </Link>
          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className={headerStyles.navLink + " flex items-center gap-1.5 outline-none focus:ring-0"}
              aria-label="Open links menu"
            >
              <span>Links</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden />
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-1 min-w-[10rem] rounded-xl border border-border bg-card shadow-lg py-1 z-50">
                {SITE_LINKS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted/40 outline-none rounded-md"
                    onClick={() => setDropdownOpen(false)}
                  >
                    {item.label}
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={headerStyles.right}>
          <NavLink href="/runs">Runs</NavLink>
          <NavLink href="/account">Account</NavLink>
        </div>
      </div>
    </header>
  );
}
