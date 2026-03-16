import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/env.js', () => ({
  getEnv: () => ({
    COINGECKO_API_KEY: undefined,
  }),
}));

describe('coingecko', () => {
  it('exports fetchPriceAtTimestamp and fetchCurrentPrice', async () => {
    const mod = await import('./coingecko.js');
    expect(typeof mod.fetchPriceAtTimestamp).toBe('function');
    expect(typeof mod.fetchCurrentPrice).toBe('function');
  });
});
