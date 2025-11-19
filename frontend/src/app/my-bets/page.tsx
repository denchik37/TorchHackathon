'use client';
import React, { useState, useEffect } from 'react';
import {
  useWallet,
  useEvmAddress,
  useWriteContract,
  useWatchTransactionReceipt,
  useReadContract,
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

const getActualBetStatus = (bet: any, field: 'finalized' | 'won' | 'claimed') => {
  return bet.contractData?.[field] ?? bet[field];
};

const getBetStatus = (bet: Bet): 'active' | 'won' | 'lost' | 'unredeemed' => {
  // Use contract data if available, otherwise fall back to subgraph data
  const finalized = getActualBetStatus(bet, 'finalized');
  const won = getActualBetStatus(bet, 'won');
  const claimed = getActualBetStatus(bet, 'claimed');

  if (!finalized) return 'active';
  if (won && !claimed && bet.bucketRef?.aggregationComplete === true) return 'unredeemed';
  if (won) return 'won';
  return 'lost';
};

export default function MyBetsPage() {
  const { data: evmAddress } = useEvmAddress();
  const { isConnected } = useWallet(HashpackConnector);
  const [activeCategory, setActiveCategory] = useState('all');
  const [redeemingBetId, setRedeemingBetId] = useState<string | null>(null);
  const [contractBetData, setContractBetData] = useState<Record<string, any>>({});

  const { writeContract } = useWriteContract();
  const { readContract } = useReadContract();
  const { watch } = useWatchTransactionReceipt();

  // Fetch bet data from smart contract
  const fetchBetFromContract = async (betId: string) => {
    try {
      const contractId = ContractId.fromString(process.env.NEXT_PUBLIC_CONTRACT_ID!);
      const contractData = await readContract({
        address: `0x${contractId.toSolidityAddress()}`,
        abi: TorchPredictionMarketABI.abi,
        functionName: 'getBet',
        args: [betId],
      });

      console.log(`Fetched bet ${betId} from contract:`, contractData);

      setContractBetData((prev) => ({
        ...prev,
        [betId]: contractData,
      }));

      return contractData;
    } catch (error) {
      console.error(`Error fetching bet ${betId} from contract:`, error);
      return null;
    }
  };

  const { data, loading, refetch } = useQuery<Data>(GET_USER, {
    variables: { id: evmAddress },
  });

  const user = data?.user;
  const bets = user?.bets ?? [];

  // Fetch all bet data from contracts when bets change
  useEffect(() => {
    if (bets.length > 0) {
      bets.forEach((bet) => {
        console.log('Checking bet for contract fetch:', bet);
        if (!contractBetData[bet.id]) {
          fetchBetFromContract(bet.id);
        }
      });
    }
  }, [bets]);

  // Create enhanced bets with contract data
  const enhancedBets = bets.map((bet) => ({
    ...bet,
    contractData: contractBetData[bet.id],
  }));

  const wonBets = enhancedBets.filter((bet) => {
    return getActualBetStatus(bet, 'won');
  });

  const lostBets = enhancedBets.filter((bet) => {
    return !getActualBetStatus(bet, 'won') && getActualBetStatus(bet, 'finalized');
  });

  const unredeemedBets = enhancedBets.filter((bet) => {
    return (
      getActualBetStatus(bet, 'finalized') &&
      !getActualBetStatus(bet, 'claimed') &&
      bet.bucketRef?.aggregationComplete === true
    );
  });

  const categories = [
    { id: 'all', label: 'All Bets', count: enhancedBets.length },
    {
      id: 'active',
      label: 'Active',
      count: enhancedBets.filter((bet) => !getActualBetStatus(bet, 'finalized')).length,
    },
    {
      id: 'unredeemed',
      label: 'Unredeemed',
      count: unredeemedBets.length,
    },
    {
      id: 'complete',
      label: 'Complete',
      count: enhancedBets.filter((bet) => getActualBetStatus(bet, 'finalized')).length,
    },
  ];

  const filteredBets = enhancedBets.filter((bet) => {
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
                        {enhancedBets.length}
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
                        {enhancedBets.filter((bet) => !getActualBetStatus(bet, 'finalized')).length}
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
