'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronDown, Copy, LogOut, Check, ExternalLink, Menu, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatAddress } from '@/lib/utils';
import { WalletSelector } from '@/components/features/wallet';
import { useWallet, useBalance, useAccountId } from '@buidlerlabs/hashgraph-react-wallets';

const QUICK_LINKS = [
  { label: 'Website', href: 'https://torch.bet/', external: true },
  { label: 'Torch Bot', href: 'https://torch-agent.vercel.app/', external: true },
  { label: 'Resolution', href: '/oracle', external: false },
] as const;

/** X (Twitter) logomark — not the legacy bird icon */
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

export function Header() {
  const pathname = usePathname();
  const { isConnected, disconnect } = useWallet();
  const { data: balanceData, isLoading: balanceLoading } = useBalance({ autoFetch: isConnected });
  const { data: accountId } = useAccountId();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const balance = React.useMemo(() => {
    if (!balanceData) return 0;
    if (typeof balanceData === 'object' && 'hbars' in balanceData) {
      return parseFloat(balanceData.hbars.toString());
    }
    if (typeof balanceData === 'object' && 'value' in balanceData) {
      return parseFloat(balanceData.value.toString());
    }
    return parseFloat(balanceData.toString());
  }, [balanceData]);

  const [copied, setCopied] = React.useState(false);
  const [linksOpen, setLinksOpen] = React.useState(false);
  const linksRef = React.useRef<HTMLDivElement>(null);

  const handleCopyAddress = React.useCallback(async () => {
    if (accountId) {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [accountId]);

  /** Numeric balance only — HBAR is shown via Hedera mark in the UI */
  const formatBalanceAmount = React.useCallback((bal: number) => {
    if (!bal) return '0';
    if (bal >= 1000) return `${(bal / 1000).toFixed(2)}k`;
    return bal.toFixed(2);
  }, []);

  const closeMobileNav = React.useCallback(() => setMobileNavOpen(false), []);
  const closeLinks = React.useCallback(() => setLinksOpen(false), []);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (linksRef.current && !linksRef.current.contains(event.target as Node)) {
        closeLinks();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeLinks]);

  return (
    <header
      className="elite-nav sticky top-0 z-50 w-full"
      role="banner"
    >
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Brand + primary nav — anchored cluster (desktop: single horizontal row) */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:gap-5">
          <div className="relative inline-flex shrink-0 flex-col items-start" ref={linksRef}>
            <div className="flex items-center gap-0.5">
              <Link
                href="/"
                className="flex items-center gap-2 rounded-md px-1 py-1 sm:px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Torch home"
              >
                <Image src="/logo.svg" alt="" width={22} height={22} aria-hidden />
                <span className="text-sm font-semibold tracking-tight text-foreground">Torch</span>
              </Link>
              <button
                type="button"
                className="inline-flex items-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => setLinksOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={linksOpen}
                aria-label="Toggle links menu"
              >
                <ChevronDown
                  className={cn(
                    'size-3.5 transition-transform duration-200',
                    linksOpen && 'rotate-180'
                  )}
                  aria-hidden
                />
              </button>
            </div>

            <div
              className={cn(
                'elite-dropdown absolute left-0 top-full z-[60] mt-1 min-w-[14rem] rounded-xl p-1 transition-all duration-200 ease-out',
                linksOpen
                  ? 'pointer-events-auto translate-y-0 opacity-100'
                  : 'pointer-events-none -translate-y-1 opacity-0'
              )}
              role="menu"
              aria-label="External links"
            >
              {QUICK_LINKS.map((item) =>
                item.external ? (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeLinks}
                    className="elite-link-item flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs text-foreground/90 hover:text-foreground"
                    role="menuitem"
                  >
                    <span>{item.label}</span>
                    <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={closeLinks}
                    className="elite-link-item flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs text-foreground/90 hover:text-foreground"
                    role="menuitem"
                  >
                    <span>{item.label}</span>
                  </Link>
                )
              )}
              <div className="mx-2 my-1 h-px bg-white/10" />
              <div className="flex items-center gap-2 px-2 pb-1">
                <a
                  href="https://t.me/denisigin"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeLinks}
                  aria-label="Telegram"
                  className="group/social inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 hover:scale-105 hover:text-vibrant-purple"
                >
                  <Send className="size-4 transition-transform duration-200 group-hover/social:scale-125" />
                </a>
                <a
                  href="https://x.com/TorchBet"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeLinks}
                  aria-label="X"
                  className="group/social inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 hover:scale-105 hover:text-vibrant-purple"
                >
                  <XBrandIcon className="size-4 transition-transform duration-200 group-hover/social:scale-125" />
                </a>
              </div>
            </div>
          </div>

          <span className="hidden h-5 w-px shrink-0 bg-white/[0.06] sm:block" aria-hidden />
        </div>

        {/* Right: mobile menu + wallet (h-14 matches dashboard primary nav row) */}
        <div className="flex h-14 shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            className="elite-link-item inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground sm:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-primary-nav"
            aria-label="Open navigation menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="size-5" />
          </button>

          <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <DialogContent
              id="mobile-primary-nav"
              className="elite-dropdown left-4 right-4 top-[5.5rem] max-h-[min(70vh,calc(100dvh-6rem))] w-auto max-w-none translate-x-0 translate-y-0 overflow-y-auto border p-0 sm:hidden data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <DialogHeader className="border-b border-white/[0.08] px-4 py-3 text-left">
                <DialogTitle className="text-base font-semibold">Navigate</DialogTitle>
              </DialogHeader>
              <nav className="flex flex-col gap-0.5 p-2" aria-label="Primary navigation">
                <Link
                  href="/my-bets"
                  onClick={closeMobileNav}
                  className={cn(
                    'elite-link-item rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground',
                    pathname.startsWith('/my-bets') && 'elite-nav-link-active text-foreground'
                  )}
                >
                  My Bets
                </Link>
              </nav>
              <div className="border-t border-white/[0.08] p-2">
                <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  More
                </p>
                {QUICK_LINKS.map((item) =>
                  item.external ? (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeMobileNav}
                      className="elite-link-item flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs text-foreground/90"
                    >
                      <span>{item.label}</span>
                      <ExternalLink className="size-3.5 opacity-60" />
                    </a>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={closeMobileNav}
                      className="elite-link-item block rounded-lg px-3 py-2.5 text-xs text-foreground/90"
                    >
                      {item.label}
                    </Link>
                  )
                )}
              </div>
            </DialogContent>
          </Dialog>

          {isConnected ? (
            <>
              <span
                className="hidden items-center gap-1.5 text-xs tabular-nums text-muted-foreground sm:flex"
                aria-label={
                  balanceLoading ? 'Loading balance' : `${formatBalanceAmount(balance)} HBAR balance`
                }
              >
                {balanceLoading ? (
                  <span className="size-3 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-transparent" />
                ) : (
                  <>
                    <span className="text-foreground/90">{formatBalanceAmount(balance)}</span>
                    <Image
                      src="/hedera-hbar-logo.svg"
                      alt=""
                      width={16}
                      height={16}
                      className="shrink-0 opacity-90"
                      aria-hidden
                    />
                  </>
                )}
              </span>

              <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="elite-link-item flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5 backdrop-blur-sm transition-colors hover:bg-white/[0.07]"
                    aria-label="Wallet menu"
                  >
                    <span className="elite-green-dot size-1.5 shrink-0 rounded-full" />
                    <span className="text-xs font-mono text-muted-foreground">
                      {accountId ? formatAddress(accountId, 4) : 'Connected'}
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="elite-dropdown min-w-[13rem] rounded-xl border-0 p-1"
                >
                  {accountId && (
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                      <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                        {accountId}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                          copied && 'text-primary'
                        )}
                        aria-label={copied ? 'Copied' : 'Copy address'}
                      >
                        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                  )}
                  <Link
                    href="/my-bets"
                    className={cn(
                      'elite-link-item mb-1 flex items-center rounded-md px-2.5 py-2 text-xs text-foreground/90 hover:text-foreground',
                      pathname.startsWith('/my-bets') && 'elite-nav-link-active text-foreground'
                    )}
                  >
                    My Bets
                  </Link>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => disconnect()}
                  >
                    <LogOut className="size-3.5" />
                    <span>Disconnect</span>
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <WalletSelector />
          )}
        </div>
      </div>
    </header>
  );
}
