/**
 * Daily bet runner using a true LangChain createAgent autonomous loop.
 *
 * Key constraint preserved:
 * - Per-target LLM prompt is identical to the existing bot (`buildPrompt()`).
 * - Run artifacts written to `runs/YYYY-MM-DD.json` keep the same shape.
 * - On-chain execution is performed by your custom Hedera Agent Kit plugin tool.
 */

import "dotenv/config";
import { mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import pino from "pino";

import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { HederaLangchainToolkit, AgentMode } from "hedera-agent-kit";
import {
  torchPlaceBetPlugin,
  torchPlaceBetPluginToolNames,
  type TorchPlaceBetResult,
} from "@torch-bet/hedera-torch-plugin";

import { createHederaClient } from "../hedera/client.js";
import { getEnv } from "../config/env.js";
import { buildPrompt } from "../openai/forecast.js";
import { parseMinMax } from "../parse/minmax.js";
import { getNextEligibleTargets } from "../time/targets.js";
import {
  betKey,
  getSuccessfulBetKeys,
  loadRunArtifact,
  saveArtifact,
  type RunArtifact,
} from "../storage/runStore.js";

const RUNS_DIR = process.env.BETTING_RUNS_DIR ?? "runs";

type TorchToolInput = {
  torchContractId: string;
  gasLimit: number;
  targetTimestamp: number;
  stakeHbar: string;
  forecastRaw: string;
  execute: boolean;
};

type ToolLike = {
  name?: string;
  invoke?: (input: unknown) => Promise<unknown> | unknown;
};

function getLogger() {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeStringPreview(value: unknown, max = 300): string {
  try {
    if (typeof value === "string") return value.slice(0, max);
    return JSON.stringify(value).slice(0, max);
  } catch {
    return String(value).slice(0, max);
  }
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function looksLikeTorchPlaceBetResult(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.forecastRaw === "string" &&
    typeof obj.minStr === "string" &&
    typeof obj.maxStr === "string" &&
    typeof obj.priceMinStr === "string" &&
    typeof obj.priceMaxStr === "string" &&
    typeof obj.priceMinInt === "string" &&
    typeof obj.priceMaxInt === "string" &&
    typeof obj.stakeHbar === "string"
  );
}

function tryParseToolResultObject(value: unknown): TorchPlaceBetResult | null {
  if (!isObject(value)) return null;

  if (looksLikeTorchPlaceBetResult(value)) {
    return value as unknown as TorchPlaceBetResult;
  }

  for (const key of ["result", "output", "artifact", "data", "response"]) {
    const nested = value[key];
    if (!nested) continue;
    const parsed = tryParseToolResultObject(nested);
    if (parsed) return parsed;
  }

  return null;
}

function extractTextCandidates(content: unknown): string[] {
  const out: string[] = [];

  if (typeof content === "string") {
    out.push(content);
    return out;
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part === "string") {
        out.push(part);
        continue;
      }

      if (isObject(part)) {
        if (typeof part.text === "string") out.push(part.text);
        if (typeof part.content === "string") out.push(part.content);
        if (typeof part.output === "string") out.push(part.output);
      }
    }
  }

  return out;
}

function extractTorchToolArtifact(messages: unknown[]): TorchPlaceBetResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as any;
    if (!m) continue;

    const fromStructured =
      tryParseToolResultObject(m.artifact) ||
      tryParseToolResultObject(m.additional_kwargs) ||
      tryParseToolResultObject(m.kwargs) ||
      tryParseToolResultObject(m.response_metadata);

    if (fromStructured) return fromStructured;

    const textCandidates = extractTextCandidates(m.content);
    for (const text of textCandidates) {
      const trimmed = text.trim();
      if (!trimmed.startsWith("{") || !trimmed.includes("forecastRaw")) continue;

      const parsedJson = tryParseJson(trimmed);
      const parsedResult = tryParseToolResultObject(parsedJson);
      if (parsedResult) return parsedResult;
    }
  }

  return null;
}

