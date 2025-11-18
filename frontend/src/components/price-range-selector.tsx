'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface PriceRangeSelectorProps {
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
  totalBets: number;
  onRangeChange: (min: number, max: number) => void;
  className?: string;
}

export function PriceRangeSelector({
  minPrice,
  maxPrice,
  currentPrice,
  totalBets,
  onRangeChange,
  className,
}: PriceRangeSelectorProps) {
  const [selectedMin, setSelectedMin] = useState(minPrice + (maxPrice - minPrice) * 0.2);
  const [selectedMax, setSelectedMax] = useState(maxPrice - (maxPrice - minPrice) * 0.2);
  const [isDraggingMin, setIsDraggingMin] = useState(false);
  const [isDraggingMax, setIsDraggingMax] = useState(false);
  const [minInputValue, setMinInputValue] = useState('');
  const [maxInputValue, setMaxInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate histogram data (simulated bet distribution)
  const histogramData = useMemo(() => {
    const buckets = 30; // More buckets for smoother histogram
    const bucketSize = (maxPrice - minPrice) / buckets;
    const data = [];

    for (let i = 0; i < buckets; i++) {
      const bucketMin = minPrice + i * bucketSize;
      const bucketMax = bucketMin + bucketSize;
      const bucketCenter = (bucketMin + bucketMax) / 2;

      // Simulate bet distribution with a normal-like curve
      const distanceFromCurrent = Math.abs(bucketCenter - currentPrice);
      const maxDistance = (maxPrice - minPrice) / 2;
      const normalizedDistance = distanceFromCurrent / maxDistance;

      // Create a bell curve around current price
      const betDensity = Math.exp(-Math.pow(normalizedDistance * 2, 2));
      const betAmount = Math.floor((betDensity * totalBets) / 15) + Math.random() * 30;

      data.push({
        min: bucketMin,
        max: bucketMax,
        center: bucketCenter,
        amount: betAmount,
        isSelected: bucketCenter >= selectedMin && bucketCenter <= selectedMax,
      });
    }

    return data;
  }, [minPrice, maxPrice, currentPrice, totalBets, selectedMin, selectedMax]);

  const maxBetAmount = Math.max(...histogramData.map((d) => d.amount));

  const handleMinChange = (value: number) => {
    if (value < minPrice) {
      return;
    }

    const newMin = Math.min(value, selectedMax - 0.01);
    setSelectedMin(newMin);
    onRangeChange(newMin, selectedMax);
  };

  const handleMaxChange = (value: number) => {
    if (value > maxPrice) {
      return;
    }

    const newMax = Math.max(value, selectedMin + 0.01);
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

  React.useEffect(() => {
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
        <h3 className="text-sm font-medium text-medium-gray">Select Price Range</h3>

        <span className="text-sm text-medium-gray">
          Total bets: {totalBets.toLocaleString()} HBAR
        </span>
      </div>

      {/* Histogram */}
      <div ref={containerRef} className="relative h-40 bg-neutral-900 rounded-lg  cursor-crosshair">
        {/* Histogram bars */}
        <div className="flex items-end justify-between h-full space-x-0.5">
          {histogramData.map((bucket, index) => (
            <div
              key={index}
              className={cn(
                'flex-1 bg-vibrant-purple/30 rounded-t transition-all duration-200',
                bucket.isSelected && 'bg-vibrant-purple'
              )}
              style={{
                height: `${(bucket.amount / maxBetAmount) * 100}%`,
                minHeight: '4px',
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
            left: `${((selectedMin - minPrice) / (maxPrice - minPrice)) * 100}%`,
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
            left: `${((selectedMax - minPrice) / (maxPrice - minPrice)) * 100}%`,
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

        {/* Selected range highlight */}
        <div
          className="absolute top-0 bottom-0 bg-vibrant-purple/20 pointer-events-none"
          style={{
            left: `${((selectedMin - minPrice) / (maxPrice - minPrice)) * 100}%`,
            width: `${((selectedMax - selectedMin) / (maxPrice - minPrice)) * 100}%`,
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
            Min Price
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
            Max Price
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