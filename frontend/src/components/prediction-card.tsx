'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { gql, useQuery } from '@apollo/client';
import { Minus, Plus, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KDEChart } from '@/components/kde-chart';
import { PriceRangeSelector } from '@/components/price-range-selector';
import { BetHistory } from '@/components/bet-history';
import { BetPlacingModal } from '@/components/bet-placing-modal';
import { BetPlacedModal } from '@/components/bet-placed-modal';
import { useHbarPrice } from '@/hooks/useHbarPrice';
import { useContractMultipliers } from '@/hooks/useContractMultipliers';
import { HbarPriceDisplay } from '@/components/hbar-price-display';
import { Bet } from '@/lib/types';
import { ContractId } from '@hashgraph/sdk';
import { ethers } from 'ethers';

import {
  useWallet,
  useBalance,
  useWriteContract,
  useWatchTransactionReceipt,
} from '@buidlerlabs/hashgraph-react-wallets';

import TorchPredictionMarketABI from '../../abi/TorchPredictionMarket.json';

interface PredictionCardProps {
  className?: string;
}

const GET_BETS_BY_TIMESTAMP = gql`
  query GetBetsByTimestamp($startTimestamp: Int!, $endTimestamp: Int!) {
    bets(where: { timestamp_gte: $startTimestamp, timestamp_lte: $endTimestamp }) {
      id
      stake
      priceMin
      priceMax
      timestamp
    }
  }
`;

function getTimestampRange(date: Date, timeStr: string) {
  const [hours, minutes] = timeStr.split(':').map(Number);

  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, 0)
  );
  const end = new Date(start.getTime() + 60 * 60 * 1000 - 1);

  return {
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
  };
}

function limitDecimals(value: number, decimals: number) {
  return value.toFixed(decimals);
}

