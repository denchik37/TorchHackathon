'use client';

import React from 'react';
import Image from 'next/image';
import { TrendingUp, TrendingDown, RefreshCw, RotateCcw } from 'lucide-react';
import { useHbarPrice } from '@/hooks/useHbarPrice';

interface HbarPriceDisplayProps {
  showChange?: boolean;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function HbarPriceDisplay({
  showChange = true,
  showIcon = true,
  className = '',
  size = 'md',
}: HbarPriceDisplayProps) {
  const { price, priceChangePercentage, isLoading, error, isStale, retryFetch } = useHbarPrice();

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const imageSizes = {
    sm: { width: 12, height: 12 },
    md: { width: 16, height: 16 },
    lg: { width: 20, height: 20 },
  };

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <RefreshCw className={`${iconSizes[size]} animate-spin text-medium-gray`} />
        <span className={`${sizeClasses[size]} text-medium-gray`}>Loading...</span>
      </div>
    );
  }

  if (error && !isStale) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <span className={`${sizeClasses[size]} text-red-500`}>Price unavailable</span>
        <button
          onClick={retryFetch}
          className={`${iconSizes[size]} text-red-500 hover:text-red-400 transition-colors`}
          title="Retry fetching price"
        >
          <RotateCcw className="w-full h-full" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {showIcon && (
        <Image
          src="/hedera.svg"
          alt="Hedera"
          width={imageSizes[size].width}
          height={imageSizes[size].height}
          className="flex-shrink-0"
        />
      )}
      <span className={`${sizeClasses[size]} text-light-gray ${isStale ? 'opacity-60' : ''}`}>
        ${price.toFixed(4)}
        {isStale && (
          <span className="text-yellow-500 ml-1 flex items-center">
            <RefreshCw className={`${iconSizes[size]} animate-spin mr-1`} />
            cached
          </span>
        )}
      </span>

      {showChange && priceChangePercentage !== 0 && (
        <div
          className={`flex items-center space-x-1 ${priceChangePercentage > 0 ? 'text-green-500' : 'text-red-500'} ${isStale ? 'opacity-60' : ''}`}
        >
          {priceChangePercentage > 0 ? (
            <TrendingUp className={iconSizes[size]} />
          ) : (
            <TrendingDown className={iconSizes[size]} />
          )}
          <span className={`${sizeClasses[size]}`}>
            {Math.abs(priceChangePercentage).toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}
