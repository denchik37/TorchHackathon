'use client';
import { useState } from 'react';
import {
  useWallet,
  useEvmAddress,
  useWriteContract,
  useWatchTransactionReceipt,
} from '@buidlerlabs/hashgraph-react-wallets';
import { HashpackConnector } from '@buidlerlabs/hashgraph-react-wallets/connectors';
import { gql, useQuery } from '@apollo/client';
import { CheckCircle, XCircle, Clock, Coins, Loader2 } from 'lucide-react';

import { User, Bet } from '@/lib/types';
import {
  formatDateUTC,
  getRemainingDaysBetweenTimestamps,
  formatTinybarsToHbar,
} from '@/lib/utils';
import TorchPredictionMarketABI from '../../../abi/TorchPredictionMarket.json';

import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import NoBetsContainer from '@/components/no-bets-container';
import NoWalletConnectedContainer from '@/components/no-wallet-connected-container';

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
        bucket {
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
  if (bet.won && !bet.claimed && bet.bucket?.aggregationComplete === true) return 'unredeemed';
  if (bet.won) return 'won';
  return 'lost';
};

const getStatusIcon = (bet: Bet) => {
  const status = getBetStatus(bet);
  switch (status) {
    case 'active':
      return <Clock className="w-4 h-4 text-vibrant-purple" />;
    case 'won':
      return <CheckCircle className="w-4 h-4 text-bright-green" />;
    case 'lost':
      return <XCircle className="w-4 h-4 text-medium-gray" />;
    case 'unredeemed':
      return <CheckCircle className="w-4 h-4 text-bright-green" />;
  }
};

const getStatusText = (bet: Bet) => {
  const status = getBetStatus(bet);
  switch (status) {
    case 'active':
      return 'Active';
    case 'won':
    case 'unredeemed':
      return 'Won';
    case 'lost':
      return 'Lost';
  }
};

