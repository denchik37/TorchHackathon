import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

interface HbarPriceData {
  price: number;
  lastUpdated: Date;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  retryFetch: () => void;
}

const HBAR_USD_FEED_ADDRESS = '0xAF685FB45C12b92b5054ccb9313e135525F9b5d5';
const ABI = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// Create provider and contract outside the hook to avoid recreating on every call
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.hashio.io/api');
const contract = new ethers.Contract(HBAR_USD_FEED_ADDRESS, ABI, provider);

export function useHbarPrice() {
  const [priceData, setPriceData] = useState<Omit<HbarPriceData, 'isStale' | 'retryFetch'>>({
    price: 0,
    lastUpdated: new Date(),
    isLoading: true,
    error: null,
  });

  const fetchChainlinkPrice = useCallback(async () => {
    const [latestRoundId, latestAnswer, , latestUpdatedAt] = await contract.latestRoundData();
    const decimals = await contract.decimals();
    const currentPrice = parseFloat(ethers.utils.formatUnits(latestAnswer, decimals));

    return { price: currentPrice };
  }, []);

  const fetchHbarPriceData = useCallback(async () => {
    try {
      // Only clear error on updates, don't change loading state for background updates
      setPriceData((prev) => ({ ...prev, error: null }));

      const { price } = await fetchChainlinkPrice();

      setPriceData({
        price,
        lastUpdated: new Date(),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setPriceData((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch HBAR price',
      }));
    }
  }, []);

  useEffect(() => {
    fetchHbarPriceData();
  }, []);

  // Separate effect for interval to avoid Strict Mode issues
  useEffect(() => {
    const interval = setInterval(() => {
      fetchHbarPriceData();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Calculate if data is stale (older than 5 minutes)
  const isStale =
    !priceData.isLoading &&
    !priceData.error &&
    Date.now() - priceData.lastUpdated.getTime() > 5 * 60 * 1000;

  return {
    ...priceData,
    isStale,
    retryFetch: fetchHbarPriceData,
  };
}
