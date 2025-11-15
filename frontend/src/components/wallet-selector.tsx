'use client';

import React, { useState } from 'react';
import { 
  useWallet, 
  useAccountId, 
  useBalance 
} from '@buidlerlabs/hashgraph-react-wallets';
import {
  HashpackConnector,
  MetamaskConnector,
  BladeConnector,
  KabilaConnector,
  HWCConnector,
} from '@buidlerlabs/hashgraph-react-wallets/connectors';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Wallet, ChevronDown, User, Copy, Check, Coins, Info } from 'lucide-react';
import { formatAddress } from '@/lib/utils';
import { AccountDetailsModal } from '@/components/account-details-modal';

type WalletType = 'hashpack' | 'metamask' | 'blade' | 'kabila' | 'walletconnect';

interface WalletOption {
  name: string;
  type: WalletType;
  icon: string;
  description: string;
  connector: any;
}

const walletOptions: WalletOption[] = [
  {
    name: 'HashPack',
    type: 'hashpack',
    icon: '🟣',
    description: 'Hedera native wallet',
    connector: HashpackConnector
  },
  {
    name: 'MetaMask',
    type: 'metamask',
    icon: '🦊',
    description: 'Ethereum wallet with Hedera support',
    connector: MetamaskConnector
  },
  {
    name: 'WalletConnect',
    type: 'walletconnect',
    icon: '🔗',
    description: 'Connect any wallet via QR code',
    connector: HWCConnector
  },
  {
    name: 'Blade',
    type: 'blade',
    icon: '⚔️',
    description: 'Hedera native wallet',
    connector: BladeConnector
  },
  {
    name: 'Kabila',
    type: 'kabila',
    icon: '🔗',
    description: 'Hedera wallet',
    connector: KabilaConnector
  }
];

export function WalletSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Use library's hooks directly
  const { isConnected, disconnect, connector } = useWallet();
  const { data: accountId } = useAccountId();
  const { data: balanceData, isLoading: balanceLoading } = useBalance({ autoFetch: isConnected });
  
  // Parse balance data
  const balance = React.useMemo(() => {
    if (!balanceData) return null;
    
    // Check if it's an object with hbars property
    if (typeof balanceData === 'object' && 'hbars' in balanceData) {
      return balanceData.hbars.toString();
    }
    
    // Check if it's an object with value property
    if (typeof balanceData === 'object' && 'value' in balanceData) {
      return balanceData.value.toString();
    }
    
    // Try direct conversion
    return balanceData.toString();
  }, [balanceData]);

  // Create wallet hooks for each connector
  const hashpackWallet = useWallet(HashpackConnector);
  const metamaskWallet = useWallet(MetamaskConnector);
  const bladeWallet = useWallet(BladeConnector);
  const kabilaWallet = useWallet(KabilaConnector);
  const walletConnectWallet = useWallet(HWCConnector);
  
  const wallets = {
    hashpack: hashpackWallet,
    metamask: metamaskWallet,
    blade: bladeWallet,
    kabila: kabilaWallet,
    walletconnect: walletConnectWallet,
  };
  
  const handleWalletSelect = async (walletOption: WalletOption) => {
    setIsOpen(false);
    
    try {
      const wallet = wallets[walletOption.type];
      await wallet.connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  const handleCopyAddress = async () => {
    if (accountId) {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Get current wallet type from connector
  const getWalletType = () => {
    if (!connector) return null;
    
    const constructorName = connector.constructor?.name?.toLowerCase() || '';
    
    if (constructorName.includes('hashpack')) return 'hashpack';
    if (constructorName.includes('metamask')) return 'metamask';
    if (constructorName.includes('blade')) return 'blade';
    if (constructorName.includes('kabila')) return 'kabila';
    if (constructorName.includes('hwc') || constructorName.includes('walletconnect')) return 'walletconnect';
    
    return null;
  };
  
  const currentWalletType = getWalletType();
  const currentWalletOption = walletOptions.find(w => w.type === currentWalletType);

  const formatBalance = (balance: string | null) => {
    if (!balance) return '0 HBAR';
    const numBalance = parseFloat(balance);
    if (numBalance >= 1000) {
      return `${(numBalance / 1000).toFixed(2)}k HBAR`;
    }
    return `${numBalance.toFixed(2)} HBAR`;
  };

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2">
        {/* Balance Display */}
        <Button
          variant="outline"
          size="sm"
          className="border-vibrant-purple text-vibrant-purple"
        >
          {balanceLoading ? (
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1">
              <Coins className="w-3 h-3" />
              <span className="text-xs">{formatBalance(balance)}</span>
            </div>
          )}
        </Button>

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
        
        {/* Account Info Button */}
        {accountId && (
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
        )}
        
        {/* Wallet Type Badge */}
        {currentWalletOption && (
          <Button
            variant="outline"
            size="sm"
            className="flex items-center space-x-2 border-vibrant-purple text-vibrant-purple"
          >
            <span className="text-sm">{currentWalletOption.icon}</span>
            <span className="text-xs font-medium">{currentWalletOption.name}</span>
          </Button>
        )}
        
        {/* Disconnect Button */}
        <Button onClick={handleDisconnect} variant="outline" size="sm">
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center space-x-2">
          <Wallet className="w-4 h-4" />
          <span>Connect Wallet</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose your wallet</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {walletOptions.map((wallet) => (
            <Button
              key={wallet.name}
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => handleWalletSelect(wallet)}
            >
              <div className="flex items-center space-x-3 w-full">
                <span className="text-2xl">{wallet.icon}</span>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{wallet.name}</span>
                  <span className="text-sm text-muted-foreground">{wallet.description}</span>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
