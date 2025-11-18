import { useCallback } from 'react';
import { ContractId } from '@hashgraph/sdk';
import { useReadContract } from '@buidlerlabs/hashgraph-react-wallets';
import TorchPredictionMarketABI from '../../abi/TorchPredictionMarket.json';
import { ethers } from 'ethers';

interface SimulatePlaceBetResult {
  fee: ethers.BigNumber;
  stakeNet: ethers.BigNumber;
  sharpnessBps: ethers.BigNumber;
  timeBps: ethers.BigNumber;
  qualityBps: ethers.BigNumber;
  weight: ethers.BigNumber;
  bucket: ethers.BigNumber;
  isValid: boolean;
  errorMessage: string;
}

interface BetSimulation {
  fee: string;
  stakeNet: string;
  sharpnessBps: string;
  timeBps: string;
  qualityBps: string;
  weight: string;
  bucket: string;
  isValid: boolean;
  errorMessage: string;
}

export function useBetSimulation() {
  const { readContract } = useReadContract();

  const simulatePlaceBet = useCallback(
    async (
      targetTimestamp: string,
      priceMin: string,
      priceMax: string,
      stakeAmount?: string
    ): Promise<BetSimulation | null> => {
      try {
        const contractId = ContractId.fromString(process.env.NEXT_PUBLIC_CONTRACT_ID!);

        // Use provided stake or default to 1 HBAR
        const stake = stakeAmount && parseFloat(stakeAmount) > 0 ? stakeAmount : '1';

        // Contract expects basis points (1% = 100 BPS, so $0.15 = 1500 BPS)
        const priceMinBps = Math.round(parseFloat(priceMin) * 10000);
        const priceMaxBps = Math.round(parseFloat(priceMax) * 10000);

        const result = await readContract({
          address: `0x${contractId.toSolidityAddress()}`,
          abi: TorchPredictionMarketABI.abi,
          functionName: 'simulatePlaceBet',
          args: [
            targetTimestamp,
            priceMinBps, // Raw basis points
            priceMaxBps, // Raw basis points
            ethers.utils.parseEther(stake) // Wei format (correct)
          ],
        }) as SimulatePlaceBetResult;

        if (result) {
          return {
            fee: result.fee.toString(),
            stakeNet: result.stakeNet.toString(),
            sharpnessBps: result.sharpnessBps.toString(),
            timeBps: result.timeBps.toString(),
            qualityBps: result.qualityBps.toString(),
            weight: result.weight.toString(),
            bucket: result.bucket.toString(),
            isValid: result.isValid,
            errorMessage: result.errorMessage
          };
        }

        return null;
      } catch (error) {
        console.error('simulatePlaceBet error:', error);
        return null;
      }
    },
    [readContract]
  );

  return {
    simulatePlaceBet,
  };
}