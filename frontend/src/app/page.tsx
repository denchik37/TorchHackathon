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
  query GetUnresolvedBetsForMarketCards {
    bets(
      where: { bucketRef_: { aggregationComplete: false }, finalized: false }
      first: 1000
      orderBy: targetTimestamp
      orderDirection: asc
    ) {
      id
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

  // Coming soon markets
  const [bonzoPrice, setBonzoPrice] = useState<number | null>(null);
  const [bonzoChange24h, setBonzoChange24h] = useState<number | null>(null);
  const [hsuitePrice, setHsuitePrice] = useState<number | null>(null);
  const [hsuiteChange24h, setHsuiteChange24h] = useState<number | null>(null);
  const [dovuPrice, setDovuPrice] = useState<number | null>(null);
  const [dovuChange24h, setDovuChange24h] = useState<number | null>(null);
  const [hpackPrice, setHpackPrice] = useState<number | null>(null);
  const [hpackChange24h, setHpackChange24h] = useState<number | null>(null);

  function formatUsdPrice(n: number) {
    const decimals = n >= 1 ? 4 : 6;
    return `$${n.toFixed(decimals)}`;
  }

  function formatChangePct(n: number) {
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  }

  const activeHbarBets = useMemo(() => {
    return betsData?.bets?.length ?? 0;
  }, [betsData]);

  useEffect(() => {
    let cancelled = false;
    async function fetchSaucePrice() {
      try {
        setSauceLoading(true);
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=saucerswap,hedera-hashgraph,bonzo-finance,hsuite,dovu-2,hashpack&vs_currencies=usd&include_24hr_change=true'
        );
        if (!res.ok) throw new Error('Failed to fetch SAUCE price');
        const json = (await res.json()) as Record<
          string,
          { usd?: number; usd_24h_change?: number }
        >;
        if (!cancelled) {
          const sauce = json.saucerswap;
          const hbar = json['hedera-hashgraph'];
          const bonzo = json['bonzo-finance'];
          const hsuite = json['hsuite'];
          const dovu = json['dovu-2'];
          const hpack = json['hashpack'];

          setSaucePrice(sauce?.usd ?? null);
          setSauceChange24h(sauce?.usd_24h_change ?? null);

          setHbarChange24h(hbar?.usd_24h_change ?? null);

          setBonzoPrice(bonzo?.usd ?? null);
          setBonzoChange24h(bonzo?.usd_24h_change ?? null);
          setHsuitePrice(hsuite?.usd ?? null);
          setHsuiteChange24h(hsuite?.usd_24h_change ?? null);
          setDovuPrice(dovu?.usd ?? null);
          setDovuChange24h(dovu?.usd_24h_change ?? null);
          setHpackPrice(hpack?.usd ?? null);
          setHpackChange24h(hpack?.usd_24h_change ?? null);
        }
      } catch {
        if (!cancelled) {
          setSaucePrice(null);
          setSauceChange24h(null);
          setHbarChange24h(null);
          setBonzoPrice(null);
          setBonzoChange24h(null);
          setHsuitePrice(null);
          setHsuiteChange24h(null);
          setDovuPrice(null);
          setDovuChange24h(null);
          setHpackPrice(null);
          setHpackChange24h(null);
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
            price={sauceLoading ? 'Loading...' : saucePrice != null ? formatUsdPrice(saucePrice) : 'N/A'}
            change24h={
              sauceChange24h == null ? 'N/A' : formatChangePct(sauceChange24h)
            }
            activeBets="0"
            comingSoon
          />

          <MarketRow
            symbol="BONZO"
            logo="/bonzo-logo.png"
            price={sauceLoading ? 'Loading...' : bonzoPrice != null ? formatUsdPrice(bonzoPrice) : 'N/A'}
            change24h={bonzoChange24h == null ? 'N/A' : formatChangePct(bonzoChange24h)}
            activeBets="0"
            comingSoon
          />

          <MarketRow
            symbol="HSUITE"
            logo="/hsuite-logo.svg"
            price={sauceLoading ? 'Loading...' : hsuitePrice != null ? formatUsdPrice(hsuitePrice) : 'N/A'}
            change24h={hsuiteChange24h == null ? 'N/A' : formatChangePct(hsuiteChange24h)}
            activeBets="0"
            comingSoon
          />

          <MarketRow
            symbol="DOVU"
            logo="/dovu-logo.png"
            price={sauceLoading ? 'Loading...' : dovuPrice != null ? formatUsdPrice(dovuPrice) : 'N/A'}
            change24h={dovuChange24h == null ? 'N/A' : formatChangePct(dovuChange24h)}
            activeBets="0"
            comingSoon
          />

          <MarketRow
            symbol="HPACK"
            logo="/hashpack-logo.png"
            price={sauceLoading ? 'Loading...' : hpackPrice != null ? formatUsdPrice(hpackPrice) : 'N/A'}
            change24h={hpackChange24h == null ? 'N/A' : formatChangePct(hpackChange24h)}
            activeBets="0"
            comingSoon
          />
        </div>
      </div>
    </PageLayout>
  );
}
