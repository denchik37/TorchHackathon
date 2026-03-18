import dynamic from 'next/dynamic';
import { PageLayout } from '@/components/layout';
import { MotionCard } from '@/lib/motion';

const PredictionCard = dynamic(
  () => import('@/components/features/prediction').then((m) => m.PredictionCard),
  { ssr: false }
);

export default function Home() {
  return (
    <PageLayout maxWidth="md">
      <MotionCard className="w-full">
        <PredictionCard />
      </MotionCard>
    </PageLayout>
  );
}
