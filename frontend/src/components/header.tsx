'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ExternalLink,
  Wallet,
  Settings,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Copy,
  Check,
  User,
  Coins,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';

import { formatAddress } from '@/lib/utils';
import { WalletSelector } from '@/components/wallet-selector';
import { AccountDetailsModal } from '@/components/account-details-modal';
import { useWallet, useBalance, useAccountId } from '@buidlerlabs/hashgraph-react-wallets';

export function Header() {
  const { isConnected, disconnect } = useWallet();
  const { data: balanceData, isLoading: balanceLoading } = useBalance({ autoFetch: isConnected });
  const { data: accountId } = useAccountId();
  
  // Handle different possible balance data structures
  const balance = React.useMemo(() => {
    if (!balanceData) return 0;
    
    // Check if it's an object with hbars property
    if (typeof balanceData === 'object' && 'hbars' in balanceData) {
      return parseFloat(balanceData.hbars.toString());
    }
    
    // Check if it's an object with value property
    if (typeof balanceData === 'object' && 'value' in balanceData) {
      return parseFloat(balanceData.value.toString());
    }
    
    // Try direct conversion
    return parseFloat(balanceData.toString());
  }, [balanceData]);

  const [copied, setCopied] = React.useState(false);

  const handleCopyAddress = async () => {
    if (accountId) {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatBalance = (balance: number) => {
    if (!balance) return '0 HBAR';
    if (balance >= 1000) {
      return `${(balance / 1000).toFixed(2)}k HBAR`;
    }
    return `${balance.toFixed(2)} HBAR`;
  };

  return (
    <header className="border-b border-border bg-neutral-950 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left side - Logo and Website link */}
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/logo.svg" alt="Logo" width={40} height={40} />
            <span className="text-xl font-bold text-light-gray">Torch</span>
          </Link>
          <Button asChild size="sm" variant="link">
            <a href="https://torch.bet/" target="_blank" rel="noopener noreferrer">
              Website
              <ExternalLink className="w-4 h-4 ml-1" />
            </a>
          </Button>
        </div>

        {/* Right side - Navigation and Wallet */}
        <div className="flex items-center space-x-4">
          <Link href="/my-bets">
            <Button variant="ghost" size="sm">
              <Wallet className="w-4 h-4 mr-2" />
              My bets
            </Button>
          </Link>

          {/* <Link href="/hashpack-test">
            <Button variant="ghost" size="sm">
              <User className="w-4 h-4 mr-2" />
              Wallet Test
            </Button>
          </Link> */}

          {isConnected ? (
            <>
              {/* Balance Display */}
              <div className="flex items-center space-x-2">
                {/* <span className="text-sm font-medium text-light-gray">Balance</span> */}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-vibrant-purple text-vibrant-purple hover:bg-vibrant-purple hover:text-white"
                >
                  {balanceLoading ? (
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      <span>Loading...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <Coins className="w-3 h-3" />
                      <span>{formatBalance(balance)}</span>
                    </div>
                  )}
                </Button>
              </div>

              {/* Account Details Modal */}
              <AccountDetailsModal>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2 bg-neutral-800 border-neutral-700 text-light-gray hover:bg-neutral-700"
                >
                  <Info className="w-3 h-3" />
                  <span className="text-xs">Details</span>
                </Button>
              </AccountDetailsModal>

              {/* Wallet Address Button */}
              {accountId && (
                <Tooltip content={`${accountId} (Click to copy)`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2 bg-neutral-800 border-neutral-700 text-light-gray hover:bg-neutral-700"
                    onClick={handleCopyAddress}
                  >
                    <User className="w-3 h-3" />
                    <span className="text-xs font-mono">{formatAddress(accountId, 4)}</span>
                    {copied && <Check className="w-3 h-3 text-green-400" />}
                  </Button>
                </Tooltip>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 text-light-gray">
                    <div className="w-8 h-8 bg-vibrant-purple rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    <span className="text-sm font-medium">Connected</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => disconnect()}>
                    Disconnect
                  </DropdownMenuItem>
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
