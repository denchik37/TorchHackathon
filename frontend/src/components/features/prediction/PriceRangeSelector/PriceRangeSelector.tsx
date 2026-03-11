'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cn, formatTinybarsToHbar } from '@/lib/utils';
import { gql, useQuery } from '@apollo/client';
import { priceRangeSelectorStyles } from './PriceRangeSelector.styles';

const GET_BETS_FOR_DAY = gql`
  query GetBetsForDay($startTimestamp: Int!, $endTimestamp: Int!) {
    bets(where: { targetTimestamp_gte: $startTimestamp, targetTimestamp_lte: $endTimestamp }) {
      id
      stake
      priceMin
      priceMax
      targetTimestamp
    }
  }
`;

function getDayTimestampRange(date: Date) {
  const startOfDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0)
  );
  const endOfDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59)
  );
  return {
    startTimestamp: Math.floor(startOfDay.getTime() / 1000),
    endTimestamp: Math.floor(endOfDay.getTime() / 1000),
  };
}

export interface PriceRangeSelectorProps {
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
  totalBets: number;
  selectedDate: Date;
  onRangeChange: (min: number, max: number) => void;
  className?: string;
}

export function PriceRangeSelector({
  minPrice,
  maxPrice,
  currentPrice,
  totalBets,
  selectedDate,
  onRangeChange,
  className,
}: PriceRangeSelectorProps) {
  const [selectedMin, setSelectedMin] = useState(minPrice + (maxPrice - minPrice) * 0.1);
  const [selectedMax, setSelectedMax] = useState(maxPrice - (maxPrice - minPrice) * 0.1);
  const [isDraggingMin, setIsDraggingMin] = useState(false);
  const [isDraggingMax, setIsDraggingMax] = useState(false);
  const [minInputValue, setMinInputValue] = useState('');
  const [maxInputValue, setMaxInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedMin(minPrice + (maxPrice - minPrice) * 0.1);
    setSelectedMax(maxPrice - (maxPrice - minPrice) * 0.1);
  }, [minPrice, maxPrice]);

  const { startTimestamp, endTimestamp } = getDayTimestampRange(selectedDate);

  const { data: betsData, loading: betsLoading } = useQuery(GET_BETS_FOR_DAY, {
    variables: { startTimestamp, endTimestamp },
    fetchPolicy: 'cache-and-network',
  });

  const totalVolumeHbar = useMemo(() => {
    if (betsLoading || !betsData?.bets) return 0;
    return betsData.bets.reduce((sum: number, bet: { stake: string }) => {
      return sum + parseFloat(formatTinybarsToHbar(bet.stake));
    }, 0);
  }, [betsData, betsLoading]);

  const histogramData = useMemo(() => {
    const bins = 31;
    const binSize = (maxPrice - minPrice) / bins;
    if (betsLoading || !betsData?.bets) {
      const data: Array<{ min: number; max: number; center: number; prob: number; totalStake: number; rawScore: number; amount: number; isSelected: boolean }> = [];
      for (let i = 0; i < bins; i++) {
        const binMin = minPrice + i * binSize;
        const binMax = binMin + binSize;
        const center = (binMin + binMax) / 2;
        data.push({
          min: binMin,
          max: binMax,
          center,
          prob: 0,
          totalStake: 0,
          rawScore: 0,
          amount: 0,
          isSelected: center >= selectedMin && center <= selectedMax,
        });
      }
      return data;
    }
    const totalStakeAcrossAllBets = betsData.bets.reduce((sum: number, bet: { stake: string }) => {
      return sum + parseFloat(formatTinybarsToHbar(bet.stake));
    }, 0);
    const data: Array<{ min: number; max: number; center: number; prob: number; totalStake: number; rawScore: number; amount: number; isSelected: boolean }> = [];
    for (let i = 0; i < bins; i++) {
      const binMin = minPrice + i * binSize;
      const binMax = binMin + binSize;
      const center = (binMin + binMax) / 2;
      const betsInBin = betsData.bets.filter((bet: { priceMin: string; priceMax: string }) => {
        const betMinPrice = parseFloat(formatTinybarsToHbar(bet.priceMin));
        const betMaxPrice = parseFloat(formatTinybarsToHbar(bet.priceMax));
        return betMinPrice <= binMax && betMaxPrice >= binMin;
      });
      const totalStakeInBin = betsInBin.reduce((sum: number, bet: { stake: string; priceMin: string; priceMax: string }) => {
        const stake = parseFloat(formatTinybarsToHbar(bet.stake));
        const betMinPrice = parseFloat(formatTinybarsToHbar(bet.priceMin));
        const betMaxPrice = parseFloat(formatTinybarsToHbar(bet.priceMax));
        const overlapMin = Math.max(binMin, betMinPrice);
        const overlapMax = Math.min(binMax, betMaxPrice);
        const overlapRatio = Math.max(0, (overlapMax - overlapMin) / (betMaxPrice - betMinPrice));
        return sum + stake * overlapRatio;
      }, 0);
      const prob = totalStakeAcrossAllBets > 0 ? totalStakeInBin / totalStakeAcrossAllBets : 0;
      data.push({
        min: binMin,
        max: binMax,
        center,
        prob,
        totalStake: totalStakeInBin,
        rawScore: totalStakeInBin,
        amount: totalStakeInBin,
        isSelected: center >= selectedMin && center <= selectedMax,
      });
    }
    return data;
  }, [minPrice, maxPrice, selectedMin, selectedMax, betsData, betsLoading]);

  const maxProb = useMemo(() => Math.max(...histogramData.map((d) => d.prob), 0), [histogramData]);

  const handleMinChange = useCallback(
    (value: number) => {
      const newMin = Math.min(value, selectedMax - 0.0001);
      setSelectedMin(newMin);
      onRangeChange(newMin, selectedMax);
    },
    [onRangeChange, selectedMax]
  );

  const handleMaxChange = useCallback(
    (value: number) => {
      const newMax = Math.max(value, selectedMin + 0.0001);
      setSelectedMax(newMax);
      onRangeChange(selectedMin, newMax);
    },
    [onRangeChange, selectedMin]
  );

  const getPriceFromPosition = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return minPrice;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = (clientX - rect.left) / rect.width;
      const clampedX = Math.max(0, Math.min(1, relativeX));
      return minPrice + clampedX * (maxPrice - minPrice);
    },
    [minPrice, maxPrice]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent, isMin: boolean) => {
    e.preventDefault();
    setIsDraggingMin(isMin);
    setIsDraggingMax(!isMin);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingMin && !isDraggingMax) return;
      const newPrice = getPriceFromPosition(e.clientX);
      if (isDraggingMin) handleMinChange(newPrice);
      else if (isDraggingMax) handleMaxChange(newPrice);
    },
    [isDraggingMin, isDraggingMax, getPriceFromPosition, handleMinChange, handleMaxChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDraggingMin(false);
    setIsDraggingMax(false);
  }, []);

  useEffect(() => {
    if (isDraggingMin || isDraggingMax) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingMin, isDraggingMax, handleMouseMove, handleMouseUp]);

  return (
    <div className={cn(priceRangeSelectorStyles.root, className)}>
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={priceRangeSelectorStyles.stepBadge}>2</div>
          <h3 className={priceRangeSelectorStyles.stepTitle}>Select price range</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          Total volume: {totalVolumeHbar.toLocaleString(undefined, { maximumFractionDigits: 2 })} HBAR
        </span>
      </div>

      <div ref={containerRef} className={priceRangeSelectorStyles.histogram}>
        <div className="flex items-end justify-between h-full space-x-0.5">
          {histogramData.map((bin, index) => (
            <div
              key={index}
              className={priceRangeSelectorStyles.bar}
              style={{
                height: `${bin.prob > 0 ? Math.max(8, (bin.prob / maxProb) * 100) : 0}%`,
                opacity: bin.isSelected ? 1 : 0.7,
              }}
            />
          ))}
        </div>

        <div
          className={priceRangeSelectorStyles.currentPriceLine}
          style={{ left: `${((currentPrice - minPrice) / (maxPrice - minPrice)) * 100}%` }}
        >
          <div className={priceRangeSelectorStyles.currentPriceDot} />
        </div>

        <div
          className={cn('absolute top-0 bottom-0 w-1 cursor-ew-resize select-none', isDraggingMin ? 'z-20' : 'z-10')}
          style={{ left: `${Math.max(0, Math.min(100, ((selectedMin - minPrice) / (maxPrice - minPrice)) * 100))}%` }}
          onMouseDown={(e) => handleMouseDown(e, true)}
        >
          <div className={priceRangeSelectorStyles.handleMin} />
          <div className="absolute top-1/2 transform -translate-y-1/2 -left-2 w-5 h-5 bg-primary rounded border-2 border-white/90 shadow-lg flex items-center justify-center group">
            <div className="w-1 h-2 bg-white rounded-sm" />
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-card border border-white/20 text-foreground text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-xl">
              {selectedMin.toFixed(4)}
            </div>
          </div>
        </div>

        <div
          className={cn('absolute top-0 bottom-0 w-1 cursor-ew-resize select-none', isDraggingMax ? 'z-20' : 'z-10')}
          style={{ left: `${Math.max(0, Math.min(100, ((selectedMax - minPrice) / (maxPrice - minPrice)) * 100))}%` }}
          onMouseDown={(e) => handleMouseDown(e, false)}
        >
          <div className={priceRangeSelectorStyles.handleMax} />
          <div className="absolute top-1/2 transform -translate-y-1/2 -left-2 w-5 h-5 bg-destructive rounded border-2 border-white/90 shadow-lg flex items-center justify-center group">
            <div className="w-1 h-2 bg-white rounded-sm" />
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-card border border-white/20 text-foreground text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-xl">
              {selectedMax.toFixed(4)}
            </div>
          </div>
        </div>

        <div
          className={priceRangeSelectorStyles.rangeOverlay}
          style={{
            left: `${Math.max(0, Math.min(100, ((selectedMin - minPrice) / (maxPrice - minPrice)) * 100))}%`,
            width: `${Math.max(5, Math.min(100, ((selectedMax - selectedMin) / (maxPrice - minPrice)) * 100))}%`,
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>${minPrice.toFixed(2)}</span>
        <span>${currentPrice.toFixed(4)}</span>
        <span>${maxPrice.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="minPrice" className="block text-sm font-medium text-muted-foreground mb-2">
            Min price
          </label>
          <input
            id="minPrice"
            type="text"
            inputMode="decimal"
            value={minInputValue || selectedMin.toFixed(4)}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                setMinInputValue(value);
                if (value !== '') {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) handleMinChange(numValue);
                }
              }
            }}
            onBlur={() => { if (minInputValue === '') setMinInputValue(''); }}
            onFocus={() => { if (!minInputValue) setMinInputValue(selectedMin.toFixed(4)); }}
            className={priceRangeSelectorStyles.input}
          />
        </div>
        <div>
          <label htmlFor="maxPrice" className="block text-sm font-medium text-muted-foreground mb-2">
            Max price
          </label>
          <input
            id="maxPrice"
            type="text"
            inputMode="decimal"
            value={maxInputValue || selectedMax.toFixed(4)}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                setMaxInputValue(value);
                if (value !== '') {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) handleMaxChange(numValue);
                }
              }
            }}
            onBlur={() => { if (maxInputValue === '') setMaxInputValue(''); }}
            onFocus={() => { if (!maxInputValue) setMaxInputValue(selectedMax.toFixed(4)); }}
            className={priceRangeSelectorStyles.input}
          />
        </div>
      </div>
    </div>
  );
}
