'use client';

import React from 'react';
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

import { Header } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/useToast';
import { Toaster } from '@/components/ui/toaster';
import { NoWalletConnectedContainer } from '@/components/features/wallet';
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
        nextProcessIndex
        totalBets
        totalWinningWeight
        totalStaked
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
      console.log('=== DEBUG: Submitting prices ===');
      console.log('Timestamps:', timestamps);
      console.log('Prices:', prices);
      console.log('Buckets to process:', uniqueBuckets);

      const setPricesResult = await writeContract({
        contractId: process.env.NEXT_PUBLIC_CONTRACT_ID!,
        abi: TorchPredictionMarketABI.abi,
        functionName: 'setPricesForTimestamps',
        args: [timestamps, prices],
        metaArgs: {
          gas: 5000000, // Increased gas limit
        },
      });

      console.log('setPricesResult:', setPricesResult);

      toast({
        variant: 'default',
        title: 'Waiting for price transaction...',
        description: 'Please confirm in your wallet',
      });

      // Watch the setPrices transaction
      console.log('=== DEBUG: Watching setPrices transaction ===');
      watch(setPricesResult as string, {
        onSuccess: (transaction) => {
          console.log('=== DEBUG: setPrices SUCCESS ===');
          console.log('Transaction:', transaction);
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
                console.log(`=== DEBUG: Processing bucket ${bucketIndex} ===`);
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
                    gas: 10000000, // Increased gas limit for batch processing
                  },
                });

                console.log(`processBatch result for bucket ${bucketIndex}:`, processBatchResult);

                // Watch each processBatch transaction
                watch(processBatchResult as string, {
                  onSuccess: (batchTransaction) => {
                    console.log(`=== DEBUG: processBatch SUCCESS for bucket ${bucketIndex} ===`);
                    console.log('Batch transaction:', batchTransaction);
                    toast({
                      variant: 'success',
                      title: `Bucket ${bucketIndex} processed!`,
                      description: 'Successfully processed batch',
                    });
                    return batchTransaction;
                  },
                  onError: (receipt, error) => {
                    console.error(`=== DEBUG: processBatch ERROR for bucket ${bucketIndex} ===`);
                    console.error('Receipt:', receipt);
                    console.error('Error:', error);
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

          console.log('=== DEBUG: Calling processBatches() ===');
          processBatches();
          return transaction;
        },
        onError: (receipt, error) => {
          console.error('=== DEBUG: setPrices ERROR ===');
          console.error('Receipt:', receipt);
          console.error('Error:', error);
          setIsSubmitting(false);
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

  const guardedLayout = (title: string, description: string, action: React.ReactNode) => (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-2xl">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
          {action}
        </div>
      </div>
    </div>
  );

  if (!isLoaded) {
    return guardedLayout(
      'Loading…',
      'Please wait while we check your access permissions.',
      <div className="pt-2" />
    );
  }

  if (!isSignedIn) {
    return guardedLayout(
      'Sign in required',
      'Please sign in with an account that has admin privileges.',
      <Button variant="torch" className="mt-2 w-48 rounded-xl" asChild>
        <SignInButton />
      </Button>
    );
  }

  if (user && !isAdmin) {
    return guardedLayout(
      'Access denied',
      'You do not have permission to access the admin dashboard.',
      <Button variant="torch" className="mt-2 w-48 rounded-xl" asChild>
        <SignOutButton />
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-2xl">
          <NoWalletConnectedContainer />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl space-y-6">
        <Card className="rounded-xl border border-border bg-card">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Bet resolution by bucket</h2>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="bucket-filter" className="text-sm text-muted-foreground">
                    Filter by bucket
                  </label>
                  <select
                    id="bucket-filter"
                    value={selectedBucket}
                    onChange={(e) => setSelectedBucket(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">All buckets</option>
                    {availableBuckets.map((bucket: string) => (
                      <option key={bucket} value={bucket}>
                        Bucket {bucket}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {filteredBets && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {selectedBucket === 'all' ? 'Total' : 'Filtered'} bets: <span className="font-medium text-foreground">{filteredBets.length}</span>
                    </span>
                    <span className="text-border">|</span>
                    <span className="text-muted-foreground">
                      Unique times: <span className="font-medium text-foreground">{Array.from(new Set(filteredBets.map((b: Bet) => b.targetTimestamp))).length}</span>
                    </span>
                  </div>
                )}
                <Button variant="outline" size="sm" className="rounded-lg gap-2" onClick={() => refetch()} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Loading…' : 'Refresh'}
                </Button>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {selectedBucket === 'all' ? 'Showing all incomplete bets across all buckets' : `Showing bets from bucket ${selectedBucket}`}
                {filteredBets.length > 0 && (
                  <span className="ml-2 font-medium text-foreground">
                    ({filteredBets.length} bet{filteredBets.length !== 1 ? 's' : ''})
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
              <table className="min-w-[800px] w-full">
                <thead className="sticky top-0 z-10 bg-card border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bet ID</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bet amount</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Min price</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Max price</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Placed (UTC)</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resolution (UTC)</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resolution price</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <p className="text-sm text-muted-foreground">Loading bets…</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading && (!filteredBets || filteredBets.length === 0) && (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                            <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">No bets found</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {selectedBucket === 'all' ? 'No incomplete bets in any buckets' : `No bets in bucket ${selectedBucket}`}
                            </p>
                            {selectedBucket !== 'all' && (
                              <p className="text-sm text-muted-foreground mt-1">Try another bucket or All buckets.</p>
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
                      const isInRange = finalPrice !== null && finalPrice >= priceMin && finalPrice <= priceMax;
                      return (
                        <tr key={bet.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 text-sm font-mono text-foreground">{bet.id}</td>
                          <td className="py-3 px-4 text-sm text-foreground">{formatTinybarsToHbar(bet.stake)} HBAR</td>
                          <td className="py-3 px-4 text-sm tabular-nums">${priceMin.toFixed(4)}</td>
                          <td className="py-3 px-4 text-sm text-foreground tabular-nums">${priceMax.toFixed(4)}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{formatDateUTC(bet.timestamp)}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{formatDateUTC(bet.targetTimestamp)}</td>
                          <td className="py-3 px-4 text-sm">
                            {finalPrice !== null ? (
                              isInRange ? <span className="text-destructive">Win</span> : <span className="text-muted-foreground">Loss</span>
                            ) : (
                              <span className="text-muted-foreground">–</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`w-28 rounded-lg border px-2.5 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring ${isManual ? 'border-amber-500/50' : 'border-border'}`}
                              placeholder="Price"
                              value={manualPrices.get(bet.targetTimestamp) ?? (fetchedPrice !== null ? fetchedPrice.toFixed(4) : '')}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) handlePriceChange(bet.targetTimestamp, value);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {filteredBets && filteredBets.length > 0 && (
              <div className="flex justify-end p-4 border-t border-border">
                <Button variant="torch" className="rounded-xl min-w-[12rem]" onClick={submitPrices} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting…' : 'Submit prices to contract'}
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
