import { request, gql } from 'graphql-request';
import type { SubgraphBet, UnresolvedWork } from '../types.js';
import { getEnv } from '../config/env.js';
import { logger } from '../logger.js';

const GET_UNRESOLVED_BETS = gql`
  query GetUnresolvedBets {
    bets(
      where: { bucketRef_: { aggregationComplete: false }, finalized: false }
      orderBy: bucket
      orderDirection: asc
      first: 1000
    ) {
      id
      stake
      priceMin
      priceMax
      timestamp
      targetTimestamp
      bucket
      bucketRef {
        id
        aggregationComplete
        nextProcessIndex
        totalBets
        totalWinningWeight
        totalStaked
      }
    }
  }
`;

export async function fetchUnresolvedBets(): Promise<UnresolvedWork> {
  const { SUBGRAPH_URL } = getEnv();
  const data = await request<{ bets: SubgraphBet[] }>(SUBGRAPH_URL, GET_UNRESOLVED_BETS);
  const bets = data.bets ?? [];

  const bucketsById = new Map<string, SubgraphBet['bucketRef']>();
  const timestampsToBets = new Map<number, SubgraphBet[]>();
  const timestampsToBuckets = new Map<number, number[]>();

  for (const bet of bets) {
    const ts = Number(bet.targetTimestamp);
    const bucketId = bet.bucketRef.id;

    if (!bucketsById.has(bucketId)) {
      bucketsById.set(bucketId, bet.bucketRef);
    }

    const list = timestampsToBets.get(ts) ?? [];
    list.push(bet);
    timestampsToBets.set(ts, list);

    const buckets = timestampsToBuckets.get(ts) ?? [];
    if (!buckets.includes(bet.bucket)) {
      buckets.push(bet.bucket);
      timestampsToBuckets.set(ts, buckets);
    }
  }

  logger.info({ betCount: bets.length, bucketCount: bucketsById.size }, 'Fetched unresolved work');
  return {
    bets,
    bucketsById,
    timestampsToBets,
    timestampsToBuckets,
  };
}
