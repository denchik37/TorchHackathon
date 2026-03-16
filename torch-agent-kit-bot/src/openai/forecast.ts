import OpenAI from "openai";
import { getEnv } from "../config/env.js";

/**
 * Build the single prompt for one target day (monthDay e.g. "March 6").
 */
export function buildPrompt(monthDay: string, confidencePercent: number): string {
  return `Give me a price range that HBAR token is likely to hit with ${confidencePercent}% probability on ${monthDay}, at 12:00 UTC. Format: 'Min: [0.00000], Max: [0.00000]' - output this quantified forecast only, not need for explanations, or any other text.`;
}

/**
 * Call OpenAI Chat Completions (GPT-5.2 style): max_completion_tokens, reasoning_effort, no temperature.
 * Returns the raw content of the first message (one line Min/Max).
 */
export async function getForecastLine(monthDay: string): Promise<string> {
  const env = getEnv();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const prompt = buildPrompt(monthDay, env.CONFIDENCE_PERCENT);

  const params: Parameters<typeof openai.chat.completions.create>[0] = {
    model: env.OPENAI_MODEL,
    max_completion_tokens: env.OPENAI_MAX_COMPLETION_TOKENS,
    ...(env.OPENAI_REASONING_EFFORT ? { reasoning_effort: env.OPENAI_REASONING_EFFORT } : {}),
    messages: [
      {
        role: "system",
        content:
          "Return ONE line only in the exact format requested. No explanations, no extra text. Output only the single line with Min and Max values.",
      },
      { role: "user", content: prompt },
    ],
  } as Parameters<typeof openai.chat.completions.create>[0];

  const completion = await openai.chat.completions.create(params);
  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  return raw;
}
