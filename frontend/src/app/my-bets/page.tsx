'use client';
import React, { useState } from 'react';
import {
  useWallet,
  useEvmAddress,
  useWriteContract,
  useWatchTransactionReceipt,
} from '@buidlerlabs/hashgraph-react-wallets';
import { HashpackConnector } from '@buidlerlabs/hashgraph-react-wallets/connectors';
import { ContractId } from '@hashgraph/sdk';
import { gql, useQuery } from '@apollo/client';

import { User, Bet } from '@/lib/types';
import TorchPredictionMarketABI from '../../../abi/TorchPredictionMarket.json';

import { Header } from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';

import NoBetsContainer from '@/components/no-bets-container';
import NoWalletConnectedContainer from '@/components/no-wallet-connected-container';
import { BetCard } from '@/components/bet-card';
import { NoBetsCard } from '@/components/no-bets-card';

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      bets {
        id
        won
        claimed
        finalized
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
  }
`;

type Data = {
  user: User;
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

  const { data, loading, refetch } = useQuery<Data>(GET_USER, {
    variables: { id: evmAddress },
  });

  const user = data?.user;
  const bets = user?.bets ?? [];

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
    <div className="min-h-screen bg-black">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {!isConnected ? (
          <NoWalletConnectedContainer />
        ) : (
          <>
            {!bets.length && !loading && <NoBetsContainer />}

            {bets.length > 0 && (
              <div className="max-w-lg mx-auto space-y-6">
                {/* Bet Categories */}
                <div className="flex space-x-2">
                  {categories.map((category) => {
                    const isActive = activeCategory === category.id;
                    const buttonClasses = isActive
                      ? 'bg-vibrant-purple text-white'
                      : 'bg-neutral-900 text-light-gray hover:bg-neutral-800 border border-neutral-800';

                    return (
                      <button
                        type="button"
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${buttonClasses}`}
                      >
                        {category.label}
                        <span className="ml-2 text-xs opacity-70">{category.count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Bet Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-neutral-950 border-neutral-800">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-light-gray">
                        {bets.length}
                      </div>
                      <div className="text-xs text-medium-gray">Total Bets</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-neutral-950 border-bright-green/20">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-bright-green">{wonBets.length}</div>
                      <div className="text-xs text-medium-gray">Won</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-neutral-950 border-red-500/20">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-red-500">{lostBets.length}</div>
                      <div className="text-xs text-medium-gray">Lost</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-neutral-950 border-vibrant-purple/20">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-vibrant-purple">
                        {bets.filter((bet) => !bet.finalized).length}
                      </div>
                      <div className="text-xs text-medium-gray">Active</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Bet Cards */}
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
