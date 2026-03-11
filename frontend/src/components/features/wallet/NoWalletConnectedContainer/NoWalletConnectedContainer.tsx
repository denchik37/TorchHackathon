'use client';

import { WalletSelector } from '../WalletSelector';
import { noWalletConnectedStyles } from './NoWalletConnectedContainer.styles';

export default function NoWalletConnectedContainer() {
  return (
    <div className={noWalletConnectedStyles.root}>
      <div className={noWalletConnectedStyles.content}>
        <h1 className={noWalletConnectedStyles.title}>
          Connect wallet to check your bets
        </h1>
        <p className={noWalletConnectedStyles.description}>
          Click the button below to connect your wallet and check your bets or create new ones.
        </p>
      </div>
      <WalletSelector />
    </div>
  );
}
