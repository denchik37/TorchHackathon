'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { noBetsCardStyles } from './NoBetsCard.styles';

export interface NoBetsCardProps {
  activeCategory: string;
}

function getMessage(activeCategory: string): string {
  switch (activeCategory) {
    case 'active':
      return 'You have no active bets at the moment';
    case 'unredeemed':
      return 'All your winnings have been redeemed';
    case 'complete':
      return 'You have no completed bets';
    case 'all':
    default:
      return 'No bets match the current filter';
  }
}

export const NoBetsCard = React.memo(function NoBetsCard({ activeCategory }: NoBetsCardProps) {
  return (
    <Card className={noBetsCardStyles.card}>
      <CardContent className={noBetsCardStyles.content}>
        <div className="flex flex-col items-center">
          <div className={noBetsCardStyles.iconWrap}>
            <Clock className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className={noBetsCardStyles.title}>No bets found</h3>
          <p className={noBetsCardStyles.description}>{getMessage(activeCategory)}</p>
        </div>
      </CardContent>
    </Card>
  );
});
