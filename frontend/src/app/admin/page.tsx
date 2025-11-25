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
import { Calendar, RefreshCw } from 'lucide-react';

import type { Bet } from '@/lib/types';

import { formatDateUTC, formatTinybarsToHbar } from '@/lib/utils';
import { fetchHbarPriceAtTimestamp } from '@/lib/coingecko';

import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/useToast';
import { Toaster } from '@/components/ui/toaster';
import NoWalletConnectedContainer from '@/components/no-wallet-connected-container';
import TorchPredictionMarketABI from '../../../abi/TorchPredictionMarket.json';

const GET_BETS = gql`
  query GetAllIncompleteBets {
    bets(
      where: { bucketRef_: { aggregationComplete: false }, finalized: false }
      orderBy: bucket
      orderDirection: asc
      first: 1000
    ) {
      id
      stake
      priceMin
      priceMax
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

  // State management
  const [resolutionPrices, setResolutionPrices] = useState<[number, number][]>([]);
  const [manualPrices, setManualPrices] = useState<Map<number, string>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<string>('all');

  const { data, loading, refetch } = useQuery(GET_BETS, {
    skip: !isLoaded || !isSignedIn || !isAdmin,
  });

  // Get available buckets for filtering
  const availableBuckets: string[] = data?.bets
    ? Array.from(new Set<string>(data.bets.map((bet: Bet) => bet.bucket.toString()))).sort(
        (a, b) => Number(a) - Number(b)
      )
    : [];

  // Filter bets by selected bucket
  const filteredBets = data?.bets
    ? selectedBucket === 'all'
      ? data.bets
      : data.bets.filter((bet: Bet) => bet.bucket.toString() === selectedBucket)
    : [];

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
    setIsSubmitting(true);
    try {
      // Determine which bets to process based on selected bucket
      const betsToProcess = selectedBucket === 'all' ? data.bets : filteredBets;

      if (!betsToProcess || betsToProcess.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No bets to process',
          description: 'Please select a bucket with bets.',
        });
        setIsSubmitting(false);
        return;
      }

      // Get unique buckets from the bets we're processing
      const bucketsToProcess = Array.from(new Set(betsToProcess.map((bet: Bet) => bet.bucket)));

      // For each bucket, we need ALL bets in that bucket (not just visible ones)
      const allBetsInBuckets = data.bets.filter((bet: Bet) =>
        bucketsToProcess.includes(bet.bucket)
      );

      // Get unique timestamps from ALL bets in the buckets being processed
      const uniqueTimestamps = Array.from(
        new Set(allBetsInBuckets.map((bet: Bet) => bet.targetTimestamp))
      );

      // Filter timestamps that have prices
      const timestampsWithPrices = uniqueTimestamps
        .filter((ts) => getFinalPrice(ts as number) !== null)
        .sort((a, b) => (a as number) - (b as number));

      if (timestampsWithPrices.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No prices to submit',
          description: 'Please enter prices for the bets.',
        });
        setIsSubmitting(false);
        return;
      }

      // Check if all bet timestamps have prices
      const timestampsWithoutPrices = uniqueTimestamps.filter(
        (ts) => getFinalPrice(ts as number) === null
      );

      if (timestampsWithoutPrices.length > 0) {
        const betsWithoutPrices = allBetsInBuckets.filter((bet: Bet) =>
          timestampsWithoutPrices.includes(bet.targetTimestamp)
        );
        console.log('Bets missing prices:', betsWithoutPrices);

        const missingInfo = betsWithoutPrices
          .map(
            (bet: Bet) =>
              `Bet ${bet.id} (Bucket ${bet.bucket}, ${new Date(bet.targetTimestamp * 1000).toLocaleString()})`
          )
          .join(', ');

        toast({
          variant: 'destructive',
          title: 'Missing prices',
          description: `Cannot proceed - prices missing for: ${missingInfo}`,
        });
        setIsSubmitting(false);
        return;
      }

      const timestamps = timestampsWithPrices;
      const prices = timestampsWithPrices.map((ts) => {
        const price = getFinalPrice(ts as number)!;
        // Convert to contract format (price in tinybars, 8 decimals)
        return parseUnits(price.toFixed(8), 8).toString();
      });

      // Process only the buckets that contain our selected bets
      const uniqueBuckets = bucketsToProcess;

      toast({
        variant: 'default',
        title: 'Submitting prices...',
        description: `Preparing to submit ${timestampsWithPrices.length} prices`,
      });

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

      toast({
        variant: 'default',
        title: 'Waiting for price transaction...',
        description: 'Please confirm in your wallet',
      });

      // Watch the setPrices transaction
      watch(setPricesResult as string, {
        onSuccess: (transaction) => {
          toast({
            variant: 'success',
            title: 'Prices submitted!',
            description: `Successfully submitted ${timestampsWithPrices.length} prices. Starting batch processing...`,
          });

          // Process batches after price submission succeeds
          const processBatches = async () => {
            try {
              toast({
                variant: 'default',
                title: 'Processing batches...',
                description: `Found ${uniqueBuckets.length} bucket(s) to process`,
              });

              // Process each unique bucket after price submission succeeds
              for (const bucketIndex of uniqueBuckets) {
                toast({
                  variant: 'default',
                  title: `Processing bucket ${bucketIndex}...`,
                  description: 'Please confirm in your wallet',
                });

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
                    toast({
                      variant: 'success',
                      title: `Bucket ${bucketIndex} processed!`,
                      description: 'Successfully processed batch',
                    });
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

              toast({
                variant: 'success',
                title: 'All operations completed!',
                description: `Successfully submitted ${timestampsWithPrices.length} price${timestampsWithPrices.length === 1 ? '' : 's'} and initiated processing for ${uniqueBuckets.length} bucket${uniqueBuckets.length === 1 ? '' : 's'}.`,
              });

              setManualPrices(new Map());
              setIsSubmitting(false);
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
              {/* Bucket Navigation */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-torch-purple" />
                  <h2 className="text-lg font-semibold text-white">Bet Resolution by Bucket</h2>
                </div>

                {/* Bucket Filter */}
                <div className="flex items-center gap-2">
                  <label htmlFor="bucket-filter" className="text-sm text-gray-400">
                    Filter by bucket:
                  </label>
                  <select
                    id="bucket-filter"
                    value={selectedBucket}
                    onChange={(e) => setSelectedBucket(e.target.value)}
                    className="px-3 py-1.5 bg-neutral-800 border border-white/20 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-torch-purple"
                  >
                    <option value="all">All Buckets</option>
                    {availableBuckets.map((bucket: string) => (
                      <option key={bucket} value={bucket}>
                        Bucket {bucket}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stats and Actions */}
              <div className="flex items-center gap-4">
                {filteredBets && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400">
                      {selectedBucket === 'all' ? 'Total' : 'Filtered'} bets:
                      <span className="text-white font-medium ml-1">{filteredBets.length}</span>
                    </span>
                    <div className="w-px h-4 bg-gray-600" />
                    <span className="text-gray-400">
                      Unique times:{' '}
                      <span className="text-white font-medium">
                        {
                          Array.from(new Set(filteredBets.map((b: Bet) => b.targetTimestamp)))
                            .length
                        }
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

            {/* Selected Bucket Display */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-sm text-gray-400">
                {selectedBucket === 'all'
                  ? 'Showing all incomplete bets across all buckets'
                  : `Showing bets from bucket ${selectedBucket}`}
                {filteredBets.length > 0 && (
                  <span className="ml-2 text-white font-medium">
                    ({filteredBets.length} bet{filteredBets.length !== 1 ? 's' : ''})
                  </span>
                )}
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
                    <th className="text-left py-3 px-4 font-medium text-medium-gray">Bet ID</th>
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
                      <td colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="w-8 h-8 border-2 border-torch-purple border-t-transparent rounded-full animate-spin" />
                          <p className="text-medium-gray">Loading bets...</p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && (!filteredBets || filteredBets.length === 0) && (
                    <tr>
                      <td colSpan={7} className="text-center py-12">
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
                              {selectedBucket === 'all'
                                ? 'No incomplete bets found in any buckets'
                                : `No bets found in bucket ${selectedBucket}`}
                            </p>
                            {selectedBucket !== 'all' && (
                              <p className="text-medium-gray text-sm">
                                Try selecting a different bucket or "All Buckets"
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filteredBets?.map((bet: Bet) => {
                      const finalPrice = getFinalPrice(bet.targetTimestamp);
                      const fetchedPrice = findClosestPrice(bet.targetTimestamp);
                      const isManual = manualPrices.has(bet.targetTimestamp);
                      const priceMin = parseFloat(formatTinybarsToHbar(bet.priceMin));
                      const priceMax = parseFloat(formatTinybarsToHbar(bet.priceMax));
                      const isInRange =
                        finalPrice !== null && finalPrice >= priceMin && finalPrice <= priceMax;
                      return (
                        <tr key={bet.id} className="border-b border-white/5 hover:bg-dark-slate/50">
                          <td className="py-3 px-4 text-sm text-light-gray font-mono">{bet.id}</td>
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
            {filteredBets && filteredBets.length > 0 && (
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
