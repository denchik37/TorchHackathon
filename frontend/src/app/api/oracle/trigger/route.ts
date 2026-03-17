import { NextResponse } from 'next/server';

/**
 * Resolver execution must never run on Vercel. The resolver wallet and signing key
 * live on Hetzner; setPricesForTimestamps and processBatch are executed only by
 * torch-oracle-resolver on the server (systemd timer or a Hetzner-side authenticated
 * trigger endpoint). This route exists only to return a clear error.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Resolver execution is not available on this host',
      message:
        'All resolver execution (setPricesForTimestamps, processBatch) runs only on Hetzner. ' +
        'To trigger a run manually, call a secure endpoint on the Hetzner server (e.g. protected by RESOLVER_TRIGGER_SECRET), not this frontend.',
    },
    { status: 501 }
  );
}
