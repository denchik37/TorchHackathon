'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { gql, useQuery } from '@apollo/client';
import type { Bet } from '@/lib/types';
import { formatAddress, formatDateUTC, formatTinybarsToHbar } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { betHistoryStyles } from './BetHistory.styles';

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
      timestamp
    }
  }
`;

export interface BetHistoryProps {
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
      setHasNext((data.bets?.length ?? 0) === LIMIT);
    }
  }, [data, loading]);

  const handlePrev = useCallback(() => {
    if (page > 1) setPage((p) => p - 1);
  }, [page]);

  const handleNext = useCallback(() => {
    if (hasNext) setPage((p) => p + 1);
  }, [hasNext]);

  const bets = data?.bets ?? [];

  return (
    <div className={betHistoryStyles.root + (className ? ` ${className}` : '')}>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className={betHistoryStyles.table}>
          <thead className={betHistoryStyles.thead}>
            <tr>
              <th className={betHistoryStyles.th}>User</th>
              <th className={betHistoryStyles.th}>Amount</th>
              <th className={betHistoryStyles.th}>Range</th>
              <th className={betHistoryStyles.th}>Date, UTC</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={4} className="py-6 px-4 text-destructive text-sm">
                  Error: {error.message}
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={4} className="py-6 px-4 text-muted-foreground text-sm">
                  Loading…
                </td>
              </tr>
            )}
            {!error && !loading && bets.map((bet: Bet) => (
              <tr key={bet.id} className={betHistoryStyles.row}>
                <td className={betHistoryStyles.cell}>
                  <Tooltip content={bet.user.id}>
                    <span className="font-mono text-xs">{formatAddress(bet.user.id, 2)}</span>
                  </Tooltip>
                </td>
                <td className={betHistoryStyles.cell + ' tabular-nums'}>{formatTinybarsToHbar(bet.stake, 3)}</td>
                <td className={betHistoryStyles.cell + ' font-mono text-xs'}>
                  ${formatTinybarsToHbar(bet.priceMin, 3)} – ${formatTinybarsToHbar(bet.priceMax, 3)}
                </td>
                <td className={betHistoryStyles.cellMuted + ' text-xs'}>{formatDateUTC(bet.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={betHistoryStyles.pagination}>
        <Button variant="outline" size="sm" className={betHistoryStyles.paginationButton} disabled={page === 1} onClick={handlePrev}>
          ← Prev
        </Button>
        <Button variant="outline" size="sm" className={betHistoryStyles.paginationButton} disabled={!hasNext} onClick={handleNext}>
          Next →
        </Button>
      </div>
    </div>
  );
}
