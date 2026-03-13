export interface SubgraphBet {
  id: string;
  stake: string;
  priceMin: string;
  priceMax: string;
  timestamp: string;
  targetTimestamp: string;
  bucket: number;
  bucketRef: {
    id: string;
    aggregationComplete: boolean;
    nextProcessIndex: number;
    totalBets: number;
    totalWinningWeight: string;
    totalStaked: string;
  };
}

export interface UnresolvedWork {
  bets: SubgraphBet[];
  bucketsById: Map<string, SubgraphBet['bucketRef']>;
  timestampsToBets: Map<number, SubgraphBet[]>;
  timestampsToBuckets: Map<number, number[]>;
}

export type PriceCheckStatus = 'accepted' | 'blocked';

export interface PriceCheckResult {
  timestamp: number;
  coinGeckoPrice: number | null;
  oraclePrice: number | null;
  divergencePct: number | null;
  status: PriceCheckStatus;
  reason?: string;
}

export interface ResolverRunArtifact {
  runId: string;
  timestampUtc: string;
  mode: 'dryRun' | 'live';
  unresolvedCounts: {
    bets: number;
    buckets: number;
    uniqueTimestamps: number;
  };
  eligibleTimestamps: number[];
  skippedTooSoon: number[];
  skippedTooOld: number[];
  priceChecks: PriceCheckResult[];
  txs: {
    setPricesBatchTxIds: string[];
    processBatchTxIds: { bucketId: string; txIds: string[] }[];
  };
  bucketResults: {
    bucketId: string;
    processedTxCount: number;
    completed: boolean;
    nextProcessIndex?: number;
    totalBets?: number;
  }[];
  errors: { message: string; stack?: string }[];
}

export interface ResolverState {
  lastRunAt: string | null;
  blockedTimestamps: Record<
    string,
    { reason: string; lastSeenAt: string }
  >;
  resolvedTimestamps: Record<string, string>;
}
