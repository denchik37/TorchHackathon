import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DASHBOARD_API_TOKEN: z.string().min(1),
  BETTING_RUNS_DIR: z.string().min(1),
  RESOLVER_RUNS_DIR: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}
