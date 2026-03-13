'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, Wallet, ChevronDown, Copy, LogOut, Coins, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatAddress } from '@/lib/utils';
import { WalletSelector } from '@/components/features/wallet';
import { useWallet, useBalance, useAccountId } from '@buidlerlabs/hashgraph-react-wallets';
import { headerStyles } from './Header.styles';

export function Header() {
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
    <header className={headerStyles.root}>
      <div className={headerStyles.inner}>
        <div className={headerStyles.left}>
          <Link href="/" className={headerStyles.logoLink}>
            <Image src="/logo.svg" alt="Logo" width={40} height={40} />
            <span className={headerStyles.logoText}>Torch</span>
          </Link>
          <Button asChild size="sm" variant="link" className={headerStyles.navLink}>
            <a href="https://torch.bet/" target="_blank" rel="noopener noreferrer">
              Website
              <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
            </a>
          </Button>
        </div>

        <div className={headerStyles.right}>
          <Link href="/oracle" className={headerStyles.navLink + ' flex items-center gap-2 text-sm font-medium'}>
            <span className="hidden sm:inline">Oracle</span>
          </Link>
          <Link href="/my-bets" className={headerStyles.navLink + ' flex items-center gap-2 text-sm font-medium'}>
            <Wallet className="w-3.5 h-3.5 opacity-70" />
            <span className="hidden sm:inline">My bets</span>
          </Link>

          {isConnected ? (
            <div className="inline-flex">
              <div className={headerStyles.walletCapsuleBalance}>
                {balanceLoading ? (
                  <div className={headerStyles.spinner} />
                ) : (
                  <Coins className="w-3.5 h-3.5 text-primary" />
                )}
                <span className="tabular-nums">
                  {balanceLoading ? '…' : formatBalance(balance)}
                </span>
              </div>
              <div className={headerStyles.connectedTriggerWrap}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={headerStyles.connectedTrigger}
                      aria-label="Wallet menu"
                    >
                      <span className={headerStyles.connectedDot} />
                      <span className="hidden sm:inline">Connected</span>
                      <ChevronDown className="w-4 h-4 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={headerStyles.dropdownContent}>
                    {accountId && (
                      <div className={headerStyles.dropdownCopyRow}>
                        <span className={headerStyles.dropdownCopyAddress}>
                          {formatAddress(accountId, 4)}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyAddress}
                          className={headerStyles.dropdownCopyIcon + (copied ? ' ' + headerStyles.dropdownCopyIconCopied : '')}
                          aria-label={copied ? 'Copied' : 'Copy address'}
                        >
                          {copied ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className={headerStyles.dropdownItemDanger}
                      onClick={() => disconnect()}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Disconnect</span>
                    </button>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : (
            <WalletSelector />
          )}
        </div>
      </div>
    </header>
  );
}
