"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { headerStyles } from "./Header.styles";

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
          <NavLink href="/">Overview</NavLink>
          <NavLink href="/runs">Runs</NavLink>
          <NavLink href="/account">Account</NavLink>
        </div>

        <div className={headerStyles.right}>
          <a
            href="https://torch-hackathon.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className={headerStyles.navLink + " flex items-center gap-1.5"}
          >
            Torch app
            <ExternalLink className="w-3.5 h-3.5 opacity-70" aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}
