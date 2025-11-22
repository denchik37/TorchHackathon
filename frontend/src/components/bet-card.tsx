'use client';

import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Bet } from '@/lib/types';
import { formatDateUTC, getRemainingDaysFromNow, formatTinybarsToHbar } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type BetStatus = 'active' | 'won' | 'lost' | 'unredeemed';

const getBetStatus = (bet: Bet): BetStatus => {
  if (!bet.finalized) return 'active';
  if (bet.won && !bet.claimed && bet.bucketRef?.aggregationComplete === true) return 'unredeemed';
  if (bet.won) return 'won';
  return 'lost';
};

const getStatusIcon = (bet: Bet) => {
  const status = getBetStatus(bet);
  switch (status) {
    case 'active':
      return <Clock className="w-4 h-4 text-vibrant-purple" />;
    case 'won':
    case 'unredeemed':
      return <CheckCircle className="w-4 h-4 text-bright-green" />;
    case 'lost':
      return <XCircle className="w-4 h-4 text-medium-gray" />;
  }
};

const getStatusText = (bet: Bet) => {
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
};

interface BetCardProps {
  bet: Bet;
  onRedeem: (betId: string) => void;
  redeemingBetId: string | null;
}

export function BetCard({ bet, onRedeem, redeemingBetId }: BetCardProps) {
  const status = getBetStatus(bet);
  const remainingDays = getRemainingDaysFromNow(bet.targetTimestamp);

  return (
    <Card className="bg-neutral-950 border-neutral-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getStatusIcon(bet)}
            <span
              className={`text-sm font-semibold ${
                status === 'won' || status === 'unredeemed'
                  ? 'text-bright-green'
                  : status === 'lost'
                    ? 'text-red-500'
                    : 'text-vibrant-purple'
              }`}
            >
              {getStatusText(bet)}
            </span>
          </div>
          <div className="text-sm text-medium-gray">
            {formatDateUTC(bet.targetTimestamp)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left side - Bet details */}
          <div className="space-y-4">
            <div>
              <span className="text-xs text-medium-gray">Price Range</span>
              <div className="text-light-gray font-mono">
                ${formatTinybarsToHbar(bet.priceMin, 4)} - $
                {formatTinybarsToHbar(bet.priceMax, 4)}
              </div>
            </div>

            <div>
              <span className="text-xs text-medium-gray">Amount Bet</span>
              <div className="text-light-gray font-mono">
                {formatTinybarsToHbar(bet.stake, 2)} HBAR
              </div>
            </div>

            {(bet.payout || !bet.finalized) && (
              <div>
                <span className="text-xs text-medium-gray">
                  {status === 'won' || status === 'unredeemed'
                    ? 'Payout'
                    : 'Potential Payout'}
                </span>
                <div
                  className={`font-mono font-semibold ${
                    status === 'won' || status === 'unredeemed'
                      ? 'text-bright-green'
                      : 'text-light-gray'
                  }`}
                >
                  {bet.finalized
                    ? formatTinybarsToHbar(bet.payout, 2)
                    : formatTinybarsToHbar(
                        Math.floor(
                          Number(bet.stake) +
                            (Number(bet.stake) * (bet.qualityBps || 0)) / 10000
                        ),
                        2
                      )}{' '}
                  HBAR
                </div>
              </div>
            )}
          </div>

          {/* Right side - Status and actions */}
          <div className="flex flex-col justify-between items-end">
            {status === 'active' && (
              <div className="text-right">
                <div className="text-2xl font-bold text-light-gray">
                  {remainingDays === 0 ? 'Today' : remainingDays}
                </div>
                <div className="text-xs text-medium-gray">
                  {remainingDays === 0 ? 'resolves today' : 'days remaining'}
                </div>
              </div>
            )}

            {status === 'won' && bet.claimed && (
              <div className="flex items-center space-x-1 text-bright-green">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Redeemed</span>
              </div>
            )}

            {status === 'unredeemed' && (
              <Button
                className="bg-bright-green hover:bg-bright-green/90 text-black font-semibold"
                onClick={() => onRedeem(bet.id)}
                disabled={redeemingBetId === bet.id}
              >
                {redeemingBetId === bet.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Redeeming...
                  </>
                ) : (
                  'Redeem'
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
          <span className="text-xs text-medium-gray">
            Placed: {formatDateUTC(bet.timestamp)}
          </span>
          <span className="text-xs text-medium-gray">Bet ID: {bet.id}</span>
        </div>
      </CardContent>
    </Card>
  );
}