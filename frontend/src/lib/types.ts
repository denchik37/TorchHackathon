export interface User {
  id: string;
  bets: Bet[];
  totalBets: number;
  totalStaked: number;
  totalPayout: number;
}

export interface Bucket {
  id: string;
  aggregationComplete: boolean;
  nextProcessIndex?: number;
  totalBets?: number;
  totalWinningWeight?: string;
  totalStaked?: string;
}

export interface Bet {
  id: string;
  user: User;
  stake: number;
  priceMin: number;
  priceMax: number;
  timestamp: number;
  targetTimestamp: number;
  payout: number;
  expectedPayout: number;
  claimed: boolean;
  finalized: boolean;
  won: boolean;
  weight: number;
  qualityBps?: number;
  bucket: number;
  bucketRef?: Bucket;
}
