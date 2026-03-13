import { JsonRpcProvider } from "ethers";
import { z } from "zod";

/** ECDSA secp256k1 private key: 0x + 64 hex chars (32 bytes). */
const ECDSA_PRIVATE_KEY_REGEX = /^0x[a-fA-F0-9]{64}$/;

const envSchema = z.object({
  // Forecast: OpenAI only
  OPENAI_API_KEY: z.string().min(1),

  // Hedera EVM: JSON-RPC and contract
  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int().positive(),
  TORCH_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  /** Optional: contract function name if ABI is placeholder (default placeBet). */
  TORCH_FUNCTION_NAME: z.string().min(1).optional(),

  // Signing: ECDSA secp256k1 key (HashPack account key). ED25519 not supported for EVM.
  PRIVATE_KEY: z.string().min(1),

  // Spend guardrails (HBAR)
  BET_AMOUNT_HBAR: z.string().default("0.1"),
  MAX_DAILY_SPEND_HBAR: z.string().default("1"),
  MAX_BET_AMOUNT_HBAR: z.string().optional(),

  // Hedera EVM: msg.value uses weibar (18 decimals). Override only if needed.
  NATIVE_VALUE_DECIMALS: z.coerce.number().int().min(1).max(18).default(18),

  // Torch contract: minimum lead time (seconds) from now to first target (default 1 day).
  MIN_TARGET_LEAD_SECONDS: z.coerce.number().int().min(0).default(86400),

  // Safety
  DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),

  // Price fixed-point decimals: Torch/frontend expect 8 (same as frontend priceMin/priceMax).
  PRICE_DECIMALS: z.coerce.number().int().min(1).max(18).default(8),

  // Concurrency for forecast requests
  FORECAST_CONCURRENCY: z.coerce.number().int().min(1).max(7).default(2),

  // OpenAI: ChatGPT-style GPT-5.2 (max_completion_tokens only; no temperature for reasoning models)
  OPENAI_MODEL: z.string().min(1).default("gpt-5.2-chat-latest"),
  /** Reasoning effort: none|minimal|low|medium|high|xhigh. */
  OPENAI_REASONING_EFFORT: z
    .enum(["none", "minimal", "low", "medium", "high", "xhigh"])
    .default("high"),
  /** Max completion tokens (newer models use this; not max_tokens). */
  OPENAI_MAX_COMPLETION_TOKENS: z.coerce.number().int().min(1).max(8192).default(2048),
  /** Legacy fallback when OPENAI_MAX_COMPLETION_TOKENS not set. */
  OPENAI_MAX_TOKENS: z.coerce.number().int().min(1).max(4096).optional(),

  // HTTP timeouts (ms)
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export type Env = z.infer<typeof envSchema>;

function validatePrivateKey(key: string): void {
  if (!ECDSA_PRIVATE_KEY_REGEX.test(key)) {
    throw new Error(
      "This bot requires an ECDSA secp256k1 private key for Hedera EVM signing (HashPack account key). ED25519 keys / mnemonic-only flows won't work for EVM tx signing. Use a 0x-prefixed 32-byte (64 hex character) key."
    );
  }
}

/**
 * Lightweight RPC connectivity check (getBlockNumber). Call after getEnv() at startup.
 */
export async function checkRpcConnectivity(rpcUrl: string): Promise<void> {
  const provider = new JsonRpcProvider(rpcUrl);
  try {
    await provider.getBlockNumber();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Hedera RPC connectivity check failed (${rpcUrl}): ${msg}. Ensure RPC_URL is correct and the endpoint is reachable.`
    );
  }
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new Error(`Invalid env: ${msg}`);
  }
  const env = parsed.data;
  validatePrivateKey(env.PRIVATE_KEY);
  return env;
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached == null) cached = loadEnv();
  return cached;
}
