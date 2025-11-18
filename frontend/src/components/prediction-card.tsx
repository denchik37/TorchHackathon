'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
import { useBetSimulation } from '@/hooks/useBetSimulation';
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
    bets(where: { targetTimestamp_gte: $startTimestamp, targetTimestamp_lte: $endTimestamp }) {
      id
      stake
      priceMin
      priceMax
      targetTimestamp
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
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const { startUnix, endUnix } = getTimestampRange(resolutionDate, resolutionTime);

  // Validate minimum lead period
  const validateLeadPeriod = () => {
    const selectedTime = new Date(
      Date.UTC(
        resolutionDate.getUTCFullYear(),
        resolutionDate.getUTCMonth(),
        resolutionDate.getUTCDate(),
        parseInt(resolutionTime.split(':')[0]),
        parseInt(resolutionTime.split(':')[1]),
        0
      )
    );
    const minimumTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
    return selectedTime >= minimumTime;
  };

  const hasValidLeadPeriod = useMemo(() => validateLeadPeriod(), [resolutionDate, resolutionTime]);
  const leadPeriodHours = useMemo(
    () => Math.max(0, (startUnix * 1000 - Date.now()) / (60 * 60 * 1000)),
    [startUnix]
  );

  const {
    price: currentPrice,
    isLoading: priceLoading,
    error: priceError,
    isStale,
    retryFetch,
  } = useHbarPrice();

  // Use bet simulation hook
  const { simulatePlaceBet } = useBetSimulation();

  const { data } = useQuery(GET_BETS_BY_TIMESTAMP, {
    variables: { startTimestamp: startUnix, endTimestamp: endUnix },
  });

  // Query for total bet counts
  const { data: allBetsData } = useQuery(gql`
    query GetAllBets {
      bets {
        id
        finalized
      }
    }
  `);

  const totalBets = allBetsData?.bets?.length || 0;
  const activeBets = allBetsData?.bets?.filter((bet: any) => !bet.finalized)?.length || 0;

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

      // Store transaction ID for explorer link
      setTransactionId(betId);

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
    if (transactionId) {
      // Open specific transaction in HashScan (most reliable Hedera explorer)
      window.open(`https://hashscan.io/mainnet/transaction/${transactionId}`, '_blank');
    } else {
      // Fallback to HashScan homepage if no transaction ID
      window.open('https://hashscan.io/mainnet', '_blank');
    }
  };

  const closeBetPlacingModal = () => {
    setIsPlacingBet(false);
    setBetError(null);
  };

  const closeBetPlacedModal = () => {
    setIsBetPlaced(false);
    setTransactionId(null); // Clear transaction ID when closing

    // Reset form
    setDepositAmount('');
  };

  const [multipliers, setMultipliers] = useState({
    sharpness: 0,
    leadTime: 0,
    betQuality: 0,
    isLoading: true,
  });

  const [simulationDetails, setSimulationDetails] = useState({
    fee: '0',
    stakeNet: '0',
    isValid: true,
    errorMessage: '',
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
    // Don't allow dates with less than 1-day lead period
    const minimumDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
    if (newDate >= minimumDate) {
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

  const getProtocolFeeDisplay = () => {
    if (multipliersLoading) {
      return '...';
    }

    if (depositAmount && parseFloat(depositAmount) > 0 && simulationDetails.isValid) {
      const feeAmount = parseFloat(ethers.utils.formatEther(simulationDetails.fee));
      const feePercentage = ((feeAmount / parseFloat(depositAmount)) * 100).toFixed(2);
      return (
        <>
          {feePercentage}%<span className="text-medium-gray">({feeAmount.toFixed(4)} HBAR)</span>
        </>
      );
    }

    return null;
  };

  const { sharpness, leadTime, betQuality, isLoading: multipliersLoading } = multipliers;

  // Validation
  const hasValidAmount =
    depositAmount && parseFloat(depositAmount) > 0 && parseFloat(depositAmount) <= balance;
  const isWalletConnected = isConnected;
  const canPlaceBet = hasValidAmount && isWalletConnected && !isPlacingBet && hasValidLeadPeriod;

  const getButtonText = () => {
    if (isPlacingBet) return 'Processing...';
    if (!isWalletConnected) return 'Connect Wallet';
    if (!hasValidLeadPeriod) return `Minimum 24h lead required (${leadPeriodHours.toFixed(1)}h)`;
    if (!hasValidAmount) return 'Enter Amount';
    return 'Place Bet';
  };

  useEffect(() => {
    if (data?.bets?.length) {
      const prices = data.bets.flatMap((bet: Bet) => [bet.priceMin, bet.priceMax]);

      const minPrice = Math.min(...prices) / 10000;
      const maxPrice = Math.max(...prices) / 10000;

      setSelectedRange({ min: minPrice, max: maxPrice });
    }
  }, [data]);

  // Calculate real multipliers using bet simulation
  useEffect(() => {
    const calculateRealMultipliers = async () => {
      if (!simulatePlaceBet) {
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
        // Use simulatePlaceBet to get all metrics in one call
        const simulation = await simulatePlaceBet(
          startUnix.toString(),
          selectedRange.min.toString(),
          selectedRange.max.toString(),
          depositAmount
        );

        if (simulation && simulation.isValid) {
          // Convert from basis points to multiplier (divide by 10000)
          const sharpness = parseFloat(simulation.sharpnessBps) / 10000;
          const leadTime = parseFloat(simulation.timeBps) / 10000;
          const betQuality = parseFloat(simulation.qualityBps) / 10000;

          setMultipliers({
            sharpness,
            leadTime,
            betQuality,
            isLoading: false,
          });

          // Store simulation details for fee display
          setSimulationDetails({
            fee: simulation.fee,
            stakeNet: simulation.stakeNet,
            isValid: simulation.isValid,
            errorMessage: simulation.errorMessage,
          });
        } else {
          throw new Error(simulation?.errorMessage || 'Simulation returned invalid result');
        }
      } catch (error) {
        console.warn('Failed to get bet quality from contract, using fallback:', error);
        setMultipliers({
          sharpness: 1.5,
          leadTime: 1.2,
          betQuality: 1.8,
          isLoading: false,
        });
      }
    };

    calculateRealMultipliers();
  }, [selectedRange, startUnix, depositAmount]);

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
              <HbarPriceDisplay
                price={currentPrice}
                isLoading={priceLoading}
                error={priceError}
                isStale={isStale}
                retryFetch={retryFetch}
                size="sm"
                showIcon={false}
              />
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
            {priceLoading || !currentPrice ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-20 bg-neutral-800 rounded animate-pulse"></div>
                  <div className="h-4 w-24 bg-neutral-800 rounded animate-pulse"></div>
                </div>
                <div className="relative h-40 bg-neutral-900 rounded-lg">
                  <div className="flex items-end justify-between h-full space-x-0.5 p-2">
                    {Array.from({ length: 30 }).map((_, index) => (
                      <div
                        key={index}
                        className="flex-1 bg-neutral-800 rounded-t animate-pulse"
                        style={{
                          height: `${Math.random() * 60 + 20}%`,
                          minHeight: '8px',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="h-3 w-12 bg-neutral-800 rounded animate-pulse"></div>
                  <div className="h-3 w-12 bg-neutral-800 rounded animate-pulse"></div>
                  <div className="h-3 w-12 bg-neutral-800 rounded animate-pulse"></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-4 w-16 bg-neutral-800 rounded animate-pulse"></div>
                    <div className="h-10 bg-neutral-900 rounded animate-pulse"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-16 bg-neutral-800 rounded animate-pulse"></div>
                    <div className="h-10 bg-neutral-900 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            ) : (
              <PriceRangeSelector
                minPrice={Math.max(0.01, currentPrice * 0.5)} // 50% below current price, min 0.01
                maxPrice={currentPrice * 2} // 200% of current price
                currentPrice={currentPrice}
                totalBets={totalBets}
                selectedDate={resolutionDate}
                onRangeChange={handleRangeChange}
              />
            )}

            {/* Bet Quality Multipliers */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-medium-gray ">Bet quality</span>
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
                    type="text"
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow only numbers, dots, and empty string (including leading zeros)
                      if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                        setDepositAmount(value);
                      }
                    }}
                    className="pr-20"
                    placeholder="0.0"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                    {!hasValidAmount && <AlertTriangle className="w-4 h-4 text-magenta" />}
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
                <span className="text-white">{getProtocolFeeDisplay()}</span>
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
              {getButtonText()}
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
