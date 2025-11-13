'use client';

import React, { ReactNode } from 'react';
import { HWBridgeProvider } from '@buidlerlabs/hashgraph-react-wallets';
import {
  HashpackConnector,
  BladeConnector,
  KabilaConnector,
  MetamaskConnector,
  HWCConnector,
} from '@buidlerlabs/hashgraph-react-wallets/connectors';
import { hederaMainnet } from '../config';
import { AppSkeleton } from '@/components/app-skeleton';

const connectors = [
  HashpackConnector,
  BladeConnector,
  KabilaConnector,
  MetamaskConnector,
  HWCConnector,
];

const metadata = {
  name: 'Torch - Crypto Prediction Market',
  description: 'Predict cryptocurrency token prices and earn rewards',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  icons: ['https://your-icon-url.com/icon.png'], // Replace with your actual icon URL
};

export default function ContextProvider({ children }: { children: ReactNode }) {
  return (
    <HWBridgeProvider
      metadata={metadata}
      projectId={process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || ''}
      connectors={connectors}
      chains={[hederaMainnet]}
      LoadingFallback={AppSkeleton}
    >
      {children}
    </HWBridgeProvider>
  );
}
