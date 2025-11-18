'use client';
import { useState, useEffect } from 'react';
import { gql, useQuery } from '@apollo/client';

import type { Bet } from '@/lib/types';
import { formatAddress, formatDateUTC, formatTinybarsToHbar } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

const LIMIT = 10;
const GET_BETS = gql`
  query GetBets($first: Int!, $skip: Int!) {
    bets(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
      id
      user {
        id
      }
      stake
      priceMin
      priceMax
      targetTimestamp
    }
  }
`;

interface BetHistoryProps {
  className?: string;
}

export function BetHistory({ className }: BetHistoryProps) {
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);

  const skip = (page - 1) * LIMIT;
  const { data, loading, error } = useQuery(GET_BETS, {
    variables: { first: LIMIT, skip },
    notifyOnNetworkStatusChange: true,
  });

  useEffect(() => {
    if (!loading && data) {
      setHasNext(data.bets.length === LIMIT);
    }
  }, [data, loading]);

  const handlePrev = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNext = () => {
    if (hasNext) setPage((p) => p + 1);
  };

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-medium text-medium-gray">User</th>
              <th className="text-left py-3 px-4 font-medium text-medium-gray">Amount</th>
              <th className="text-left py-3 px-4 font-medium text-medium-gray">Range</th>
              <th className="text-left py-3 px-4 font-medium text-medium-gray">Date, UTC</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={4} className="text-red-500 text-left py-4">
                  Error: {error.message}
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={4} className="text-light-gray text-left py-4">
                  Loading...
                </td>
              </tr>
            )}

            {!error &&
              !loading &&
              data.bets.map((bet: Bet) => (
                <tr key={bet.id} className="border-b border-white/5 hover:bg-dark-slate/50">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <Tooltip content={bet.user.id}>
                        <span className="text-sm font-mono text-light-gray">
                          {formatAddress(bet.user.id, 2)}
                        </span>
                      </Tooltip>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-light-gray">
                    {formatTinybarsToHbar(bet.stake, 4)}
                  </td>
                  <td className="py-3 px-4 text-sm text-light-gray">
                    {formatTinybarsToHbar(bet.priceMin, 4)} -{' '}
                    {formatTinybarsToHbar(bet.priceMax, 4)}
                  </td>
                  <td className="py-3 px-4 text-sm text-medium-gray">
                    {formatDateUTC(bet.targetTimestamp)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <Button
          variant="outline"
          size="sm"
          className="border-vibrant-purple text-vibrant-purple hover:bg-vibrant-purple hover:text-white"
          disabled={page === 1}
          onClick={handlePrev}
        >
          &lt; Prev
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="border-vibrant-purple text-vibrant-purple hover:bg-vibrant-purple hover:text-white"
          disabled={!hasNext}
          onClick={handleNext}
        >
          Next &gt;
        </Button>
      </div>
    </div>
  );
}
