'use client';
import React, { useState } from 'react';
import {
  useWallet,
  useEvmAddress,
  useWriteContract,
  useWatchTransactionReceipt,
} from '@buidlerlabs/hashgraph-react-wallets';
import { HashpackConnector } from '@buidlerlabs/hashgraph-react-wallets/connectors';
import { gql, useQuery } from '@apollo/client';

import { Bet } from '@/lib/types';
import TorchPredictionMarketABI from '../../../abi/TorchPredictionMarket.json';

import { Header } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { NoBetsContainer, BetCard, NoBetsCard } from '@/components/features/bets';
import { NoWalletConnectedContainer } from '@/components/features/wallet';
import { Loader2 } from 'lucide-react';

const GET_USER_BETS = gql`
  query GetUserBets($userId: String!) {
    bets(
      where: { user: $userId }
      first: 1000
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      won
      claimed
      finalized
      expectedPayout
      payout
      stake
      priceMin
      priceMax
      qualityBps
      timestamp
      targetTimestamp
      bucket
      bucketRef {
        id
        aggregationComplete
      }
    }
  }
`;

type BetsData = {
  bets: Bet[];
};

const getBetStatus = (bet: Bet): 'active' | 'won' | 'lost' | 'unredeemed' => {
  if (!bet.finalized) return 'active';
  if (bet.won && !bet.claimed && bet.bucketRef?.aggregationComplete === true) return 'unredeemed';
  if (bet.won) return 'won';
  return 'lost';
};

export default function MyBetsPage() {
  const { data: evmAddress } = useEvmAddress();
  const { isConnected } = useWallet(HashpackConnector);
  const [activeCategory, setActiveCategory] = useState('all');
  const [redeemingBetId, setRedeemingBetId] = useState<string | null>(null);

  const { writeContract } = useWriteContract();
  const { watch } = useWatchTransactionReceipt();

  const { data, loading, refetch } = useQuery<BetsData>(GET_USER_BETS, {
    variables: { userId: evmAddress?.toLowerCase() },
    skip: !evmAddress,
  });

  const bets = data?.bets ?? [];

  const wonBets = bets.filter((bet) => {
    return bet.won;
  });

  const lostBets = bets.filter((bet) => {
    return !bet.won && bet.finalized;
  });

  const unredeemedBets = bets.filter((bet) => {
    return (
      bet.finalized &&
      bet.won &&
      !bet.claimed &&
      bet.bucketRef?.aggregationComplete === true
    );
  });

  const categories = [
    { id: 'all', label: 'All Bets', count: bets.length },
    {
      id: 'active',
      label: 'Active',
      count: bets.filter((bet) => !bet.finalized).length,
    },
    {
      id: 'unredeemed',
      label: 'Unredeemed',
      count: unredeemedBets.length,
    },
    {
      id: 'complete',
      label: 'Complete',
      count: bets.filter((bet) =>
        bet.finalized &&
        (!bet.won || bet.claimed)
      ).length,
    },
  ];

  const filteredBets = bets.filter((bet) => {
    const status = getBetStatus(bet);
    if (activeCategory === 'all') return true;
    if (activeCategory === 'complete') {
      return bet.finalized && (!bet.won || bet.claimed);
    }
    return status === activeCategory;
  });

  // Redeem individual bet
  const redeemBet = async (betId: string) => {
    try {
      setRedeemingBetId(betId);

      const txId = await writeContract({
        contractId: process.env.NEXT_PUBLIC_CONTRACT_ID!,
        abi: TorchPredictionMarketABI.abi,
        functionName: 'claimBet',
        args: [betId],
      });

      watch(txId as string, {
        onSuccess: (transaction) => {
          setRedeemingBetId(null);
          refetch();
          return transaction;
        },
        onError: (receipt, error) => {
          setRedeemingBetId(null);
          return receipt;
        },
      });
    } catch (error) {
      setRedeemingBetId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
        {!isConnected ? (
          <NoWalletConnectedContainer />
        ) : (
          <>
            {loading && (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {!bets.length && !loading && <NoBetsContainer />}

            {bets.length > 0 && (
              <div className="space-y-6">
                {/* Filter pills – glassy container, active tab purple + white text */}
                <div className="flex gap-1 p-1 rounded-xl bg-card/60 backdrop-blur-md border border-white/10 overflow-x-auto">
                  {categories.map((category) => {
                    const isActive = activeCategory === category.id;
                    return (
                      <button
                        type="button"
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {category.label}
                        <span className={`ml-2 text-xs ${isActive ? 'opacity-90' : 'opacity-80'}`}>{category.count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Summary cards – glassy */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="rounded-xl border border-white/10 bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-5">
                      <p className="text-2xl font-bold text-foreground tabular-nums">{bets.length}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">Total bets</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl border border-white/10 bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-5">
                      <p className="text-2xl font-bold text-destructive tabular-nums">{wonBets.length}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">Won</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl border border-white/10 bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-5">
                      <p className="text-2xl font-bold text-muted-foreground tabular-nums">{lostBets.length}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">Lost</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl border border-white/10 bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-5">
                      <p className="text-2xl font-bold text-primary tabular-nums">
                        {bets.filter((bet) => !bet.finalized).length}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">Active</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  {filteredBets.length === 0 ? (
                    <NoBetsCard activeCategory={activeCategory} />
                  ) : (
                    filteredBets.map((bet) => (
                      <BetCard
                        key={bet.id}
                        bet={bet}
                        onRedeem={redeemBet}
                        redeemingBetId={redeemingBetId}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
