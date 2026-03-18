'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronDown, Copy, LogOut, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatAddress } from '@/lib/utils';
import { WalletSelector } from '@/components/features/wallet';
import { useWallet, useBalance, useAccountId } from '@buidlerlabs/hashgraph-react-wallets';

const NAV_LINKS = [
  { label: 'Predict', href: '/' },
  { label: 'My Bets', href: '/my-bets' },
  { label: 'Oracle', href: '/oracle' },
] as const;

export function Header() {
  const pathname = usePathname();
  const { isConnected, disconnect } = useWallet();
  const { data: balanceData, isLoading: balanceLoading } = useBalance({ autoFetch: isConnected });
  const { data: accountId } = useAccountId();

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

  const handleCopyAddress = React.useCallback(async () => {
    if (accountId) {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [accountId]);

  const formatBalance = React.useCallback((bal: number) => {
    if (!bal) return '0 HBAR';
    if (bal >= 1000) return `${(bal / 1000).toFixed(2)}k HBAR`;
    return `${bal.toFixed(2)} HBAR`;
  }, []);

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: logo + nav tabs */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Torch" width={20} height={20} />
            <span className="text-sm font-semibold text-foreground">Torch</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-2.5 py-1 text-[13px] font-medium rounded-md transition-colors"
                  style={{
                    color: isActive ? 'hsl(0 0% 93%)' : 'hsl(0 0% 50%)',
                    background: isActive ? 'hsl(0 0% 11%)' : 'transparent',
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: wallet */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              {/* Balance */}
              <span className="hidden sm:flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                {balanceLoading ? (
                  <span className="size-3 border-2 border-muted-foreground/40 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>{formatBalance(balance)}</>
                )}
              </span>

              <span className="hidden sm:block h-3 w-px bg-border" />

              {/* Account pill with dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent transition-colors hover:bg-accent/80"
                    aria-label="Wallet menu"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground">
                      {accountId ? formatAddress(accountId, 4) : 'Connected'}
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[13rem] rounded-lg border border-border bg-popover p-1"
                >
                  {accountId && (
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                      <span className="font-mono text-xs text-muted-foreground truncate min-w-0">
                        {accountId}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className={cn(
                          'shrink-0 size-7 flex items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground',
                          copied && 'text-primary'
                        )}
                        aria-label={copied ? 'Copied' : 'Copy address'}
                      >
                        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 cursor-pointer px-2.5 py-2 text-sm text-destructive hover:bg-accent rounded transition-colors"
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
