'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { noBetsContainerStyles } from './NoBetsContainer.styles';

export default function NoBetsContainer() {
  return (
    <div className={noBetsContainerStyles.root}>
      <div className={noBetsContainerStyles.content}>
        <h1 className={noBetsContainerStyles.title}>You haven&apos;t placed any bets yet.</h1>
        <p className={noBetsContainerStyles.description}>Check out the markets and place a bet.</p>
      </div>
      <Link href="/">
        <Button size="lg" className="text-white">
          Return to bet
        </Button>
      </Link>
    </div>
  );
}
