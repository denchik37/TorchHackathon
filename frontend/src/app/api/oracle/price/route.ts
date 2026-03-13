import { NextResponse } from 'next/server';

/**
 * Server-only: current HBAR price from CoinGecko + optional oracle URL.
 * Used by the public Oracle dashboard (read-only).
 */
export async function GET() {
  let coinGecko: number | null = null;
  let oracle: number | null = null;

  try {
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd',
      { next: { revalidate: 60 } }
    );
    if (cgRes.ok) {
      const data = (await cgRes.json()) as { 'hedera-hashgraph'?: { usd?: number } };
      coinGecko = data['hedera-hashgraph']?.usd ?? null;
    }
  } catch (e) {
    console.error('CoinGecko price error:', e);
  }

  const oracleUrl = process.env.ORACLE_PRICE_URL;
  if (oracleUrl) {
    try {
      const oRes = await fetch(oracleUrl, { next: { revalidate: 60 } });
      if (oRes.ok) {
        const data = (await oRes.json()) as { answer?: string; result?: string; price?: number };
        const raw = data.answer ?? data.result ?? data.price;
        if (typeof raw === 'number') oracle = raw;
        else if (typeof raw === 'string') oracle = Number(raw);
      }
    } catch (e) {
      console.error('Oracle price error:', e);
    }
  }

  return NextResponse.json({ coinGecko, oracle });
}
