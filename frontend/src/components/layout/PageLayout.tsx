'use client';

import { Header } from './Header';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const maxWidthMap = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
} as const;

export function PageLayout({ children, className, maxWidth = 'md' }: PageLayoutProps) {
  return (
    <div className="min-h-dvh bg-background relative">
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.5]"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(0 0% 40%) 0.5px, transparent 0.5px)',
          backgroundSize: '20px 20px',
        }}
      />
      <div className="relative z-10">
        <Header />
        <main className={cn('mx-auto px-4 sm:px-6 py-8', maxWidthMap[maxWidth], className)}>
          {children}
        </main>
      </div>
    </div>
  );
}
