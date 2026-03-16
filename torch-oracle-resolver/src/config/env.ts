import { z } from 'zod';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  ADMIN_ACCOUNT_ID: z.string().min(1),
  ADMIN_PRIVATE_KEY: z.string().min(1),
  TORCH_CONTRACT_ID: z.string().min(1),
  SUBGRAPH_URL: z.string().url(),
  COINGECKO_API_KEY: z.string().optional(),
  PRICE_SOURCE_MODE: z.enum(['hybrid']).default('hybrid'),
  ORACLE_PROVIDER: z.enum(['chainlink', 'pyth']).default('chainlink'),
  MAX_PRICE_DIVERGENCE_PCT: z.coerce.number().min(0).max(100).default(1),
  FINALIZATION_BUFFER_SECONDS: z.coerce.number().min(0).default(120),
  MAX_TIMESTAMPS_PER_TX: z.coerce.number().min(1).max(100).default(50),
  MAX_BUCKETS_PER_RUN: z.coerce.number().min(1).max(100).default(25),
  MAX_PROCESS_BATCH_TX_PER_BUCKET: z.coerce.number().min(1).max(100).default(20),
  DRY_RUN: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('true'),
  BACKLOG_START_FROM: z.string().default('auto'),
  BACKLOG_MAX_AGE_DAYS: z.coerce.number().min(0).default(90),
  RESOLVE_CONCURRENCY: z.coerce.number().min(1).default(1),
  RESOLVER_TRIGGER_SECRET: z.string().optional(),
  RESOLVE_LOOP_INTERVAL_MS: z.coerce.number().optional(),
  COINGECKO_MIN_DELAY_MS: z.coerce.number().min(0).default(1200),
  COINGECKO_MAX_RETRIES: z.coerce.number().int().min(0).default(6),
  COINGECKO_BACKOFF_BASE_MS: z.coerce.number().min(0).default(800),
  COINGECKO_BACKOFF_MAX_MS: z.coerce.number().min(0).default(15000),
  COINGECKO_JITTER_PCT: z.coerce.number().min(0).max(1).default(0.2),
  COINGECKO_CACHE_TTL_DAYS: z.coerce.number().min(0).default(3650),
  COINGECKO_CACHE_MAX_ENTRIES: z.coerce.number().int().min(0).default(20000),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  _env = parsed.data;
  return _env;
}
