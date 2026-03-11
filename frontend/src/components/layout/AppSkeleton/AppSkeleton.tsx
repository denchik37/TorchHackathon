'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { appSkeletonStyles } from './AppSkeleton.styles';

export function AppSkeleton() {
  return (
    <div className={appSkeletonStyles.root}>
      <header className={appSkeletonStyles.header}>
        <div className={appSkeletonStyles.headerInner}>
          <div className={appSkeletonStyles.headerRow}>
            <div className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </header>

      <main className={appSkeletonStyles.main}>
        <div className={appSkeletonStyles.card}>
          <div className={appSkeletonStyles.cardInner}>
            <div className="mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Skeleton className="h-8 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="flex space-x-4 mb-4">
                <Skeleton className="h-10 w-24 rounded" />
                <Skeleton className="h-10 w-24 rounded" />
              </div>
            </div>

            <div className="space-y-6">
              <div className={`${appSkeletonStyles.chartArea}`}>
                <Skeleton className="h-full w-full bg-neutral-800" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-10 w-10 rounded bg-neutral-800" />
                  <Skeleton className="h-10 flex-1 bg-neutral-800" />
                  <Skeleton className="h-10 w-10 rounded bg-neutral-800" />
                </div>
                <Skeleton className="h-12 w-full bg-neutral-800" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={appSkeletonStyles.statBox}>
                    <Skeleton className="h-4 w-full mb-2 bg-neutral-800" />
                    <Skeleton className="h-6 w-3/4 bg-neutral-800" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-12 w-full bg-torch-purple/20" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
