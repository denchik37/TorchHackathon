/**
 * Daily bet runner using a true LangChain createAgent autonomous loop.
 *
 * Key constraint preserved:
 * - Per-target LLM prompt is identical to the existing bot (`buildPrompt()`).
 * - Run artifacts written to `runs/YYYY-MM-DD.json` keep the same shape.
 * - On-chain execution is performed by your custom Hedera Agent Kit plugin tool.
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import pino from "pino";
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

import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { HederaLangchainToolkit, AgentMode } from "hedera-agent-kit";
import {
  torchPlaceBetPlugin,
  torchPlaceBetPluginToolNames,
  type TorchPlaceBetResult,
} from "@torch/hedera-agent-kit-torch-plugin";

const RUNS_DIR = "runs";

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

function extractTorchToolArtifact(messages: unknown[]): TorchPlaceBetResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as any;
    if (!m || m.type !== "tool") continue;

    // Preferred: langchain ToolMessage.artifact contains full tool output.
    if (m.artifact && typeof m.artifact === "object" && m.artifact.forecastRaw) {
      return m.artifact as TorchPlaceBetResult;
    }

    // Fallback: sometimes content is JSON.
    if (
      typeof m.content === "string" &&
      m.content.trim().startsWith("{") &&
      m.content.includes("forecastRaw")
    ) {
      try {
        const parsed = JSON.parse(m.content);
        if (parsed && parsed.forecastRaw) return parsed as TorchPlaceBetResult;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

export async function main(): Promise<void> {
  const env = getEnv();
  const log = getLogger();
  const dateStr = todayStr();
  const runId = randomUUID();

  log.info({ runId, dateStr }, "Starting daily bet run (Agent Kit / LangChain)");

  let artifact = await loadRunArtifact(RUNS_DIR, dateStr);
  const successfulKeys = artifact
    ? getSuccessfulBetKeys(artifact)
    : new Set<string>();

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

  // We need a Hedera client for the tool execution path. In parse-only mode
  // (`execute=false`) it will not submit transactions, but the toolkit still
  // requires an initialized client.
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
    }),
    // HederaLangchainToolkit returns HederaAgentKitTool wrappers which are runtime-compatible
    // with LangChain tools, but the TS types don't align 1:1 in this repo's versions.
    tools: toolkit.getTools() as any,
    systemPrompt:
      "You are a deterministic TorchPredictionMarket bet assistant.\n" +
      "When given a forecastPrompt, you MUST generate exactly one line in the format \"Min: x, Max: y\".\n" +
      "Then you MUST call TORCH_PLACE_BET_TOOL with forecastRaw equal to that exact line.\n" +
      "Do not include any other text in the tool call beyond what is required by the schema.",
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
      `Your only job is:\n` +
      `1) Use the following forecastPrompt verbatim to generate the forecast line.\n` +
      `2) Call TORCH_PLACE_BET_TOOL with:\n` +
      `   - torchContractId=${env.TORCH_CONTRACT_ID}\n` +
      `   - gasLimit=${env.GAS_LIMIT}\n` +
      `   - targetTimestamp=${target.timestamp}\n` +
      `   - stakeHbar=${env.STAKE_HBAR}\n` +
      `   - execute=${executeThisBet}\n` +
      `   - forecastRaw=(exact forecast line)\n\n` +
      `forecastPrompt:\n${prompt}\n`;

    try {
      const state = await agent.invoke({
        messages: [{ role: "user", content: userContent }],
      });

      const toolArtifact = extractTorchToolArtifact(state.messages as unknown[]);
      if (!toolArtifact) {
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
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      log.error({ betKey: key, error: errMsg }, "Agent run failed for target");

      // Preserve the artifact behavior: record the error in results and skip tx fields.
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
  log.info({ runId }, "Agent Kit daily run finished");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

