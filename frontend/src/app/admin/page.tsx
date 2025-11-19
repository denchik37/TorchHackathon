'use client';

import { gql, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { ClerkProvider, SignInButton, SignOutButton, useUser } from '@clerk/nextjs';
import {
  useWallet,
  useWriteContract,
  useWatchTransactionReceipt,
} from '@buidlerlabs/hashgraph-react-wallets';
import { parseUnits } from 'ethers/lib/utils';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

import type { Bet } from '@/lib/types';

import { formatDateUTC, formatTinybarsToHbar } from '@/lib/utils';
import { fetchHbarPriceAtTimestamp, type CoinGeckoResponse } from '@/lib/coingecko';

import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/useToast';
import { Toaster } from '@/components/ui/toaster';
import NoWalletConnectedContainer from '@/components/no-wallet-connected-container';
import TorchPredictionMarketABI from '../../../abi/TorchPredictionMarket.json';

const GET_BETS = gql`
  query GetBetsForDate($startTime: Int!, $endTime: Int!) {
    bets(
      where: { targetTimestamp_gte: $startTime, targetTimestamp_lte: $endTime }
      orderBy: targetTimestamp
      orderDirection: asc
    ) {
      id
      stake
      priceMin
      priceMax
      timestamp
      targetTimestamp
      bucket
    }
  }
`;

export default function AdminPageWrapper() {
  return (
    <ClerkProvider>
      <AdminPage />
    </ClerkProvider>
  );
}

function AdminPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const isAdmin = user?.publicMetadata?.role === 'admin';

  // Wallet connection
  const { isConnected } = useWallet();
  const { writeContract } = useWriteContract();
  const { watch } = useWatchTransactionReceipt();

  // Toast notifications
  const { toast } = useToast();

  // Date selection - default to today
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [resolutionPrices, setResolutionPrices] = useState<[number, number][]>([]);
  const [manualPrices, setManualPrices] = useState<Map<number, string>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate date range for the selected day
  const getDateRange = () => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);

    return {
      startTime: Math.floor(start.getTime() / 1000),
      endTime: Math.floor(end.getTime() / 1000),
    };
  };

  const { startTime, endTime } = getDateRange();

  const { data, loading, refetch } = useQuery(GET_BETS, {
    variables: { startTime, endTime },
    skip: !isLoaded || !isSignedIn || !isAdmin,
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isAdmin || loading) return;
    if (!data?.bets || data.bets.length === 0) return;

    const fetchPrices = async () => {
      try {
        const timestamps = data.bets.map((bet: Bet) => bet.targetTimestamp);

        const start = Math.min(...timestamps);
        const end = Math.max(...timestamps);

        const { usd: prices } = await fetchHbarPriceAtTimestamp(start, end);

        setResolutionPrices(prices);
      } catch (err) {
        console.error('Error fetching prices:', err);
      }
    };

    fetchPrices();
  }, [isLoaded, loading, isSignedIn, isAdmin, data?.bets]);

  const findClosestPrice = (timestamp: number): number | null => {
    if (!resolutionPrices.length) return null;

    const targetMs = timestamp * 1000;
    let closest = resolutionPrices[0];
    let minDiff = Math.abs(targetMs - closest[0]);

    for (let i = 1; i < resolutionPrices.length; i++) {
      const [timestamp, price] = resolutionPrices[i];
      const diff = Math.abs(timestamp - targetMs);
      if (diff < minDiff) {
        closest = [timestamp, price];
        minDiff = diff;
      }
    }

    return closest?.[1] ?? null;
  };

  // Get final price (manual override or fetched)
  const getFinalPrice = (timestamp: number): number | null => {
    const manualPrice = manualPrices.get(timestamp);

    if (manualPrice !== undefined) {
      const parsed = parseFloat(manualPrice);
      return isNaN(parsed) ? null : parsed;
    }

    return findClosestPrice(timestamp);
  };

  // Handle manual price input
  const handlePriceChange = (timestamp: number, value: string) => {
    if (value === '') {
      setManualPrices((prev) => {
        const newMap = new Map(prev);
        newMap.delete(timestamp);
        return newMap;
      });
    } else {
      // Store the raw string value to preserve user input
      setManualPrices((prev) => new Map(prev).set(timestamp, value));
    }
  };

  // Submit prices to contract
  const submitPrices = async () => {
    if (!data?.bets) {
      alert('No bets data available');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get unique timestamps
      const uniqueTimestamps = Array.from(
        new Set(data.bets.map((bet: Bet) => bet.targetTimestamp))
      );

      // Filter timestamps that have prices
      const timestampsWithPrices = uniqueTimestamps
        .filter((ts) => getFinalPrice(ts as number) !== null)
        .sort((a, b) => (a as number) - (b as number));

      if (timestampsWithPrices.length === 0) {
        alert('No prices to submit');
        setIsSubmitting(false);
        return;
      }

      const timestamps = timestampsWithPrices;
      const prices = timestampsWithPrices.map((ts) => {
        const price = getFinalPrice(ts as number)!;
        // Convert to contract format (price in tinybars, 8 decimals)
        return parseUnits(price.toFixed(8), 8).toString();
      });

      // Get unique bucket indices from bets data
      const uniqueBuckets = Array.from(new Set(data.bets.map((bet: Bet) => bet.bucket)));

      // Submit prices first
      const setPricesResult = await writeContract({
        contractId: process.env.NEXT_PUBLIC_CONTRACT_ID!,
        abi: TorchPredictionMarketABI.abi,
        functionName: 'setPricesForTimestamps',
        args: [timestamps, prices],
        metaArgs: {
          gas: 3000000, // 0.3 HBAR gas limit for setting prices
        },
      });

      // Watch the setPrices transaction
      watch(setPricesResult as string, {
        onSuccess: (transaction) => {
          // Process batches after price submission succeeds
          const processBatches = async () => {
            try {
              // Process each unique bucket after price submission succeeds
              for (const bucketIndex of uniqueBuckets) {
                const processBatchResult = await writeContract({
                  contractId: process.env.NEXT_PUBLIC_CONTRACT_ID!,
                  abi: TorchPredictionMarketABI.abi,
                  functionName: 'processBatch',
                  args: [bucketIndex],
                  metaArgs: {
                    gas: 3000000, // 0.3 HBAR gas limit for batch processing
                  },
                });

                // Watch each processBatch transaction
                watch(processBatchResult as string, {
                  onSuccess: (batchTransaction) => {
                    return batchTransaction;
                  },
                  onError: (receipt, error) => {
                    console.error(`Error processing batch ${bucketIndex}:`, error);
                    toast({
                      variant: 'destructive',
                      title: `Failed to process batch ${bucketIndex}`,
                      description:
                        typeof error === 'string' ? error : 'An unexpected error occurred.',
                    });
                    return receipt;
                  },
                });
              }

              setManualPrices(new Map());
              setIsSubmitting(false);

              toast({
                variant: 'success',
                title: 'Prices submitted and batches processed!',
                description: `Successfully submitted ${timestampsWithPrices.length} price${timestampsWithPrices.length === 1 ? '' : 's'} and processed ${uniqueBuckets.length} bucket${uniqueBuckets.length === 1 ? '' : 's'}.`,
              });
            } catch (batchError) {
              console.error('Error processing batches:', batchError);
              setIsSubmitting(false);
              toast({
                variant: 'destructive',
                title: 'Prices submitted but batch processing failed',
                description:
                  batchError instanceof Error
                    ? batchError.message
                    : 'Failed to process some batches.',
              });
            }
          };

          processBatches();
          return transaction;
        },
        onError: (receipt, error) => {
          setIsSubmitting(false);
          console.error('Error submitting prices:', error);
          toast({
            variant: 'destructive',
            title: 'Failed to submit prices',
            description:
              typeof error === 'string'
                ? error
                : 'An unexpected error occurred while submitting prices.',
          });
          return receipt;
        },
      });
    } catch (err) {
      console.error('Error submitting prices:', err);
      setIsSubmitting(false);
      toast({
        variant: 'destructive',
        title: 'Failed to submit prices',
        description:
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while submitting prices.',
      });
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="flex flex-col items-center justify-center my-12 w-full space-y-2 ">
          <h1 className="text-2xl font-semibold text-text-high-em">Loading...</h1>
          <p className="text-text-low-em">Please wait while we check your access permissions.</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="flex flex-col items-center justify-center my-12 w-full space-y-2 ">
          <h1 className="text-2xl font-semibold text-text-high-em">
            You need to sign in to access the admin dashboard.
          </h1>
          <p className="text-text-low-em">
            Please sign in with an account that has admin privileges.
          </p>

          <Button variant="torch" className="w-48" asChild>
            <SignInButton />
          </Button>
        </div>
      </div>
    );
  }

  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-black">
        <Header />

        <div className="flex flex-col items-center justify-center my-12 w-full space-y-2 ">
          <h1 className="text-2xl font-semibold text-text-high-em">Access Denied</h1>
          <p className="text-text-low-em">
            You do not have permission to access the admin dashboard.
          </p>
          <Button variant="torch" className="w-48" asChild>
            <SignOutButton />
          </Button>
        </div>
      </div>
    );
  }

  // Check for wallet connection after admin check
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <NoWalletConnectedContainer />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Controls Card */}
        <Card className="bg-dark-slate/50 border-white/10">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Date Navigation */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-torch-purple" />
                  <h2 className="text-lg font-semibold text-white">Bet Resolution</h2>
                </div>

                <div className="flex items-center bg-neutral-800 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-neutral-700"
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() - 1);
                      setSelectedDate(newDate);
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <input
                    type="date"
                    value={selectedDate.toISOString().split('T')[0]}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    className="px-3 py-1.5 bg-transparent text-white text-sm font-medium cursor-pointer 
                             [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50
                             hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-neutral-700"
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() + 1);
                      setSelectedDate(newDate);
                    }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 hover:bg-white/5"
                  onClick={() => setSelectedDate(new Date())}
                >
                  Today
                </Button>
              </div>

              {/* Stats and Actions */}
              <div className="flex items-center gap-4">
                {data?.bets && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400">
                      Total bets: <span className="text-white font-medium">{data.bets.length}</span>
                    </span>
                    <div className="w-px h-4 bg-gray-600" />
                    <span className="text-gray-400">
                      Unique times:{' '}
                      <span className="text-white font-medium">
                        {Array.from(new Set(data.bets.map((b: Bet) => b.targetTimestamp))).length}
                      </span>
                    </span>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 hover:bg-white/5"
                  onClick={() => refetch()}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
            </div>

            {/* Selected Date Display */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-sm text-gray-400">
                Showing bets with target resolution date:
                <span className="ml-2 text-white font-medium">
                  {selectedDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
              <table className="min-w-[800px] w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">Bet Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">Min price</th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">Max price</th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">
                      Resolution Time (UTC)
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">
                      Resolution price
                    </th>
                  </tr>
                </thead>
                <tbody className="max-h-[600px] overflow-y-auto">
                  {loading && (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="w-8 h-8 border-2 border-torch-purple border-t-transparent rounded-full animate-spin" />
                          <p className="text-medium-gray">Loading bets...</p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && (!data?.bets || data.bets.length === 0) && (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center space-y-3">
                          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center">
                            <svg
                              className="w-8 h-8 text-medium-gray"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div className="space-y-1">
                            <p className="text-white font-medium">No bets found</p>
                            <p className="text-medium-gray text-sm">
                              No bets to resolve for{' '}
                              {selectedDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-medium-gray text-sm">
                              Try selecting a different date
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    data?.bets?.map((bet: Bet) => {
                      const finalPrice = getFinalPrice(bet.targetTimestamp);
                      const fetchedPrice = findClosestPrice(bet.targetTimestamp);
                      const isManual = manualPrices.has(bet.targetTimestamp);
                      const priceMin = parseFloat(formatTinybarsToHbar(bet.priceMin));
                      const priceMax = parseFloat(formatTinybarsToHbar(bet.priceMax));
                      const isInRange =
                        finalPrice !== null && finalPrice >= priceMin && finalPrice <= priceMax;
                      const key = `${bet.priceMin}-${bet.priceMax}-${bet.targetTimestamp}`;

                      return (
                        <tr key={key} className="border-b border-white/5 hover:bg-dark-slate/50">
                          <td className="py-3 px-4 text-sm text-light-gray">
                            {formatTinybarsToHbar(bet.stake)} HBAR
                          </td>
                          <td className="py-3 px-4">${priceMin.toFixed(4)}</td>
                          <td className="py-3 px-4 text-sm text-light-gray">
                            ${priceMax.toFixed(4)}
                          </td>
                          <td className="py-3 px-4 text-sm text-light-gray">
                            {formatDateUTC(bet.targetTimestamp)}
                          </td>
                          <td className="py-3 px-4 text-sm text-medium-gray">
                            {finalPrice !== null ? (
                              isInRange ? (
                                <span className="text-green-500">Win</span>
                              ) : (
                                <span className="text-red-500">Loss</span>
                              )
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                className={`w-32 px-2 py-1 bg-transparent border rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  isManual ? 'border-yellow-500' : 'border-gray-600'
                                }`}
                                placeholder="Enter price"
                                value={
                                  manualPrices.get(bet.targetTimestamp) ??
                                  (fetchedPrice !== null ? fetchedPrice.toFixed(4) : '')
                                }
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Allow only numbers, dots, and empty string (including leading zeros)
                                  if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                                    handlePriceChange(bet.targetTimestamp, value);
                                  }
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {data?.bets && data.bets.length > 0 && (
              <div className="flex justify-end mt-4">
                <Button
                  variant="torch"
                  className="w-48"
                  onClick={submitPrices}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Prices to Contract'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Toaster />
    </div>
  );
}