function summarizeMessages(messages: unknown[]) {
  return (messages as any[]).map((m, idx) => ({
    idx,
    type: m?.type,
    name: m?.name,
    hasArtifact: !!m?.artifact,
    artifactKeys:
      m?.artifact && typeof m.artifact === "object" ? Object.keys(m.artifact) : [],
    additionalKwargsKeys:
      m?.additional_kwargs && typeof m.additional_kwargs === "object"
        ? Object.keys(m.additional_kwargs)
        : [],
    kwargsKeys:
      m?.kwargs && typeof m.kwargs === "object" ? Object.keys(m.kwargs) : [],
    contentPreview: safeStringPreview(m?.content),
  }));
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return null;
}

function buildTorchToolInputFromKnownContext(
  env: ReturnType<typeof getEnv>,
  targetTimestamp: number,
  forecastRaw: string,
  execute: boolean
): TorchToolInput {
  return {
    torchContractId: env.TORCH_CONTRACT_ID,
    gasLimit: env.GAS_LIMIT,
    targetTimestamp,
    stakeHbar: env.STAKE_HBAR,
    forecastRaw,
    execute,
  };
}

function coerceTorchToolInput(
  value: unknown,
  fallback: TorchToolInput
): TorchToolInput | null {
  if (!isObject(value)) return null;

  const torchContractId =
    toStringOrNull(value.torchContractId) ?? fallback.torchContractId;
  const gasLimit = toNumberOrNull(value.gasLimit) ?? fallback.gasLimit;
  const targetTimestamp =
    toNumberOrNull(value.targetTimestamp) ?? fallback.targetTimestamp;
  const stakeHbar = toStringOrNull(value.stakeHbar) ?? fallback.stakeHbar;
  const forecastRaw = toStringOrNull(value.forecastRaw);
  const execute = toBooleanOrNull(value.execute) ?? fallback.execute;

  if (!forecastRaw) return null;

  return {
    torchContractId,
    gasLimit,
    targetTimestamp,
    stakeHbar,
    forecastRaw,
    execute,
  };
}

function extractTorchToolInputFromMessages(
  messages: unknown[],
  expectedToolName: string,
  fallback: TorchToolInput
): TorchToolInput | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as any;
    if (!m) continue;

    const toolCalls =
      (Array.isArray(m?.tool_calls) ? m.tool_calls : null) ??
      (Array.isArray(m?.additional_kwargs?.tool_calls)
        ? m.additional_kwargs.tool_calls
        : null);

    if (!toolCalls) continue;

    for (const call of toolCalls) {
      if (!call || typeof call !== "object") continue;

      // OpenAI function tool call shape
      if (
        call.type === "function" &&
        call.function &&
        call.function.name === expectedToolName &&
        typeof call.function.arguments === "string"
      ) {
        const parsedArgs = tryParseJson(call.function.arguments);
        const normalized = coerceTorchToolInput(parsedArgs, fallback);
        if (normalized) return normalized;
      }

      // Custom tool shape
      if (
        call.type === "custom" &&
        call.custom &&
        call.custom.name === expectedToolName &&
        typeof call.custom.input === "string"
      ) {
        const parsedArgs = tryParseJson(call.custom.input);
        const normalized = coerceTorchToolInput(parsedArgs, fallback);
        if (normalized) return normalized;
      }
    }
  }

  return null;
}

function extractForecastLineFromMessages(messages: unknown[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as any;
    if (!m) continue;

    const textCandidates = extractTextCandidates(m.content);
    for (const text of textCandidates) {
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        const parsed = parseMinMax(line);
        if (parsed.ok) {
          return `Min: ${parsed.minStr}, Max: ${parsed.maxStr}`;
        }
      }
    }
  }

  return null;
}

async function invokeTorchToolDirect(
  tool: ToolLike,
  input: TorchToolInput
): Promise<TorchPlaceBetResult | null> {
  if (!tool.invoke) return null;

  const out = await tool.invoke(input);

  const fromObject = tryParseToolResultObject(out);
  if (fromObject) return fromObject;

  if (typeof out === "string") {
    const parsed = tryParseJson(out);
    const fromStringJson = tryParseToolResultObject(parsed);
    if (fromStringJson) return fromStringJson;
  }

  return null;
}

