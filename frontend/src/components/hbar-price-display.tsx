'use client';

import React from 'react';
import Image from 'next/image';
import { RefreshCw, RotateCcw } from 'lucide-react';

interface HbarPriceDisplayProps {
  price: number;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  retryFetch?: () => void;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function HbarPriceDisplay({
  price,
  isLoading,
  error,
  isStale,
  retryFetch,
  showIcon = true,
  className = '',
  size = 'md',
}: HbarPriceDisplayProps) {

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

  if (isLoading && price === 0) {
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
        {retryFetch && (
          <button
            onClick={retryFetch}
            className={`${iconSizes[size]} text-red-500 hover:text-red-400 transition-colors`}
            title="Retry fetching price"
          >
            <RotateCcw className="w-full h-full" />
          </button>
        )}
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
    </div>
  );
}
