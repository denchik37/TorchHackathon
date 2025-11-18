export interface User {
  id: string;
  bets: Bet[];
  totalBets: number;
  totalStaked: number;
  totalPayout: number;
}

export interface Bucket {
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
  bucket?: Bucket;
}