export function PredictionCard({ className }: PredictionCardProps) {
  const { writeContract } = useWriteContract();
  const { watch } = useWatchTransactionReceipt();

  const { isConnected } = useWallet();
  const { data: balanceData } = useBalance({ autoFetch: isConnected });
  const balance = balanceData?.value?.toFixed(2) ?? 0;

  const [activeTab, setActiveTab] = useState('bet');
  const [selectedRange, setSelectedRange] = useState({
    min: 0.01,
    max: 0.2843,
  });
  const [depositAmount, setDepositAmount] = useState('0');
  const [resolutionDate, setResolutionDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000)); // Tomorrow
  const [resolutionTime, setResolutionTime] = useState('15:00');
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isBetPlaced, setIsBetPlaced] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);

  const { startUnix, endUnix } = getTimestampRange(resolutionDate, resolutionTime);

  const { price: currentPrice } = useHbarPrice();

  // Use the contract multipliers hook
  const { getSharpnessMultiplier, getTimeMultiplier } = useContractMultipliers();

  const { data, loading, error } = useQuery(GET_BETS_BY_TIMESTAMP, {
    variables: { startTimestamp: startUnix, endTimestamp: endUnix },
    // variables: { startTimestamp: '1754472860', endTimestamp: '1754579194' },
  });

  const totalBets = 1300;
  const activeBets = 375;

  const handleRangeChange = (min: number, max: number) => {
    setSelectedRange({ min, max });
  };

  const handleMaxDeposit = () => {
    setDepositAmount(balance.toString());
  };

  const handlePlaceBet = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setBetError('Please enter a valid deposit amount');
      return;
    }

    if (!isConnected) {
      setBetError('Please connect your wallet first');
      return;
    }

    setIsPlacingBet(true);
    setBetError(null);

    try {
      const decimals = 8;

      const minStr = limitDecimals(selectedRange.min, decimals);
      const maxStr = limitDecimals(selectedRange.max, decimals);

      // Now parseFixed works fine:
      const priceMin = ethers.utils.parseUnits(minStr, decimals);
      const priceMax = ethers.utils.parseUnits(maxStr, decimals);

      // Convert timestamp to string
      const targetTimestamp = startUnix.toString();

      const betId = (await writeContract({
        contractId: ContractId.fromString(process.env.NEXT_PUBLIC_CONTRACT_ID!),
        abi: TorchPredictionMarketABI.abi,
        functionName: 'placeBet',
        args: [targetTimestamp, priceMin, priceMax],
        metaArgs: {
          gas: 500000,
          amount: Number(depositAmount),
        },
      })) as string;

      watch(betId, {
        onSuccess: (transaction) => {
          setIsBetPlaced(true);
          setIsPlacingBet(false);
          return transaction;
        },
        onError: (receipt, error) => {
          setIsPlacingBet(false);
          setBetError(`Transaction failed or timed out: ${error}`);
          return receipt;
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to place bet';
      setIsPlacingBet(false);

      setBetError(errorMessage);
    }
  };

  const handleViewExplorer = () => {
    // Open transaction in explorer (mock implementation)
    window.open('https://hederaexplorer.io/', '_blank');
  };

  const closeBetPlacingModal = () => {
    setIsPlacingBet(false);
    setBetError(null);
  };

  const closeBetPlacedModal = () => {
    setIsBetPlaced(false);

    // Reset form
    setDepositAmount('');
  };

  const [multipliers, setMultipliers] = useState({
    sharpness: 0,
    leadTime: 0,
    betQuality: 0,
    isLoading: true,
  });

  // Date manipulation functions
  const incrementDate = () => {
    const newDate = new Date(resolutionDate);
    newDate.setDate(newDate.getDate() + 1);
    setResolutionDate(newDate);
  };

  const decrementDate = () => {
    const newDate = new Date(resolutionDate);
    newDate.setDate(newDate.getDate() - 1);
    // Don't allow dates in the past
    if (newDate > new Date()) {
      setResolutionDate(newDate);
    }
  };

  // Time manipulation functions
  const incrementTime = () => {
    const [hours, minutes] = resolutionTime.split(':').map(Number);
    let newHours = hours + 1;
    if (newHours >= 24) {
      newHours = 0;
    }
    setResolutionTime(
      `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    );
  };

  const decrementTime = () => {
    const [hours, minutes] = resolutionTime.split(':').map(Number);
    let newHours = hours - 1;
    if (newHours < 0) {
      newHours = 23;
    }
    setResolutionTime(
      `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    );
  };

  // Format date for display
  const formatDate = (date: Date) => {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[date.getMonth()];
  };

  const formatDay = (date: Date) => {
    return date.getDate().toString();
  };

  const { sharpness, leadTime, betQuality, isLoading: multipliersLoading } = multipliers;

  // Validation
  const hasValidAmount =
    depositAmount && parseFloat(depositAmount) > 0 && parseFloat(depositAmount) <= balance;
  const isWalletConnected = isConnected;
  const canPlaceBet = hasValidAmount && isWalletConnected && !isPlacingBet;

  useEffect(() => {
    if (data?.bets?.length) {
      const prices = data.bets.flatMap((bet: Bet) => [bet.priceMin, bet.priceMax]);

      const minPrice = Math.min(...prices) / 10000;
      const maxPrice = Math.max(...prices) / 10000;

      setSelectedRange({ min: minPrice, max: maxPrice });
    }
  }, [data]);

  // Calculate real multipliers when range or time changes
  useEffect(() => {
    const calculateRealMultipliers = async () => {
      if (!getSharpnessMultiplier || !getTimeMultiplier) {
        setMultipliers({
          sharpness: 1.5,
          leadTime: 1.2,
          betQuality: 1.8,
          isLoading: false,
        });
        return;
      }

      setMultipliers((prev) => ({ ...prev, isLoading: true }));

      try {
        // Convert price range to basis points (1-10000)
        // selectedRange is in USD (e.g., 0.25-0.35), convert to BPS
        const priceMinBps = Math.floor(selectedRange.min * 10000).toString();
        const priceMaxBps = Math.floor(selectedRange.max * 10000).toString();

        // Add timeout to prevent infinite loading
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Contract call timeout')), 10000)
        );

        // Get multipliers from contract with timeout
        const [sharpnessResult, timeResult] = (await Promise.race([
          Promise.all([
            getSharpnessMultiplier(priceMinBps, priceMaxBps),
            getTimeMultiplier(startUnix.toString()),
          ]),
          timeout,
        ])) as [string | null, string | null];

        if (sharpnessResult && timeResult) {
          // Convert from basis points to multiplier (divide by 10000)
          const sharpness = parseFloat(sharpnessResult) / 10000;
          const leadTime = parseFloat(timeResult) / 10000;
          const betQuality = sharpness * leadTime;

          setMultipliers({
            sharpness,
            leadTime,
            betQuality,
            isLoading: false,
          });
        } else {
          throw new Error('Contract returned null values');
        }
      } catch (error) {
        setMultipliers({
          sharpness: 1.5,
          leadTime: 1.2,
          betQuality: 1.8,
          isLoading: false,
        });
      }
    };

    // Add delay to prevent too frequent calls
    const timeoutId = setTimeout(calculateRealMultipliers, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedRange, startUnix]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm bg-dark-slate px-2 py-1 rounded text-light-gray">Crypto</span>
          <span className="text-sm text-medium-gray">
            <span className="text-white">{activeBets}</span> active bets
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <Image src="/hedera.svg" alt="Logo" width={65} height={65} />
          <div>
            <h2 className="text-xl font-bold text-light-gray">Predict HBAR token price in USD</h2>

            <span className="flex gap-1  text-xs">
              <b>Current price:</b>
              <HbarPriceDisplay size="sm" showIcon={false} showChange={true} />
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bet">Bet</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <hr className="border-white/5 -mx-6 my-4" />

          <TabsContent value="bet" className="space-y-6">
            {/* Resolution Time Selection */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-medium-gray">Select resolution time</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-neutral-900 d-flex flex-col items-center justify-center p-4 gap-2 rounded-lg text-center">
                  <span className="text-sm font-medium text-medium-gray">Date</span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8 rounded-lg bg-neutral-950 hover:bg-neutral-800"
                      onClick={decrementDate}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>

                    <div className="flex-1 text-center">
                      <div className="text-xl font-bold">
                        {formatDate(resolutionDate)} {formatDay(resolutionDate)}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8 rounded-lg bg-neutral-950 hover:bg-neutral-800"
                      onClick={incrementDate}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {resolutionDate.getFullYear()}
                  </div>
                </div>

                <div className="bg-neutral-900 d-flex flex-col items-center justify-center p-4 gap-2 rounded-lg text-center">
                  <span className="text-sm font-medium text-medium-gray">Date</span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8 rounded-lg bg-neutral-950 hover:bg-neutral-800"
                      onClick={decrementTime}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>

                    <div className="text-xl font-bold flex-1">{resolutionTime}</div>

                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8 rounded-lg bg-neutral-950 hover:bg-neutral-800"
                      onClick={incrementTime}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="text-sm text-muted-foreground">UTC</div>
                </div>
              </div>
            </div>

            {/* Price Range Selection */}

            <PriceRangeSelector
              minPrice={0.2}
              maxPrice={0.34}
              currentPrice={currentPrice}
              totalBets={totalBets}
              onRangeChange={handleRangeChange}
            />

            {/* Bet Quality Multipliers */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-medium-gray ">Bet Quality</span>
              <div className="p-3 bg-neutral-900 rounded-lg space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-medium-gray">Sharpness:</span>
                    <span className={`text-bright-green ${multipliersLoading ? 'opacity-50' : ''}`}>
                      {multipliersLoading ? '...' : `${sharpness.toFixed(2)}x`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-medium-gray">Lead time:</span>
                    <span className={`text-bright-green ${multipliersLoading ? 'opacity-50' : ''}`}>
                      {multipliersLoading ? '...' : `${leadTime.toFixed(2)}x`}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-medium-gray">Bet quality:</span>
                    <span className={`text-bright-green ${multipliersLoading ? 'opacity-50' : ''}`}>
                      {multipliersLoading ? '...' : `${betQuality.toFixed(2)}x (weight)`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-white/5 -mx-6" />

            {/* Deposit Amount */}
            <div>
              <label htmlFor="depositNumber" className="text-sm font-medium text-medium-gray">
                Deposit amount
              </label>

              <div className="bg-neutral-900 p-4 rounded-lg my-2">
                <div className="relative">
                  <Input
                    id="depositNumber"
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="pr-20"
                    placeholder="0.0"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                    {!hasValidAmount && <AlertTriangle className="w-4 h-4 text-magenta" />}
                    <span className="text-sm font-medium text-magenta">H</span>
                    <span className="text-sm text-medium-gray">HBAR</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 text-sm">
                  <span className="text-medium-gray">Balance: {balance}</span>
                  <button
                    type="button"
                    onClick={handleMaxDeposit}
                    className="text-vibrant-purple hover:underline"
                  >
                    Use MAX
                  </button>
                </div>
              </div>

              {/* Protocol Fee */}
              <div className="flex justify-between py-3 px-4 border border-white/5 rounded-lg text-sm">
                <span className="text-medium-gray">Protocol fee:</span>
                <span className="text-white">
                  0.5%
                  <span className="text-medium-gray">
                    ({(parseFloat(depositAmount) * 0.005).toFixed(4)} HBAR)
                  </span>
                </span>
              </div>
            </div>

            {/* Warning Message */}
            {hasValidAmount && (
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-100">
                    Betting on prediction markets bears significant risk of losing funds. Only
                    contribute what you can afford to lose.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {betError && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-100">{betError}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              className="w-full bg-vibrant-purple hover:bg-vibrant-purple/90 text-white"
              size="lg"
              onClick={handlePlaceBet}
              disabled={!canPlaceBet}
            >
              {isPlacingBet
                ? 'Processing...'
                : !isWalletConnected
                  ? 'Connect Wallet'
                  : !hasValidAmount
                    ? 'Enter Amount'
                    : 'Place Bet'}
            </Button>
          </TabsContent>

          <TabsContent value="forecast" className="space-y-4">
            <KDEChart currentPrice={currentPrice} className="h-80" />
          </TabsContent>

          <TabsContent value="history">
            <BetHistory />
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Bet Placing Modal */}
      <BetPlacingModal
        isOpen={isPlacingBet}
        onClose={closeBetPlacingModal}
        onViewExplorer={handleViewExplorer}
      />

      {/* Bet Placed Modal */}
      <BetPlacedModal
        isOpen={isBetPlaced}
        onClose={closeBetPlacedModal}
        onViewExplorer={handleViewExplorer}
      />
    </Card>
  );
}
