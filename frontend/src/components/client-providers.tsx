'use client';

import React, { ReactNode, Suspense } from 'react';
import dynamic from 'next/dynamic';

const ProvidersInner = dynamic(() => import('@/components/providers-inner'), {
  ssr: true,
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProvidersInner>{children}</ProvidersInner>
    </Suspense>
  );
}
