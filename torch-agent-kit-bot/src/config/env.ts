import { z } from "zod";

const envSchema = z.object({
  ACCOUNT_ID: z.string().min(1),
  PRIVATE_KEY: z.string().min(1),
  NETWORK: z.enum(["testnet", "mainnet"]),
  TORCH_CONTRACT_ID: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),

  OPENAI_MODEL: z.string().min(1).default("gpt-5.2-chat-latest"),
  OPENAI_REASONING_EFFORT: z
    .enum(["none", "minimal", "low", "medium", "high", "xhigh"])
    .default("high"),
  OPENAI_MAX_COMPLETION_TOKENS: z.coerce.number().int().min(1).max(8192).default(2048),

  CONFIDENCE_PERCENT: z.coerce.number().int().min(1).max(100).default(60),
  SYMBOL: z.string().min(1).default("HBAR"),
  STAKE_HBAR: z.string().default("0.1"),
  MAX_DAILY_SPEND_HBAR: z.string().default("1"),
  MIN_TARGET_LEAD_SECONDS: z.coerce.number().int().min(0).default(86400),
  DAYS_AHEAD: z.coerce.number().int().min(1).max(7).default(1),

  DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  LOG_LEVEL: z.string().default("info"),

  GAS_LIMIT: z.coerce.number().int().positive().default(500000),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached == null) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      throw new Error(`Invalid env: ${msg}`);
    }
    cached = parsed.data;
  }
  return cached;
}
