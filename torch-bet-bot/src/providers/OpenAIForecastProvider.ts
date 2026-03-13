/**
 * OpenAI (ChatGPT-style) forecast provider.
 * Uses GPT-5.2 compatible params: max_completion_tokens, reasoning_effort; no temperature.
 * Prompt is exact per day: "on March 6, at 12:00 UTC". Parses Min/Max (bracketed or plain).
 */

import OpenAI from "openai";
import type { ForecastResult } from "../types.js";
import type { ForecastProvider } from "./ForecastProvider.js";
import { parseMinMax } from "../utils/parse.js";

const DEFAULT_MODEL = "gpt-5.2-chat-latest";

/** Allowed reasoning_effort values for models that support it. */
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

const BASE_SYSTEM =
  "Return exactly ONE line only: Min: [0.00000], Max: [0.00000]. No other text. 5 decimals. If you choose not to use brackets, still output exactly: Min: 0.00000, Max: 0.00000. Use your best quantitative judgment for HBAR; vary ranges by horizon/date; do NOT reuse identical min/max across different target dates.";

const RETRY_SYSTEM_STRICT =
  "You must NOT repeat the same Min/Max as any previous target date. Output one line only: Min: [0.00000], Max: [0.00000] or Min: 0.00000, Max: 0.00000. Use 5 decimal places. No other text.";

export interface OpenAIForecastProviderOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  reasoningEffort?: ReasoningEffort;
  maxCompletionTokens?: number;
}

/** True when model prefers "developer" role for instructions. */
function useDeveloperRole(model: string): boolean {
  const m = model.toLowerCase();
  return m.startsWith("gpt-5") || m.startsWith("o1") || m.startsWith("o2");
}

const MAX_COMPLETION_TOKENS_CAP = 8192;

export class OpenAIForecastProvider implements ForecastProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;
  private timeoutMs: number;
  private reasoningEffort: ReasoningEffort | undefined;
  private maxCompletionTokens: number;

  constructor(options: OpenAIForecastProviderOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.reasoningEffort = options.reasoningEffort;
    this.maxCompletionTokens = options.maxCompletionTokens ?? 2048;
  }

  async getForecasts(params: {
    symbol: string;
    confidencePercent: number;
    targets: Array<{ timestamp: number; dayLabel: string }>;
  }): Promise<ForecastResult[]> {
    const { symbol, confidencePercent, targets } = params;
    const seen = new Set<string>();
    const batchResults: ForecastResult[] = [];

    for (const target of targets) {
      const prompt = `Give me a price range that ${symbol} token is likely to hit with ${confidencePercent}% probability ${target.dayLabel}, at 12:00 UTC. Format: 'Min: [0.00000], Max: [0.00000]' - output this quantified forecast only, not need for explanations, or any other text.`;
      let lastError: string | undefined;
      let pushed = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const systemMessage = attempt === 1 ? RETRY_SYSTEM_STRICT : BASE_SYSTEM;
          const response = await this.fetchWithTimeout(this.model, prompt, systemMessage);
          const responseLine = response.trim();

          const parsed = parseMinMax(responseLine, target.timestamp, target.dayLabel);
          if (!parsed.ok) {
            lastError = parsed.error;
            continue;
          }
          if (seen.has(responseLine)) {
            lastError = "Repeated range from model";
            continue;
          }

          seen.add(responseLine);
          const forecast = { ...parsed.forecast, prompt, raw: responseLine };
          batchResults.push({ ok: true, forecast });
          pushed = true;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
      if (!pushed) {
        batchResults.push({
          ok: false,
          targetTimestamp: target.timestamp,
          dayLabel: target.dayLabel,
          error: lastError ?? "unknown",
        });
      }
    }
    return batchResults;
  }

  private async fetchWithTimeout(
    model: string,
    userContent: string,
    systemContent: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const instructionRole = useDeveloperRole(model) ? "developer" : "system";
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: instructionRole as "system", content: systemContent },
      { role: "user", content: userContent },
    ];

    try {
      let tokens = this.maxCompletionTokens;
      let result = await this.tryCreate(model, messages, controller.signal, tokens);
      if (result.content) return result.content;
      tokens = Math.min(this.maxCompletionTokens * 2, MAX_COMPLETION_TOKENS_CAP);
      result = await this.tryCreate(model, messages, controller.signal, tokens);
      if (result.content) return result.content;
      const fr = result.finishReason;
      throw new Error(
        `Empty model response (model=${model}${fr ? `, finish_reason=${fr}` : ""})`
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async doCreate(
    model: string,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    signal: AbortSignal,
    maxCompletionTokens: number
  ): Promise<OpenAI.Chat.ChatCompletion> {
    const params = {
      model,
      messages,
      max_completion_tokens: maxCompletionTokens,
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
      max_completion_tokens?: number;
    };
    if (this.reasoningEffort != null) {
      (params as unknown as Record<string, unknown>).reasoning_effort = this.reasoningEffort;
    }
    return this.client.chat.completions.create(params, { signal });
  }

  private async tryCreate(
    model: string,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    signal: AbortSignal,
    maxCompletionTokens: number
  ): Promise<{ content: string | null; finishReason?: string }> {
    try {
      const completion = await this.doCreate(model, messages, signal, maxCompletionTokens);
      const choice = completion.choices[0];
      const content = choice?.message?.content?.trim() ?? null;
      const finishReason = (choice as { finish_reason?: string } | undefined)?.finish_reason;
      return { content, finishReason };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const useMaxTokens =
        msg.includes("max_completion_tokens") || msg.includes("Use 'max_tokens'");
      if (useMaxTokens) {
        const paramsLegacy = {
          model,
          messages,
          max_tokens: maxCompletionTokens,
        } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & { max_tokens?: number };
        if (this.reasoningEffort != null) {
          (paramsLegacy as unknown as Record<string, unknown>).reasoning_effort =
            this.reasoningEffort;
        }
        const completion = await this.client.chat.completions.create(paramsLegacy, { signal });
        const choice = completion.choices[0];
        const content = choice?.message?.content?.trim() ?? null;
        const finishReason = (choice as { finish_reason?: string } | undefined)?.finish_reason;
        return { content, finishReason };
      }
      throw err;
    }
  }
}
