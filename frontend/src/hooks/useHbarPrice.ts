import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

interface HbarPriceData {
  price: number;
  priceChangePercentage: number;
  lastUpdated: Date;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  retryFetch: () => void;
}

export function useHbarPrice() {
  const [priceData, setPriceData] = useState<Omit<HbarPriceData, 'isStale' | 'retryFetch'>>({
    price: 0,
    priceChangePercentage: 0,
    lastUpdated: new Date(),
    isLoading: true,
    error: null,
  });

  const fetchChainlinkPrice = useCallback(async () => {
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
        inputs: [{ name: '_roundId', type: 'uint80' }],
        name: 'getRoundData',
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

    const provider = new ethers.providers.JsonRpcProvider('https://mainnet.hashio.io/api');
    const contract = new ethers.Contract(HBAR_USD_FEED_ADDRESS, ABI, provider);

    const [latestRoundId, latestAnswer, , latestUpdatedAt] = await contract.latestRoundData();
    const decimals = await contract.decimals();

    const currentPrice = parseFloat(ethers.utils.formatUnits(latestAnswer, decimals));
    let priceChangePercentage = 0;

    // Try to get historical data using known valid round ID structure
    try {
      // Try a few rounds back to find historical data
      const roundsToTry = [5, 10, 20, 50];

      for (const roundsBack of roundsToTry) {
        try {
          const historicalRoundId = latestRoundId.sub(roundsBack);
          const [, historicalAnswer, , historicalUpdatedAt] =
            await contract.getRoundData(historicalRoundId);

          if (historicalUpdatedAt.toNumber() > 0) {
            const timeDiff = latestUpdatedAt.toNumber() - historicalUpdatedAt.toNumber();

            // If we found data that's at least 1 hour old, use it
            if (timeDiff >= 3600) {
              const historicalPrice = parseFloat(
                ethers.utils.formatUnits(historicalAnswer, decimals)
              );
              priceChangePercentage = ((currentPrice - historicalPrice) / historicalPrice) * 100;
              break;
            }
          }
        } catch (error) {
          // This round doesn't exist, try next
          continue;
        }
      }
    } catch (error) {
      console.warn('Could not fetch historical price data:', error);
    }

    return { price: currentPrice, priceChangePercentage };
  }, []);

  const fetchHbarPriceData = useCallback(async () => {
    try {
      setPriceData((prev) => ({ ...prev, isLoading: true, error: null }));

      const { price, priceChangePercentage } = await fetchChainlinkPrice();

      setPriceData({
        price,
        priceChangePercentage,
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
  }, [fetchChainlinkPrice]);

  useEffect(() => {
    fetchHbarPriceData();

    const interval = setInterval(fetchHbarPriceData, 30000);

    return () => clearInterval(interval);
  }, [fetchHbarPriceData]);

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
