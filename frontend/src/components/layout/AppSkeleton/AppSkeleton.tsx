'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { appSkeletonStyles } from './AppSkeleton.styles';

export function AppSkeleton() {
  return (
    <div className={appSkeletonStyles.root}>
      <header className={appSkeletonStyles.header}>
        <div className={appSkeletonStyles.headerInner}>
          <div className={appSkeletonStyles.headerRow}>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
              <div className="hidden sm:flex items-center gap-1">
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="h-7 w-14 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        </div>
      </header>

      <main className={appSkeletonStyles.main}>
        <div className={appSkeletonStyles.cardInner}>
          {/* Generic content blocks */}
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>

          <Skeleton className="h-9 w-full rounded-lg mb-6" />

          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-md" />
              <Skeleton className="h-20 rounded-md" />
            </div>

            <div className="border-t border-white/[0.08] pt-5">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-44 w-full rounded-md" />
            </div>

            <div className="border-t border-white/[0.08] pt-5">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-10 w-full rounded-md mb-4" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
