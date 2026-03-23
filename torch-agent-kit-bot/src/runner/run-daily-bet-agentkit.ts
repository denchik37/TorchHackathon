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
import { getNextEligibleTargets } from "../time/targets.js";
import {
  betKey,
  getSuccessfulBetKeys,
  loadRunArtifact,
  saveArtifact,
  type RunArtifact,
} from "../storage/runStore.js";

const RUNS_DIR = process.env.BETTING_RUNS_DIR ?? "runs";

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
  if (!value || typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;

  if (looksLikeTorchPlaceBetResult(obj)) {
    return obj as unknown as TorchPlaceBetResult;
  }

  for (const key of ["result", "output", "artifact", "data", "response"]) {
    const nested = obj[key];
    if (nested && typeof nested === "object") {
      const parsed = tryParseToolResultObject(nested);
      if (parsed) return parsed;
    }
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

      if (part && typeof part === "object") {
        const p = part as Record<string, unknown>;

        if (typeof p.text === "string") out.push(p.text);
        if (typeof p.content === "string") out.push(p.content);
        if (typeof p.output === "string") out.push(p.output);

        if (p.text && typeof p.text === "object") {
          out.push(safeStringPreview(p.text));
        }
      }
    }
  }

  return out;
}

function extractTorchToolArtifact(messages: unknown[]): TorchPlaceBetResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as any;
    if (!m) continue;

    const fromArtifact =
      tryParseToolResultObject(m.artifact) ||
      tryParseToolResultObject(m.additional_kwargs) ||
      tryParseToolResultObject(m.kwargs) ||
      tryParseToolResultObject(m.response_metadata);

    if (fromArtifact) return fromArtifact;

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

  const agent = createAgent({
    model: new ChatOpenAI({
      model: env.OPENAI_MODEL,
      apiKey: env.OPENAI_API_KEY,
      temperature: 0,
    }),
    tools: toolkit.getTools() as any,
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

      const toolArtifact = extractTorchToolArtifact(state.messages as unknown[]);

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
      log.error({ betKey: key, targetTimestamp: target.timestamp, error: errMsg }, "Agent run failed for target");

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