export async function main(): Promise<void> {
  const env = getEnv();
  const log = getLogger();
  const dateStr = todayStr();
  const runId = randomUUID();

  log.info({ runId, dateStr, runsDir: RUNS_DIR }, "Starting daily bet run (Agent Kit / LangChain)");

  await mkdir(RUNS_DIR, { recursive: true });

  let artifact = await loadRunArtifact(RUNS_DIR, dateStr);
  const successfulKeys = artifact ? getSuccessfulBetKeys(artifact) : new Set<string>();

  const targets = getNextEligibleTargets({
    minLeadSeconds: env.MIN_TARGET_LEAD_SECONDS,
    daysAhead: env.DAYS_AHEAD,
  });

  if (targets.length === 0) {
    log.warn("No targets (DAYS_AHEAD or lead time issue)");
    process.exit(0);
  }

  const provider = {
    model: env.OPENAI_MODEL,
    reasoning_effort: env.OPENAI_REASONING_EFFORT,
    max_completion_tokens: env.OPENAI_MAX_COMPLETION_TOKENS,
  };

  const forecasts: RunArtifact["forecasts"] = [];
  const betParams: RunArtifact["betParams"] = [];
  const results: RunArtifact["results"] = [];

  const client = await createHederaClient({ log });

  const toolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [torchPlaceBetPluginToolNames.TORCH_PLACE_BET_TOOL],
      plugins: [torchPlaceBetPlugin],
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
    },
  });

  const tools = toolkit.getTools() as ToolLike[];
  const torchToolName = torchPlaceBetPluginToolNames.TORCH_PLACE_BET_TOOL;
  const torchTool =
    tools.find((tool) => tool?.name === torchToolName) ?? null;

  const agent = createAgent({
    model: new ChatOpenAI({
      model: env.OPENAI_MODEL,
      apiKey: env.OPENAI_API_KEY,
    }),
    tools: tools as any,
    systemPrompt:
      "You are a deterministic TorchPredictionMarket bet assistant.\n" +
      "For every request you must do exactly two things:\n" +
      "1) Generate exactly one forecast line in the format \"Min: x, Max: y\".\n" +
      "2) Immediately call TORCH_PLACE_BET_TOOL exactly once using that exact forecast line as forecastRaw.\n" +
      "Do not answer conversationally.\n" +
      "Do not provide extra text.\n" +
      "Do not skip the tool call.",
  });

  for (const target of targets) {
    const key = betKey(env.SYMBOL, target.timestamp);
    const prompt = buildPrompt(target.monthDay, env.CONFIDENCE_PERCENT);
    const executeThisBet = !env.DRY_RUN && !successfulKeys.has(key);

    const fallbackInputBase = buildTorchToolInputFromKnownContext(
      env,
      target.timestamp,
      "",
      executeThisBet
    );

    const userContent =
      `Place the Torch bet for targetTimestamp=${target.timestamp}.\n` +
      `monthDay=${target.monthDay}\n` +
      `betKey=${key}\n` +
      `executeThisBet=${executeThisBet}\n\n` +
      `You must:\n` +
      `1) Use the following forecastPrompt verbatim to generate exactly one forecast line.\n` +
      `2) Call TORCH_PLACE_BET_TOOL exactly once with:\n` +
      `   - torchContractId=${env.TORCH_CONTRACT_ID}\n` +
      `   - gasLimit=${env.GAS_LIMIT}\n` +
      `   - targetTimestamp=${target.timestamp}\n` +
      `   - stakeHbar=${env.STAKE_HBAR}\n` +
      `   - execute=${executeThisBet}\n` +
      `   - forecastRaw=(the exact generated forecast line)\n\n` +
      `forecastPrompt:\n${prompt}\n`;

    try {
      const state = await agent.invoke({
        messages: [{ role: "user", content: userContent }],
      });

      let toolArtifact = extractTorchToolArtifact(state.messages as unknown[]);

      if (!toolArtifact && torchTool) {
        const recoveredInput = extractTorchToolInputFromMessages(
          state.messages as unknown[],
          torchToolName,
          fallbackInputBase
        );

        if (recoveredInput) {
          log.warn(
            { betKey: key, targetTimestamp: target.timestamp, recoveredInput },
            "Falling back to direct Torch tool invocation from assistant tool call args"
          );

          toolArtifact = await invokeTorchToolDirect(torchTool, recoveredInput);
        }
      }

      if (!toolArtifact && torchTool) {
        const recoveredForecastRaw = extractForecastLineFromMessages(
          state.messages as unknown[]
        );

        if (recoveredForecastRaw) {
          const recoveredInput = buildTorchToolInputFromKnownContext(
            env,
            target.timestamp,
            recoveredForecastRaw,
            executeThisBet
          );

          log.warn(
            {
              betKey: key,
              targetTimestamp: target.timestamp,
              recoveredForecastRaw,
            },
            "Falling back to direct Torch tool invocation from recovered forecast line"
          );

          toolArtifact = await invokeTorchToolDirect(torchTool, recoveredInput);
        }
      }

      if (!toolArtifact) {
        log.error(
          {
            betKey: key,
            targetTimestamp: target.timestamp,
            messageSummary: summarizeMessages(state.messages as unknown[]),
          },
          "Agent returned messages but no Torch tool artifact was found"
        );

        throw new Error("Tool output not found in agent messages");
      }

      forecasts.push({
        betKey: key,
        targetTimestamp: target.timestamp,
        monthDay: target.monthDay,
        prompt,
        raw: toolArtifact.forecastRaw,
        minStr: toolArtifact.minStr,
        maxStr: toolArtifact.maxStr,
      });

      betParams.push({
        betKey: key,
        priceMinStr: toolArtifact.priceMinStr,
        priceMaxStr: toolArtifact.priceMaxStr,
        priceMinInt: toolArtifact.priceMinInt,
        priceMaxInt: toolArtifact.priceMaxInt,
        stakeHbar: toolArtifact.stakeHbar,
      });

      if (executeThisBet) {
        results.push({
          betKey: key,
          targetTimestamp: target.timestamp,
          txId: toolArtifact.txId,
          status: toolArtifact.status,
          prompt,
          raw: toolArtifact.forecastRaw,
          minStr: toolArtifact.minStr,
          maxStr: toolArtifact.maxStr,
        });

        if (toolArtifact.txId && toolArtifact.status === 22) {
          successfulKeys.add(key);
        }

        log.info(
          {
            betKey: key,
            targetTimestamp: target.timestamp,
            txId: toolArtifact.txId,
            status: toolArtifact.status,
          },
          "Agent Kit bet processed"
        );
      } else if (env.DRY_RUN) {
        results.push({
          betKey: key,
          targetTimestamp: target.timestamp,
          dryRun: true,
          prompt,
          raw: toolArtifact.forecastRaw,
          minStr: toolArtifact.minStr,
          maxStr: toolArtifact.maxStr,
        });

        log.info(
          { betKey: key, targetTimestamp: target.timestamp },
          "DRY_RUN: Agent Kit would place bet"
        );
      } else {
        results.push({
          betKey: key,
          targetTimestamp: target.timestamp,
          skippedDuplicate: true,
          prompt,
          raw: toolArtifact.forecastRaw,
          minStr: toolArtifact.minStr,
          maxStr: toolArtifact.maxStr,
        });

        log.info({ betKey: key }, "Skipping duplicate (already placed today)");
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);

      log.error(
        { betKey: key, targetTimestamp: target.timestamp, error: errMsg },
        "Agent run failed for target"
      );

      results.push({
        betKey: key,
        targetTimestamp: target.timestamp,
        error: errMsg,
        prompt,
      });
    }
  }

  if (artifact) {
    artifact.runId = runId;
    artifact.timestampUtc = new Date().toISOString();
    artifact.provider = provider;
    artifact.forecasts = forecasts;
    artifact.betParams = betParams;
  } else {
    artifact = {
      runId,
      timestampUtc: new Date().toISOString(),
      provider,
      forecasts,
      betParams,
      results: [],
    };
  }

  artifact.results = [...(artifact.results ?? []), ...results];
  await saveArtifact(RUNS_DIR, dateStr, artifact);

  log.info({ runId, dateStr, resultsCount: results.length }, "Agent Kit daily run finished");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});