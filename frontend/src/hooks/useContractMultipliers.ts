import { useCallback } from 'react';
import { ContractId } from '@hashgraph/sdk';
import { useReadContract } from '@buidlerlabs/hashgraph-react-wallets';
import TorchPredictionMarketABI from '../../abi/TorchPredictionMarket.json';

export function useContractMultipliers() {
  const { readContract } = useReadContract();

  const getSharpnessMultiplier = useCallback(
    async (priceMin: string, priceMax: string): Promise<string | null> => {
      try {
        const contractId = ContractId.fromString(process.env.NEXT_PUBLIC_CONTRACT_ID!);

        const result = await readContract({
          address: `0x${contractId.toSolidityAddress()}`,
          abi: TorchPredictionMarketABI.abi,
          functionName: 'getSharpnessMultiplier',
          args: [priceMin, priceMax],
        });

        return result ? result.toString() : null;
      } catch (error) {
        return null;
      }
    },
    [readContract]
  );

  const getTimeMultiplier = useCallback(
    async (targetTimestamp: string): Promise<string | null> => {
      try {
        const contractId = ContractId.fromString(process.env.NEXT_PUBLIC_CONTRACT_ID!);

        const result = await readContract({
          address: `0x${contractId.toSolidityAddress()}`,
          abi: TorchPredictionMarketABI.abi,
          functionName: 'getTimeMultiplier',
          args: [targetTimestamp],
        });

        return result ? result.toString() : null;
      } catch (error) {
        return null;
      }
    },
    [readContract]
  );

  return {
    getSharpnessMultiplier,
    getTimeMultiplier,
  };
}
