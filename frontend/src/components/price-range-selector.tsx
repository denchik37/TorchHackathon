'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cn, formatTinybarsToHbar } from '@/lib/utils';
import { gql, useQuery } from '@apollo/client';

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

// Helper function to get day's timestamp range
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

interface PriceRangeSelectorProps {
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

  // Update selected range when price props change
  useEffect(() => {
    setSelectedMin(minPrice + (maxPrice - minPrice) * 0.1);
    setSelectedMax(maxPrice - (maxPrice - minPrice) * 0.1);
  }, [minPrice, maxPrice]);

  // Get timestamp range for the selected day
  const { startTimestamp, endTimestamp } = getDayTimestampRange(selectedDate);

  // Fetch real bet data for the selected day
  const { data: betsData, loading: betsLoading } = useQuery(GET_BETS_FOR_DAY, {
    variables: { startTimestamp, endTimestamp },
    fetchPolicy: 'cache-and-network',
  });

  // Calculate total volume for the day
  const totalVolumeHbar = useMemo(() => {
    if (betsLoading || !betsData?.bets) return 0;

    return betsData.bets.reduce((sum: number, bet: any) => {
      return sum + parseFloat(formatTinybarsToHbar(bet.stake));
    }, 0);
  }, [betsData, betsLoading]);

  // Generate Torch Confidence Chart data - 31-bin confidence distribution
  const histogramData = useMemo(() => {
    const bins = 31; // Torch specification: 31 bins
    const binSize = (maxPrice - minPrice) / bins;
    
    if (betsLoading || !betsData?.bets) {
      // Show loading placeholder
      const data = [];
      for (let i = 0; i < bins; i++) {
        const binMin = minPrice + i * binSize;
        const binMax = binMin + binSize;
        const center = (binMin + binMax) / 2;

        data.push({
          min: binMin,
          max: binMax,
          center,
          prob: 0, // confidence score (height)
          totalStake: 0, // money supporting this region
          rawScore: 0, // unnormalized influence
          amount: 0, // for backward compatibility
          isSelected: center >= selectedMin && center <= selectedMax,
        });
      }
      return data;
    }

    // Calculate confidence distribution based on all active bets
    const data = [];
    const totalStakeAcrossAllBets = betsData.bets.reduce((sum: number, bet: any) => {
      return sum + parseFloat(formatTinybarsToHbar(bet.stake));
    }, 0);

    for (let i = 0; i < bins; i++) {
      const binMin = minPrice + i * binSize;
      const binMax = binMin + binSize;
      const center = (binMin + binMax) / 2;

      // Find bets that overlap with this price bin
      const betsInBin = betsData.bets.filter((bet: any) => {
        const betMinPrice = parseFloat(formatTinybarsToHbar(bet.priceMin));
        const betMaxPrice = parseFloat(formatTinybarsToHbar(bet.priceMax));
        return betMinPrice <= binMax && betMaxPrice >= binMin;
      });

      // Calculate confidence metrics for this bin
      const totalStakeInBin = betsInBin.reduce((sum: number, bet: any) => {
        const stake = parseFloat(formatTinybarsToHbar(bet.stake));
        const betMinPrice = parseFloat(formatTinybarsToHbar(bet.priceMin));
        const betMaxPrice = parseFloat(formatTinybarsToHbar(bet.priceMax));
        
        // Weight stake by overlap with bin (more precise confidence calculation)
        const overlapMin = Math.max(binMin, betMinPrice);
        const overlapMax = Math.min(binMax, betMaxPrice);
        const overlapRatio = Math.max(0, (overlapMax - overlapMin) / (betMaxPrice - betMinPrice));
        
        return sum + (stake * overlapRatio);
      }, 0);

      // Raw score - unnormalized influence
      const rawScore = totalStakeInBin;
      
      // Confidence probability - normalized by total market stake
      const prob = totalStakeAcrossAllBets > 0 ? (totalStakeInBin / totalStakeAcrossAllBets) : 0;

      data.push({
        min: binMin,
        max: binMax,
        center,
        prob, // confidence score (height of bar)
        totalStake: totalStakeInBin, // money supporting this region
        rawScore, // unnormalized influence
        amount: totalStakeInBin, // for backward compatibility
        isSelected: center >= selectedMin && center <= selectedMax,
      });
    }

    return data;
  }, [minPrice, maxPrice, selectedMin, selectedMax, betsData, betsLoading]);

  const maxBetAmount = Math.max(...histogramData.map((d) => d.amount));
  const maxProb = Math.max(...histogramData.map((d) => d.prob));

  const handleMinChange = (value: number) => {
    // Allow values below minPrice for user flexibility
    const newMin = Math.min(value, selectedMax - 0.0001);
    setSelectedMin(newMin);
    onRangeChange(newMin, selectedMax);
  };

  const handleMaxChange = (value: number) => {
    // Allow values above maxPrice for user flexibility
    const newMax = Math.max(value, selectedMin + 0.0001);
    setSelectedMax(newMax);
    onRangeChange(selectedMin, newMax);
  };

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
    if (isMin) {
      setIsDraggingMin(true);
    } else {
      setIsDraggingMax(true);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingMin && !isDraggingMax) return;

      const newPrice = getPriceFromPosition(e.clientX);

