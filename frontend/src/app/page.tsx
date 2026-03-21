'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { gql, useQuery } from '@apollo/client';
import { PageLayout } from '@/components/layout';
import { MotionCard } from '@/lib/motion';
import { useHbarPrice } from '@/hooks/useHbarPrice';

const PredictionCard = dynamic(
  () => import('@/components/features/prediction').then((m) => m.PredictionCard),
  { ssr: false }
);

const GET_ALL_BETS = gql`
  query GetAllBetsForMarketCards {
    bets {
      id
      finalized
    }
  }
`;

type SelectedMarket = 'none' | 'hbar';

function MarketRow({
  symbol,
  logo,
  price,
  activeBets,
  change24h,
  clickable,
  comingSoon,
  onSelect,
}: {
  symbol: string;
  logo: string;
  price: string;
  activeBets: string;
  change24h: string;
  clickable?: boolean;
  comingSoon?: boolean;
  onSelect?: () => void;
}) {
  const isNegativeChange = change24h.startsWith('-');
  const content = (
    <div className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.1] bg-gradient-to-br from-white/[0.05] to-white/[0.02] px-4 py-3 backdrop-blur-md transition-all duration-300 hover:border-primary/30 hover:bg-gradient-to-br hover:from-primary/[0.12] hover:to-white/[0.04]">
      <div className="min-w-[210px] flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Token</p>
        <div className="mt-2 flex items-center gap-2">
          <Image src={logo} alt="" width={22} height={22} className="shrink-0 rounded-full" aria-hidden />
          <span className="text-base font-semibold text-foreground">{symbol}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-0">
        <div className="w-36 shrink-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current price</p>
          <p className="mt-2 text-sm font-medium tabular-nums text-foreground">{price}</p>
        </div>
        <div className="w-24 shrink-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">CHANGE (24h)</p>
          <p
            className={`mt-2 text-sm font-medium tabular-nums ${
              isNegativeChange ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {change24h}
          </p>
        </div>
      </div>
      <div className="w-28 shrink-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active bets</p>
        <p className="mt-2 text-sm font-medium tabular-nums text-foreground">{activeBets}</p>
      </div>
      <div className="ml-auto shrink-0 text-xs font-medium">
        {comingSoon ? (
          <span className="rounded-md border border-white/[0.18] bg-gradient-to-r from-white/[0.08] to-white/[0.04] px-2.5 py-1 text-muted-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.1)] transition-colors duration-200 group-hover:border-white/[0.28] group-hover:from-white/[0.11] group-hover:to-white/[0.06] group-hover:text-foreground/90">
            Coming soon
          </span>
        ) : (
          <span className="rounded-md border border-primary/40 bg-gradient-to-r from-primary/25 to-primary/10 px-2.5 py-1 text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.1),0_4px_12px_hsl(262_76%_53%_/_0.14)] transition-colors duration-200 group-hover:from-primary/30 group-hover:to-primary/16 group-hover:text-white group-hover:border-primary/55">
            Predict Price
          </span>
        )}
      </div>
    </div>
  );

  if (!clickable) return content;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
      aria-label={`Open ${symbol} market`}
    >
      {content}
    </button>
  );
}

export default function Home() {
  const [selectedMarket, setSelectedMarket] = useState<SelectedMarket>('none');
  const { price, isLoading: hbarLoading } = useHbarPrice();
  const { data: betsData } = useQuery(GET_ALL_BETS);
  const [saucePrice, setSaucePrice] = useState<number | null>(null);
  const [hbarChange24h, setHbarChange24h] = useState<number | null>(null);
  const [sauceChange24h, setSauceChange24h] = useState<number | null>(null);
  const [sauceLoading, setSauceLoading] = useState(true);

  const activeHbarBets = useMemo(() => {
    const bets = betsData?.bets ?? [];
    return bets.filter((b: { finalized: boolean }) => !b.finalized).length;
  }, [betsData]);

  useEffect(() => {
    let cancelled = false;
    async function fetchSaucePrice() {
      try {
        setSauceLoading(true);
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=saucerswap,hedera-hashgraph&vs_currencies=usd&include_24hr_change=true'
        );
        if (!res.ok) throw new Error('Failed to fetch SAUCE price');
        const json = (await res.json()) as {
          saucerswap?: { usd?: number; usd_24h_change?: number };
          'hedera-hashgraph'?: { usd_24h_change?: number };
        };
        if (!cancelled) {
          setSaucePrice(json.saucerswap?.usd ?? null);
          setSauceChange24h(json.saucerswap?.usd_24h_change ?? null);
          setHbarChange24h(json['hedera-hashgraph']?.usd_24h_change ?? null);
        }
      } catch {
        if (!cancelled) {
          setSaucePrice(null);
          setSauceChange24h(null);
          setHbarChange24h(null);
        }
      } finally {
        if (!cancelled) setSauceLoading(false);
      }
    }
    void fetchSaucePrice();
    return () => {
      cancelled = true;
    };
  }, []);

  if (selectedMarket === 'hbar') {
    return (
      <PageLayout maxWidth="md">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setSelectedMarket('none')}
            className="text-sm text-primary hover:underline"
          >
            Back to markets
          </button>
        </div>
        <MotionCard className="w-full">
          <PredictionCard />
        </MotionCard>
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="lg">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="mb-1 text-2xl font-semibold text-foreground">Explore Markets</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Choose a market to open prediction and place bets.
        </p>

        <div className="space-y-3">
          <MarketRow
            symbol="HBAR"
            logo="/hedera-hbar-logo.svg"
            price={hbarLoading ? 'Loading...' : `$${price.toFixed(4)}`}
            change24h={
              hbarChange24h == null ? 'N/A' : `${hbarChange24h >= 0 ? '+' : ''}${hbarChange24h.toFixed(2)}%`
            }
            activeBets={String(activeHbarBets)}
            clickable
            onSelect={() => setSelectedMarket('hbar')}
          />
          <MarketRow
            symbol="SAUCE"
            logo="/saucer-logo.png"
            price={sauceLoading ? 'Loading...' : saucePrice != null ? `$${saucePrice.toFixed(6)}` : 'N/A'}
            change24h={
              sauceChange24h == null ? 'N/A' : `${sauceChange24h >= 0 ? '+' : ''}${sauceChange24h.toFixed(2)}%`
            }
            activeBets="0"
            comingSoon
          />
        </div>
      </div>
    </PageLayout>
  );
}
