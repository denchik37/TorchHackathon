'use client';

import React from 'react';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Bet } from '@/lib/types';
import { formatDateUTC, getRemainingDaysFromNow, formatTinybarsToHbar } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { betCardStyles } from './BetCard.styles';

export type BetStatus = 'active' | 'won' | 'lost' | 'unredeemed';

function getBetStatus(bet: Bet): BetStatus {
  if (!bet.finalized) return 'active';
  if (bet.won && !bet.claimed && bet.bucketRef?.aggregationComplete === true) return 'unredeemed';
  if (bet.won) return 'won';
  return 'lost';
}

function getStatusIcon(bet: Bet) {
  const status = getBetStatus(bet);
  switch (status) {
    case 'active':
      return <Clock className="w-4 h-4 text-primary" />;
    case 'won':
    case 'unredeemed':
      return <CheckCircle className="w-4 h-4 text-destructive" />;
    case 'lost':
      return <XCircle className="w-4 h-4 text-muted-foreground" />;
  }
}

function getStatusText(bet: Bet) {
  const status = getBetStatus(bet);
  switch (status) {
    case 'active':
      return 'Active';
    case 'won':
    case 'unredeemed':
      return 'Won';
    case 'lost':
      return 'Lost';
  }
}

function getDisplayPayout(bet: Bet): number {
  if (bet.won && bet.finalized && !bet.claimed && bet.bucketRef?.aggregationComplete) {
    return bet.expectedPayout;
  }
  if (bet.finalized) return bet.payout;
  return Math.floor(
    Number(bet.stake) + (Number(bet.stake) * (bet.qualityBps || 0)) / 10000
  );
}

export interface BetCardProps {
  bet: Bet;
  onRedeem: (betId: string) => void;
  redeemingBetId: string | null;
}

export const BetCard = React.memo(function BetCard({ bet, onRedeem, redeemingBetId }: BetCardProps) {
  const status = getBetStatus(bet);
  const remainingDays = getRemainingDaysFromNow(bet.targetTimestamp);

  const statusClass =
    status === 'won' || status === 'unredeemed'
      ? betCardStyles.statusWon
      : status === 'lost'
        ? betCardStyles.statusLost
        : betCardStyles.statusActive;

  return (
    <Card className={betCardStyles.card}>
      <CardContent className={betCardStyles.content}>
        <div className={betCardStyles.header}>
          <div className="flex items-center gap-3">
            {getStatusIcon(bet)}
            <span className={betCardStyles.statusBadge + ' ' + statusClass}>{getStatusText(bet)}</span>
          </div>
          <span className={betCardStyles.label + ' shrink-0'}>{formatDateUTC(bet.targetTimestamp)}</span>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <p className={betCardStyles.label}>Price range</p>
              <p className={betCardStyles.value + ' font-mono'}>
                ${formatTinybarsToHbar(bet.priceMin, 4)} – ${formatTinybarsToHbar(bet.priceMax, 4)}
              </p>
            </div>

            {status === 'active' && (
              <div className="text-right">
                <p className={betCardStyles.value + ' text-lg'}>{remainingDays === 0 ? 'Today' : remainingDays}</p>
                <p className={betCardStyles.label}>{remainingDays === 0 ? 'resolves today' : 'days remaining'}</p>
              </div>
            )}

            {status === 'won' && bet.claimed && (
              <div className="flex items-center gap-1.5 text-destructive">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Redeemed</span>
              </div>
            )}

            {status === 'unredeemed' && (
              <Button
                className={betCardStyles.redeemButton}
                onClick={() => onRedeem(bet.id)}
                disabled={redeemingBetId === bet.id}
              >
                {redeemingBetId === bet.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Redeeming…
                  </>
                ) : (
                  'Redeem'
                )}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <p className={betCardStyles.label}>Amount bet</p>
              <p className={betCardStyles.value}>{formatTinybarsToHbar(bet.stake, 2)} HBAR</p>
            </div>

            {(bet.payout || bet.expectedPayout || !bet.finalized) && (
              <div className="text-right">
                <p className={betCardStyles.label}>
                  {status === 'won' || status === 'unredeemed' ? 'Payout' : 'Potential payout'}
                </p>
                <p className={status === 'won' || status === 'unredeemed' ? betCardStyles.valueGreen : betCardStyles.value}>
                  {formatTinybarsToHbar(getDisplayPayout(bet), 2)} HBAR
                </p>
              </div>
            )}
          </div>
        </div>

        <div className={betCardStyles.footer}>
          <span>Placed: {formatDateUTC(bet.timestamp)}</span>
          <span className="font-mono text-muted-foreground">ID: {bet.id}</span>
        </div>
      </CardContent>
    </Card>
  );
});
