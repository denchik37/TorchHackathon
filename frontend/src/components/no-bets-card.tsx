'use client';

import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface NoBetsCardProps {
  activeCategory: string;
}

export function NoBetsCard({ activeCategory }: NoBetsCardProps) {
  const getMessage = () => {
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
  };

  return (
    <Card className="bg-neutral-950 border-neutral-800">
      <CardContent className="p-12 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-medium-gray" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-light-gray">No bets found</h3>
            <p className="text-sm text-medium-gray">
              {getMessage()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}