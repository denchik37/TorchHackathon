import { WalletSelector } from '@/components/wallet-selector';

export default function NoWalletConnectedPage() {
  return (
    <div className="mt-12 w-full items-center space-y-8 px-6 md:flex md:flex-col">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-text-high-em">
          Connect wallet to check your bets
        </h1>
        <p className="text-text-low-em">
          Click the button below to connect your wallet and check your bets or create new ones.
        </p>
      </div>

      <WalletSelector />
    </div>
  );
}
