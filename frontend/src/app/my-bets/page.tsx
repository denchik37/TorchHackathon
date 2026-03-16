'use client';
import React, { useEffect, useState } from 'react';
import {
  useWallet,
  useEvmAddress,
  useWriteContract,
  useWatchTransactionReceipt,
} from '@buidlerlabs/hashgraph-react-wallets';
import { HashpackConnector } from '@buidlerlabs/hashgraph-react-wallets/connectors';
import { gql, useApolloClient } from '@apollo/client';

import { Bet } from '@/lib/types';
import TorchPredictionMarketABI from '../../../abi/TorchPredictionMarket.json';

import { Header } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { NoBetsContainer, BetCard, NoBetsCard } from '@/components/features/bets';
import { NoWalletConnectedContainer } from '@/components/features/wallet';
import { Loader2 } from 'lucide-react';

const GET_USER_BETS_PAGE_FIRST = gql`
  query GetUserBetsPageFirst($userId: String!, $pageSize: Int!) {
    bets(
      where: { user: $userId }
      first: $pageSize
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

const GET_USER_BETS_PAGE_AFTER = gql`
  query GetUserBetsPageAfter(
    $userId: String!
    $pageSize: Int!
    $cursorTimestamp: BigInt!
    $cursorId: ID!
  ) {
    bets(
      where: {
        user: $userId
        and: [
          {
            or: [
              { timestamp_lt: $cursorTimestamp }
              { and: [{ timestamp: $cursorTimestamp }, { id_lt: $cursorId }] }
            ]
          }
        ]
      }
      first: $pageSize
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
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);

  const { writeContract } = useWriteContract();
  const { watch } = useWatchTransactionReceipt();
  const apolloClient = useApolloClient();

  useEffect(() => {
    const fetchAllUserBets = async (userId: string) => {
      const pageSize = 1000;
      let all: Bet[] = [];
      let cursorTimestamp: string | null = null;
      let cursorId: string | null = null;

      // First page
      const firstPage = await apolloClient.query<{
        bets: any[];
      }>({
        query: GET_USER_BETS_PAGE_FIRST,
        variables: { userId, pageSize },
        fetchPolicy: 'network-only',
      });

      const normalize = (raw: any[]): Bet[] =>
        raw.map((b) => ({
          id: b.id,
          user: { id: userId, bets: [], totalBets: 0, totalStaked: 0, totalPayout: 0 },
          stake: Number(b.stake),
          priceMin: Number(b.priceMin),
          priceMax: Number(b.priceMax),
          timestamp: Number(b.timestamp),
          targetTimestamp: Number(b.targetTimestamp),
          payout: Number(b.payout),
          expectedPayout: Number(b.expectedPayout),
          claimed: Boolean(b.claimed),
          finalized: Boolean(b.finalized),
          won: Boolean(b.won),
          weight: 0,
          qualityBps: b.qualityBps != null ? Number(b.qualityBps) : undefined,
          bucket: Number(b.bucket),
          bucketRef: b.bucketRef
            ? {
                id: b.bucketRef.id,
                aggregationComplete: Boolean(b.bucketRef.aggregationComplete),
                nextProcessIndex: b.bucketRef.nextProcessIndex ?? undefined,
                totalBets: b.bucketRef.totalBets ?? undefined,
                totalWinningWeight: b.bucketRef.totalWinningWeight ?? undefined,
                totalStaked: b.bucketRef.totalStaked ?? undefined,
              }
            : undefined,
        }));

      let page = firstPage.data.bets;
      all = all.concat(normalize(page));

      while (page.length === pageSize) {
        const last = page[page.length - 1];
        cursorTimestamp = last.timestamp;
        cursorId = last.id;

        const nextPage = await apolloClient.query<{ bets: any[] }>({
          query: GET_USER_BETS_PAGE_AFTER,
          variables: {
            userId,
            pageSize,
            cursorTimestamp,
            cursorId,
          },
          fetchPolicy: 'network-only',
        });

        page = nextPage.data.bets;
        if (page.length === 0) break;
        all = all.concat(normalize(page));
      }

      setBets(all);
    };

    if (!evmAddress) {
      setBets([]);
      return;
    }

    setLoading(true);
    fetchAllUserBets(evmAddress.toLowerCase())
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch user bets', e);
        setBets([]);
      })
      .finally(() => setLoading(false));
  }, [apolloClient, evmAddress]);

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
          // refresh bets
          if (evmAddress) {
            // fire-and-forget; don't block UI
            (async () => {
              try {
                const userId = evmAddress.toLowerCase();
                const pageSize = 1000;
                let all: Bet[] = [];
                let cursorTimestamp: string | null = null;
                let cursorId: string | null = null;

                const normalize = (raw: any[]): Bet[] =>
                  raw.map((b) => ({
                    id: b.id,
                    user: { id: userId, bets: [], totalBets: 0, totalStaked: 0, totalPayout: 0 },
                    stake: Number(b.stake),
                    priceMin: Number(b.priceMin),
                    priceMax: Number(b.priceMax),
                    timestamp: Number(b.timestamp),
                    targetTimestamp: Number(b.targetTimestamp),
                    payout: Number(b.payout),
                    expectedPayout: Number(b.expectedPayout),
                    claimed: Boolean(b.claimed),
                    finalized: Boolean(b.finalized),
                    won: Boolean(b.won),
                    weight: 0,
                    qualityBps: b.qualityBps != null ? Number(b.qualityBps) : undefined,
                    bucket: Number(b.bucket),
                    bucketRef: b.bucketRef
                      ? {
                          id: b.bucketRef.id,
                          aggregationComplete: Boolean(b.bucketRef.aggregationComplete),
                          nextProcessIndex: b.bucketRef.nextProcessIndex ?? undefined,
                          totalBets: b.bucketRef.totalBets ?? undefined,
                          totalWinningWeight: b.bucketRef.totalWinningWeight ?? undefined,
                          totalStaked: b.bucketRef.totalStaked ?? undefined,
                        }
                      : undefined,
                  }));

                const firstPage = await apolloClient.query<{ bets: any[] }>({
                  query: GET_USER_BETS_PAGE_FIRST,
                  variables: { userId, pageSize },
                  fetchPolicy: 'network-only',
                });

                let page = firstPage.data.bets;
                all = all.concat(normalize(page));

                while (page.length === pageSize) {
                  const last = page[page.length - 1];
                  cursorTimestamp = last.timestamp;
                  cursorId = last.id;

                  const nextPage = await apolloClient.query<{ bets: any[] }>({
                    query: GET_USER_BETS_PAGE_AFTER,
                    variables: {
                      userId,
                      pageSize,
                      cursorTimestamp,
                      cursorId,
                    },
                    fetchPolicy: 'network-only',
                  });

                  page = nextPage.data.bets;
                  if (page.length === 0) break;
                  all = all.concat(normalize(page));
                }

                setBets(all);
              } catch (e) {
                // eslint-disable-next-line no-console
                console.error('Failed to refresh user bets after redeem', e);
              }
            })();
          }
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
