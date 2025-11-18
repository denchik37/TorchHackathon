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
  claimed: boolean;
  finalized: boolean;
  won: boolean;
  weight: number;
  qualityBps?: number;
  bucket: number;
  bucketRef?: Bucket;
}