export default function MyBetsPage() {
  const { data: evmAddress } = useEvmAddress();
  const { isConnected } = useWallet(HashpackConnector);
  const [activeCategory, setActiveCategory] = useState('all');
  const [redeemingBetId, setRedeemingBetId] = useState<string | null>(null);
  const [redeemingAll, setRedeemingAll] = useState(false);

  const { writeContract } = useWriteContract();
  const { watch } = useWatchTransactionReceipt();

  const { data, loading, refetch } = useQuery<Data>(GET_USER, {
    variables: { id: evmAddress },
  });

  const user = data?.user;
  const bets = user?.bets ?? [];

  const wonBets = bets.filter((bet) => bet.won);
  const lostBets = bets.filter((bet) => !bet.won && bet.finalized);
  const unredeemedBets = bets.filter((bet) => bet.finalized && !bet.claimed && bet.bucket?.aggregationComplete === true);
  const unredeemedAmount = unredeemedBets.reduce((sum, bet) => sum + bet.payout || 0, 0);

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
      count: bets.filter((bet) => bet.finalized).length,
    },
  ];

  const filteredBets = bets.filter((bet) => {
    const status = getBetStatus(bet);
    return activeCategory === 'all' || status === activeCategory;
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
          console.log(`Successfully redeemed bet ${betId}`);
          refetch();
          setRedeemingBetId(null);
          return transaction;
        },
        onError: (receipt, error) => {
          console.error(`Failed to redeem bet ${betId}:`, error);
          setRedeemingBetId(null);
          return receipt;
        },
      });
    } catch (error) {
      console.error('Error redeeming bet:', error);
      setRedeemingBetId(null);
    }
  };

  // Redeem all unclaimed bets
  const redeemAll = async () => {
    try {
      setRedeemingAll(true);

      // Process each unredeemed bet that is won
      const unredeemedWonBets = bets.filter((bet) => bet.finalized && !bet.claimed && bet.won && bet.bucket?.aggregationComplete === true);

      let processedCount = 0;
      let errorCount = 0;

      for (const bet of unredeemedWonBets) {
        try {
          const txId = await writeContract({
            contractId: process.env.NEXT_PUBLIC_CONTRACT_ID!,
            abi: TorchPredictionMarketABI.abi,
            functionName: 'claimBet',
            args: [bet.id],
          });

          watch(txId as string, {
            onSuccess: (transaction) => {
              processedCount++;
              console.log(
                `Successfully redeemed bet ${bet.id} (${processedCount}/${unredeemedWonBets.length})`
              );

              // Check if all bets have been processed
              if (processedCount + errorCount === unredeemedWonBets.length) {
                console.log('Finished redeeming all bets');
                refetch();
                setRedeemingAll(false);
              }
              return transaction;
            },
            onError: (receipt, error) => {
              errorCount++;
              console.error(`Failed to redeem bet ${bet.id}:`, error);

              // Check if all bets have been processed
              if (processedCount + errorCount === unredeemedWonBets.length) {
                console.log('Finished redeeming all bets with some errors');
                refetch();
                setRedeemingAll(false);
              }
              return receipt;
            },
          });
        } catch (error) {
          errorCount++;
          console.error(`Failed to submit redeem for bet ${bet.id}:`, error);

          if (processedCount + errorCount === unredeemedWonBets.length) {
            refetch();
            setRedeemingAll(false);
          }
        }
      }

      // If there are no bets to redeem
      if (unredeemedWonBets.length === 0) {
        console.log('No bets to redeem');
        setRedeemingAll(false);
      }
    } catch (error) {
      console.error('Error redeeming all bets:', error);
      setRedeemingAll(false);
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
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Bet Categories */}
                <div className="flex space-x-2">
                  {categories.map((category) => (
                    <button
                      type="button"
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeCategory === category.id
                          ? 'bg-vibrant-purple text-white'
                          : 'bg-neutral-900 text-light-gray hover:bg-neutral-800 border border-neutral-800'
                      }`}
                    >
                      {category.label}
                      <span className="ml-2 text-xs opacity-70">{category.count}</span>
                    </button>
                  ))}
                </div>

                {/* Bet Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-neutral-950 border-neutral-800">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-light-gray">{bets.length}</div>
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

                {/* Unredeemed Winnings */}
                {unredeemedAmount > 0 && (
                  <Card className="bg-bright-green/10 border-bright-green/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-bright-green/20 rounded-lg flex items-center justify-center">
                            <Coins className="w-6 h-6 text-bright-green" />
                          </div>
                          <div>
                            <div className="text-sm text-medium-gray">Unredeemed Winnings</div>
                            <div className="text-2xl font-bold text-bright-green">
                              {formatTinybarsToHbar(unredeemedAmount, 2)} HBAR
                            </div>
                          </div>
                        </div>
                        <Button
                          className="bg-bright-green hover:bg-bright-green/90 text-black font-semibold"
                          onClick={redeemAll}
                          disabled={redeemingAll}
                        >
                          {redeemingAll ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Redeeming...
                            </>
                          ) : (
                            'Redeem All'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bet Cards */}
                <div className="space-y-4">
                  {filteredBets.length === 0 ? (
                    <Card className="bg-neutral-950 border-neutral-800">
                      <CardContent className="p-12 text-center">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center">
                            <Clock className="w-8 h-8 text-medium-gray" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-lg font-medium text-light-gray">No bets found</h3>
                            <p className="text-sm text-medium-gray">
                              {activeCategory === 'active' &&
                                'You have no active bets at the moment'}
                              {activeCategory === 'unredeemed' &&
                                'All your winnings have been redeemed'}
                              {activeCategory === 'complete' && 'You have no completed bets'}
                              {activeCategory === 'all' && 'No bets match the current filter'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredBets.map((bet) => {
                      const status = getBetStatus(bet);
                      const remainingDays = getRemainingDaysBetweenTimestamps(
                        bet.timestamp,
                        bet.targetTimestamp
                      );

                      return (
                        <Card key={bet.id} className="bg-neutral-950 border-neutral-800">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                {getStatusIcon(bet)}
                                <span
                                  className={`text-sm font-semibold ${
                                    status === 'won' || status === 'unredeemed'
                                      ? 'text-bright-green'
                                      : status === 'lost'
                                        ? 'text-red-500'
                                        : 'text-vibrant-purple'
                                  }`}
                                >
                                  {getStatusText(bet)}
                                </span>
                              </div>
                              <div className="text-sm text-medium-gray">
                                {formatDateUTC(bet.targetTimestamp)}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Left side - Bet details */}
                              <div className="space-y-4">
                                <div>
                                  <span className="text-xs text-medium-gray">Price Range</span>
                                  <div className="text-light-gray font-mono">
                                    ${formatTinybarsToHbar(bet.priceMin, 4)} - $
                                    {formatTinybarsToHbar(bet.priceMax, 4)}
                                  </div>
                                </div>

                                <div>
                                  <span className="text-xs text-medium-gray">Amount Bet</span>
                                  <div className="text-light-gray font-mono">
                                    {formatTinybarsToHbar(bet.stake, 2)} HBAR
                                  </div>
                                </div>

                                {(bet.payout || !bet.finalized) && (
                                  <div>
                                    <span className="text-xs text-medium-gray">
                                      {status === 'won' || status === 'unredeemed'
                                        ? 'Payout'
                                        : 'Potential Payout'}
                                    </span>
                                    <div
                                      className={`font-mono font-semibold ${
                                        status === 'won' || status === 'unredeemed'
                                          ? 'text-bright-green'
                                          : 'text-light-gray'
                                      }`}
                                    >
                                      {bet.finalized
                                        ? formatTinybarsToHbar(bet.payout, 2)
                                        : formatTinybarsToHbar(
                                            Math.floor(
                                              Number(bet.stake) +
                                                (Number(bet.stake) * (bet.qualityBps || 0)) / 10000
                                            ),
                                            2
                                          )}{' '}
                                      HBAR
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right side - Status and actions */}
                              <div className="flex flex-col justify-between items-end">
                                {status === 'active' && remainingDays && (
                                  <div className="text-right">
                                    <div className="text-2xl font-bold text-light-gray">
                                      {remainingDays}
                                    </div>
                                    <div className="text-xs text-medium-gray">days remaining</div>
                                  </div>
                                )}

                                {status === 'won' && bet.claimed && (
                                  <div className="flex items-center space-x-1 text-bright-green">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-sm">Redeemed</span>
                                  </div>
                                )}

                                {status === 'unredeemed' && (
                                  <Button
                                    className="bg-bright-green hover:bg-bright-green/90 text-black font-semibold"
                                    onClick={() => redeemBet(bet.id)}
                                    disabled={redeemingBetId === bet.id}
                                  >
                                    {redeemingBetId === bet.id ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Redeeming...
                                      </>
                                    ) : (
                                      'Redeem'
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
                              <span className="text-xs text-medium-gray">
                                Placed: {formatDateUTC(bet.timestamp)}
                              </span>
                              <span className="text-xs text-medium-gray">
                                Bet ID: {bet.id.slice(0, 8)}...
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
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
