'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useWallet, useAccountId, useBalance } from '@buidlerlabs/hashgraph-react-wallets';
import {
  HashpackConnector,
  MetamaskConnector,
  BladeConnector,
  KabilaConnector,
  HWCConnector,
} from '@buidlerlabs/hashgraph-react-wallets/connectors';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Wallet, ChevronDown, Copy, Check, Coins } from 'lucide-react';
import { formatAddress } from '@/lib/utils';
import { walletSelectorStyles } from './WalletSelector.styles';

export type WalletType = 'hashpack' | 'metamask' | 'blade' | 'kabila' | 'walletconnect';

export interface WalletOption {
  name: string;
  type: WalletType;
  icon: string;
  description: string;
  connector: unknown;
}

const walletOptions: WalletOption[] = [
  { name: 'HashPack', type: 'hashpack', icon: '🟣', description: 'Hedera native wallet', connector: HashpackConnector },
  { name: 'MetaMask', type: 'metamask', icon: '🦊', description: 'Ethereum wallet with Hedera support', connector: MetamaskConnector },
  { name: 'WalletConnect', type: 'walletconnect', icon: '🔗', description: 'Connect any wallet via QR code', connector: HWCConnector },
  { name: 'Blade', type: 'blade', icon: '⚔️', description: 'Hedera native wallet', connector: BladeConnector },
  { name: 'Kabila', type: 'kabila', icon: '🔗', description: 'Hedera wallet', connector: KabilaConnector },
];

export function WalletSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { isConnected, disconnect, connector } = useWallet();
  const { data: accountId } = useAccountId();
  const { data: balanceData, isLoading: balanceLoading } = useBalance({ autoFetch: isConnected });

  const balance = useMemo(() => {
    if (!balanceData) return null;
    if (typeof balanceData === 'object' && 'hbars' in balanceData) return balanceData.hbars.toString();
    if (typeof balanceData === 'object' && 'value' in balanceData) return balanceData.value.toString();
    return balanceData.toString();
  }, [balanceData]);

  const hashpackWallet = useWallet(HashpackConnector);
  const metamaskWallet = useWallet(MetamaskConnector);
  const bladeWallet = useWallet(BladeConnector);
  const kabilaWallet = useWallet(KabilaConnector);
  const walletConnectWallet = useWallet(HWCConnector);

  const wallets = useMemo(
    () => ({
      hashpack: hashpackWallet,
      metamask: metamaskWallet,
      blade: bladeWallet,
      kabila: kabilaWallet,
      walletconnect: walletConnectWallet,
    }),
    [hashpackWallet, metamaskWallet, bladeWallet, kabilaWallet, walletConnectWallet]
  );

  const handleWalletSelect = useCallback(
    async (walletOption: WalletOption) => {
      setIsOpen(false);
      try {
        const wallet = wallets[walletOption.type];
        await wallet.connect();
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    },
    [wallets]
  );

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  }, [disconnect]);

  const handleCopyAddress = useCallback(async () => {
    if (accountId) {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [accountId]);

  const getWalletType = useCallback((): WalletType | null => {
    if (!connector) return null;
    const name = connector.constructor?.name?.toLowerCase() || '';
    if (name.includes('hashpack')) return 'hashpack';
    if (name.includes('metamask')) return 'metamask';
    if (name.includes('blade')) return 'blade';
    if (name.includes('kabila')) return 'kabila';
    if (name.includes('hwc') || name.includes('walletconnect')) return 'walletconnect';
    return null;
  }, [connector]);

  const currentWalletType = getWalletType();
  const currentWalletOption = walletOptions.find((w) => w.type === currentWalletType);

  const formatBalance = useCallback((bal: string | null) => {
    if (!bal) return '0 HBAR';
    const num = parseFloat(bal);
    if (num >= 1000) return `${(num / 1000).toFixed(2)}k HBAR`;
    return `${num.toFixed(2)} HBAR`;
  }, []);

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <div className={walletSelectorStyles.balanceButton + ' inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs'}>
          {balanceLoading ? (
            <div className={walletSelectorStyles.spinner} />
          ) : (
            <Coins className="w-3.5 h-3.5 text-primary" />
          )}
          <span className="tabular-nums">{balanceLoading ? '…' : formatBalance(balance)}</span>
        </div>

        {accountId && (
          <button
            type="button"
            onClick={handleCopyAddress}
            className={walletSelectorStyles.addressButton + ' inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-mono'}
          >
            <span>{formatAddress(accountId, 4)}</span>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}

        {currentWalletOption && (
          <span className={walletSelectorStyles.walletBadge + ' inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium'}>
            <span>{currentWalletOption.icon}</span>
            <span>{currentWalletOption.name}</span>
          </span>
        )}

        <button
          type="button"
          onClick={handleDisconnect}
          className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button type="button" className={walletSelectorStyles.trigger}>
          <Wallet className="w-4 h-4" />
          <span>Connect Wallet</span>
          <ChevronDown className="w-4 h-4 opacity-70" />
        </button>
      </DialogTrigger>
      <DialogContent className={walletSelectorStyles.dialogContent}>
        <DialogHeader className={walletSelectorStyles.dialogHeader}>
          <DialogTitle className={walletSelectorStyles.dialogTitle}>
            Choose your wallet
          </DialogTitle>
        </DialogHeader>
        <div className={walletSelectorStyles.optionsList}>
          {walletOptions.map((wallet) => (
            <button
              type="button"
              key={wallet.name}
              className={walletSelectorStyles.optionButton}
              onClick={() => handleWalletSelect(wallet)}
            >
              <div className={walletSelectorStyles.optionIcon}>{wallet.icon}</div>
              <div className={walletSelectorStyles.optionContent}>
                <span className={walletSelectorStyles.optionName}>{wallet.name}</span>
                <span className={walletSelectorStyles.optionDesc}>{wallet.description}</span>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
