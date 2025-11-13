import { Skeleton } from '@/components/ui/skeleton';

export function AppSkeleton() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header Skeleton */}
      <header className="bg-[#0A0A0A] text-white">
        <div className="container mx-auto px-4">
          <div className="h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-6 w-20" />
            </div>

            {/* Right side - Wallet button */}
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </header>

      {/* Main Content - Prediction Card Skeleton */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="bg-dark-slate/20 border border-white/10 rounded-lg p-6">
            {/* Card Header */}
            <div className="mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Skeleton className="h-8 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>

              {/* Tabs */}
              <div className="flex space-x-4 mb-4">
                <Skeleton className="h-10 w-24 rounded" />
                <Skeleton className="h-10 w-24 rounded" />
              </div>
            </div>

            {/* Card Content */}
            <div className="space-y-6">
              {/* Chart area */}
              <div className="h-48 bg-neutral-900/50 rounded-lg p-4">
                <Skeleton className="h-full w-full bg-neutral-800" />
              </div>

              {/* Amount input */}
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-10 w-10 rounded bg-neutral-800" />
                  <Skeleton className="h-10 flex-1 bg-neutral-800" />
                  <Skeleton className="h-10 w-10 rounded bg-neutral-800" />
                </div>

                {/* Range selector */}
                <Skeleton className="h-12 w-full bg-neutral-800" />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-neutral-900/50 rounded p-3">
                  <Skeleton className="h-4 w-full mb-2 bg-neutral-800" />
                  <Skeleton className="h-6 w-3/4 bg-neutral-800" />
                </div>
                <div className="bg-neutral-900/50 rounded p-3">
                  <Skeleton className="h-4 w-full mb-2 bg-neutral-800" />
                  <Skeleton className="h-6 w-3/4 bg-neutral-800" />
                </div>
                <div className="bg-neutral-900/50 rounded p-3">
                  <Skeleton className="h-4 w-full mb-2 bg-neutral-800" />
                  <Skeleton className="h-6 w-3/4 bg-neutral-800" />
                </div>
              </div>

              {/* Place bet button */}
              <Skeleton className="h-12 w-full bg-torch-purple/20" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
