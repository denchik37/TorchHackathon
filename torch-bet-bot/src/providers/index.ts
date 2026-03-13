/**
 * Forecast provider: OpenAI (ChatGPT) only.
 */

import { getEnv } from "../config/env.js";
import type { ForecastProvider } from "../types.js";
import { OpenAIForecastProvider } from "./OpenAIForecastProvider.js";

export function getForecastProvider(): ForecastProvider {
  const env = getEnv();
  const key = env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required");
  const maxCompletionTokens =
    env.OPENAI_MAX_COMPLETION_TOKENS ?? env.OPENAI_MAX_TOKENS ?? 2048;
  return new OpenAIForecastProvider({
    apiKey: key,
    model: env.OPENAI_MODEL,
    timeoutMs: env.HTTP_TIMEOUT_MS,
    reasoningEffort: env.OPENAI_REASONING_EFFORT,
    maxCompletionTokens,
  });
}

export { OpenAIForecastProvider } from "./OpenAIForecastProvider.js";
