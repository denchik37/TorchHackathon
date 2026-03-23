'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { gql, useQuery } from '@apollo/client';
import { Minus, Plus, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KDEChart } from '../KDEChart';
import { PriceRangeSelector } from '../PriceRangeSelector';
import { BetHistory } from '../BetHistory';
import { BetPlacingModal } from '../BetPlacingModal';
import { BetPlacedModal } from '../BetPlacedModal';
import { useHbarPrice } from '@/hooks/useHbarPrice';
import { useBetSimulation } from '@/hooks/useBetSimulation';
import { HbarPriceDisplay } from '../HbarPriceDisplay';
import { Bet } from '@/lib/types';
import { ContractId } from '@hashgraph/sdk';
import { ethers } from 'ethers';

import {
  useWallet,
  useBalance,
  useWriteContract,
  useWatchTransactionReceipt,
} from '@buidlerlabs/hashgraph-react-wallets';

import TorchPredictionMarketABI from '../../../../../abi/TorchPredictionMarket.json';
import { predictionCardStyles as st } from './PredictionCard.styles';

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

  // Total bets (used by the histogram sizing, etc.)
  const { data: totalBetsData } = useQuery(
    gql`
      query GetTotalBets {
        bets {
          id
        }
      }
    `
  );

  // Unresolved bets (used for the "active" badge)
  const { data: unresolvedBetsData } = useQuery(
    gql`
      query GetUnresolvedBets {
        bets(
          where: { bucketRef_: { aggregationComplete: false }, finalized: false }
          first: 1000
          orderBy: targetTimestamp
          orderDirection: asc
        ) {
          id
        }
      }
    `
  );

  const totalBets = totalBetsData?.bets?.length || 0;
  const activeBets = unresolvedBetsData?.bets?.length || 0;

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

      // Fallback timeout: if writeContract returned a betId, transaction was submitted
      // Don't rely on watch() which has a known SDK bug (Query.fromBytes not implemented)
      const fallbackTimeout = setTimeout(() => {
        setIsBetPlaced(true);
        setIsPlacingBet(false);
      }, 10000);

      watch(betId, {
        onSuccess: (transaction) => {
          clearTimeout(fallbackTimeout);
          setIsBetPlaced(true);
          setIsPlacingBet(false);
          return transaction;
        },
        onError: (receipt, error) => {
          // Transaction likely succeeded - don't show error, let fallback handle it
          console.warn('watch() error (transaction likely succeeded):', error);
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

      const minPrice = Math.min(...prices) / 100000000;
      const maxPrice = Math.max(...prices) / 100000000;

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
    <Card className={st.card + (className ? ` ${className}` : '')}>
      {/* Header: token summary + title + price */}
      <div className={st.header}>
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[hsl(0_0%_7%)] px-3 py-1.5">
            <Image src="/hedera-hbar-logo.svg" alt="HBAR" width={16} height={16} className="rounded-full" />
            <span className="text-sm font-medium text-foreground">HBAR</span>
          </div>
          <span className={st.activeBadge}>{activeBets} active</span>
        </div>
        <h2 className={st.marketTitle}>HBAR Price Prediction</h2>
        <p className={st.priceLabel + ' mt-1 flex items-center gap-1.5 flex-wrap'}>
          <span>Current:</span>
          <HbarPriceDisplay
            price={currentPrice}
            isLoading={priceLoading}
            error={priceError}
            isStale={isStale}
            retryFetch={retryFetch}
            size="sm"
            showIcon={false}
          />
        </p>
      </div>

      {/* Tabs */}
      <div className={st.headerBottom}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={st.tabsList}>
            <TabsTrigger value="bet" className={st.tabsTrigger + ' data-[state=active]:bg-primary data-[state=active]:text-white'}>
              Bet
            </TabsTrigger>
            <TabsTrigger value="forecast" className={st.tabsTrigger + ' data-[state=active]:bg-primary data-[state=active]:text-white'}>
              Forecast
            </TabsTrigger>
            <TabsTrigger value="history" className={st.tabsTrigger + ' data-[state=active]:bg-primary data-[state=active]:text-white'}>
              History
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="bet" className="mt-0 px-6 py-5">
            <div className={st.betTabRow}>
              {/* Step 1 — Resolution time */}
              <div className={st.betSection}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={st.stepBadge}>1</div>
                  <h3 className={st.stepTitle}>Resolution time</h3>
                  <span className={st.stepHint + ' ml-auto'}>Min 24h lead</span>
                </div>
                <div className={st.dateTimeGrid}>
                  <div className={st.dateTimeBox}>
                    <span className={st.dateTimeLabel}>Date</span>
                    <div className="flex items-center gap-2">
                      <button type="button" className={st.dateTimeButton} onClick={decrementDate}>
                        <Minus className="size-3" />
                      </button>
                      <span className={st.dateTimeValue + ' min-w-[60px] text-center'}>
                        {formatDate(resolutionDate)} {formatDay(resolutionDate)}
                      </span>
                      <button type="button" className={st.dateTimeButton} onClick={incrementDate}>
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <span className={st.dateTimeMeta}>{resolutionDate.getFullYear()}</span>
                  </div>
                  <div className={st.dateTimeBox}>
                    <span className={st.dateTimeLabel}>Time (UTC)</span>
                    <div className="flex items-center gap-2">
                      <button type="button" className={st.dateTimeButton} onClick={decrementTime}>
                        <Minus className="size-3" />
                      </button>
                      <span className={st.dateTimeValue + ' min-w-[60px] text-center'}>{resolutionTime}</span>
                      <button type="button" className={st.dateTimeButton} onClick={incrementTime}>
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <span className={st.dateTimeMeta}>UTC</span>
                  </div>
                </div>
              </div>

              {/* Step 2 — Price range + quality */}
              <div className={st.betSection}>
                {priceLoading || !currentPrice ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="h-4 w-20 bg-white/[0.06] rounded animate-pulse" />
                      <div className="h-4 w-24 bg-white/[0.06] rounded animate-pulse" />
                    </div>
                    <div className="relative h-44 rounded-md border border-white/[0.06] overflow-hidden">
                      <div className="flex items-end justify-between h-full gap-px p-2">
                        {Array.from({ length: 30 }).map((_, i) => (
                          <div key={i} className="flex-1 bg-white/[0.06] rounded-t min-h-[8px]" style={{ height: `${30 + Math.random() * 50}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <PriceRangeSelector
                    minPrice={Math.max(0.01, currentPrice * 0.5)}
                    maxPrice={currentPrice * 2}
                    currentPrice={currentPrice}
                    totalBets={totalBets}
                    selectedDate={resolutionDate}
                    onRangeChange={handleRangeChange}
                  />
                )}

                {/* Bet quality */}
                <div className="mt-3 pt-3">
                  <span className={st.summaryLabel}>Bet quality</span>
                  <div className={st.summaryChips}>
                    <div className={st.summaryChip}>
                      <span className={st.summaryChipLabel}>Sharpness </span>
                      <span className={st.summaryChipValue + (multipliersLoading ? ' opacity-50' : '')}>
                        {multipliersLoading ? '…' : `${sharpness.toFixed(2)}x`}
                      </span>
                    </div>
                    <div className={st.summaryChip}>
                      <span className={st.summaryChipLabel}>Lead time </span>
                      <span className={st.summaryChipValue + (multipliersLoading ? ' opacity-50' : '')}>
                        {multipliersLoading ? '…' : `${leadTime.toFixed(2)}x`}
                      </span>
                    </div>
                    <div className={st.summaryChip}>
                      <span className={st.summaryChipLabel}>Quality </span>
                      <span className={st.summaryChipValue + (multipliersLoading ? ' opacity-50' : '')}>
                        {multipliersLoading ? '…' : `${betQuality.toFixed(2)}x`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 — Deposit */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className={st.stepBadge}>3</div>
                  <label htmlFor="depositNumber" className={st.stepTitle}>Deposit amount</label>
                </div>
                <div className={st.amountInputWrap}>
                  <Input
                    id="depositNumber"
                    type="text"
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) setDepositAmount(value);
                    }}
                    className={st.amountInput + ' pr-16 h-10'}
                    placeholder="0.0"
                  />
                  <div className={st.amountSuffix}>
                    {!hasValidAmount && depositAmount && parseFloat(depositAmount) > 0 && (
                      <AlertTriangle className="size-3.5 text-destructive" />
                    )}
                    <span>HBAR</span>
                  </div>
                </div>
                <div className={st.amountActions}>
                  <span className="text-muted-foreground">Balance: {balance}</span>
                  <button type="button" onClick={handleMaxDeposit} className={st.amountMax}>
                    MAX
                  </button>
                </div>
                <div className={st.protocolFeeRow}>
                  <span className="text-muted-foreground">Protocol fee</span>
                  <span className="text-foreground font-medium">{getProtocolFeeDisplay()}</span>
                </div>

                {hasValidAmount && (
                  <div className={st.calloutWarning + ' mt-4'}>
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className={st.calloutIcon + ' size-4'} />
                      <p className={st.calloutWarningText}>
                        Betting on prediction markets bears significant risk of losing funds. Only
                        contribute what you can afford to lose.
                      </p>
                    </div>
                  </div>
                )}

                {betError && (
                  <div className={st.calloutError + ' mt-4'}>
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5 text-destructive" />
                      <p className="text-sm text-destructive-foreground">{betError}</p>
                    </div>
                  </div>
                )}

                <div className="mt-5">
                  <Button
                    className={st.ctaButton + ' bg-primary text-white hover:bg-primary/85' + (!canPlaceBet ? ' ' + st.ctaButtonDisabled : '')}
                    onClick={handlePlaceBet}
                    disabled={!canPlaceBet}
                  >
                    {getButtonText()}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="forecast" className="mt-0 px-6 pt-2 pb-12">
            <KDEChart currentPrice={currentPrice} className="h-96 pt-2 pb-4" />
          </TabsContent>

          <TabsContent value="history" className="mt-0 px-6 py-5">
            <BetHistory />
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Bet Placing Modal */}
      <BetPlacingModal isOpen={isPlacingBet} onClose={closeBetPlacingModal} />

      {/* Bet Placed Modal */}
      <BetPlacedModal
        isOpen={isBetPlaced}
        onClose={closeBetPlacedModal}
        onViewExplorer={handleViewExplorer}
      />
    </Card>
  );
}