      if (isDraggingMin) {
        handleMinChange(newPrice);
      } else if (isDraggingMax) {
        handleMaxChange(newPrice);
      }
    },
    [isDraggingMin, isDraggingMax, getPriceFromPosition]
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
    <div className={cn('space-y-4', className)}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border border-[#F5A623] text-[#F5A623] text-sm font-bold rounded-full flex items-center justify-center">
            2
          </div>
          <h3 className="text-sm font-medium text-medium-gray">Select price range</h3>
        </div>

        <span className="text-sm text-medium-gray">
          Total volume: {totalVolumeHbar.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
          HBAR
        </span>
      </div>

      {/* Histogram */}
      <div ref={containerRef} className="relative h-40 bg-neutral-900 rounded-lg  cursor-crosshair">
        {/* Confidence distribution bars - 31 bins */}
        <div className="flex items-end justify-between h-full space-x-0.5">
          {histogramData.map((bin, index) => (
            <div
              key={index}
              className={cn('flex-1 bg-[#3B2D72] rounded-t transition-all duration-200')}
              style={{
                height: `${bin.prob > 0 ? Math.max(8, (bin.prob / maxProb) * 100) : 0}%`,
                opacity: bin.isSelected ? 1 : 0.7,
              }}
            />
          ))}
        </div>


        {/* Current price indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-bright-green pointer-events-none"
          style={{
            left: `${((currentPrice - minPrice) / (maxPrice - minPrice)) * 100}%`,
          }}
        >
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-bright-green rounded-full border-2 border-dark-slate" />
        </div>

        {/* Min range slider */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-1 cursor-ew-resize select-none',
            isDraggingMin ? 'z-20' : 'z-10'
          )}
          style={{
            left: `${Math.max(0, Math.min(100, ((selectedMin - minPrice) / (maxPrice - minPrice)) * 100))}%`,
          }}
          onMouseDown={(e) => handleMouseDown(e, true)}
        >
          {/* Slider line */}
          <div className="absolute top-0 bottom-0 w-full bg-vibrant-purple" />

          {/* Slider handle */}
          <div className="absolute top-1/2 transform -translate-y-1/2 -left-2 w-5 h-5 bg-vibrant-purple rounded border-2 border-white shadow-lg flex items-center justify-center group">
            <div className="w-1 h-2 bg-white rounded-sm" />

            {/* Price label (hidden by default, shown on hover) */}
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200">
              {selectedMin.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Max range slider */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-1 cursor-ew-resize select-none',
            isDraggingMax ? 'z-20' : 'z-10'
          )}
          style={{
            left: `${Math.max(0, Math.min(100, ((selectedMax - minPrice) / (maxPrice - minPrice)) * 100))}%`,
          }}
          onMouseDown={(e) => handleMouseDown(e, false)}
        >
          {/* Slider line */}
          <div className="absolute top-0 bottom-0 w-full bg-bright-green" />

          {/* Slider handle */}
          <div className="absolute top-1/2 transform -translate-y-1/2 -left-2 w-5 h-5 bg-bright-green rounded border-2 border-white shadow-lg flex items-center justify-center group">
            <div className="w-1 h-2 bg-white rounded-sm" />

            {/* Price label (hidden by default, shown on hover) */}
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200">
              {selectedMax.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Selected range highlight - semitransparent area between sliders */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-10"
          style={{
            left: `${Math.max(0, Math.min(100, ((selectedMin - minPrice) / (maxPrice - minPrice)) * 100))}%`,
            width: `${Math.max(5, Math.min(100, ((selectedMax - selectedMin) / (maxPrice - minPrice)) * 100))}%`,
            backgroundColor: 'rgba(200, 170, 255, 0.08)', // Much lighter purple with very low opacity
          }}
        />
      </div>

      {/* Price labels */}
      <div className="flex justify-between text-xs text-medium-gray">
        <span>${minPrice.toFixed(2)}</span>
        <span>${currentPrice.toFixed(4)}</span>
        <span>${maxPrice.toFixed(2)}</span>
      </div>

      {/* Range inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="minPrice" className="block text-sm font-medium text-medium-gray mb-2 ">
            Min price
          </label>
          <input
            id="minPrice"
            type="text"
            inputMode="decimal"
            value={minInputValue || selectedMin.toFixed(4)}
            onChange={(e) => {
              const value = e.target.value;
              // Allow only numbers, dots, and empty string (including leading zeros)
              if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                setMinInputValue(value);
                if (value !== '') {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                    handleMinChange(numValue);
                  }
                }
              }
            }}
            onBlur={() => {
              // Reset to computed value when losing focus if invalid
              if (minInputValue === '') {
                setMinInputValue('');
              }
            }}
            onFocus={() => {
              // Clear computed value when focusing to allow free typing
              if (!minInputValue) {
                setMinInputValue(selectedMin.toFixed(4));
              }
            }}
            className="w-full px-3 py-2 border border-input bg-neutral-900 rounded-md text-sm text-medium-gray"
          />
        </div>
        <div>
          <label htmlFor="maxPrice" className="block text-sm font-medium text-medium-gray mb-2">
            Max price
          </label>
          <input
            id="maxPrice"
            type="text"
            inputMode="decimal"
            value={maxInputValue || selectedMax.toFixed(4)}
            onChange={(e) => {
              const value = e.target.value;
              // Allow only numbers, dots, and empty string (including leading zeros)
              if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                setMaxInputValue(value);
                if (value !== '') {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                    handleMaxChange(numValue);
                  }
                }
              }
            }}
            onBlur={() => {
              // Reset to computed value when losing focus if invalid
              if (maxInputValue === '') {
                setMaxInputValue('');
              }
            }}
            onFocus={() => {
              // Clear computed value when focusing to allow free typing
              if (!maxInputValue) {
                setMaxInputValue(selectedMax.toFixed(4));
              }
            }}
            className="w-full px-3 py-2 border border-input bg-neutral-900 rounded-md text-sm text-medium-gray"
          />
        </div>
      </div>
    </div>
  );
}
