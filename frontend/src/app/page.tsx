import dynamic from 'next/dynamic';
import { Header } from '@/components/layout';
import { MotionCard } from '@/lib/motion';

const PredictionCard = dynamic(
  () => import('@/components/features/prediction').then((m) => m.PredictionCard),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 max-w-4xl">
        <MotionCard className="w-full">
          <PredictionCard />
        </MotionCard>
      </main>
    </div>
  );
}
