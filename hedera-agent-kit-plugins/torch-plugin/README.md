# Torch Plugin

This plugin was built for the Torch hackathon bot to enable deterministic `TorchPredictionMarket.placeBet(...)` transaction execution using Hedera Agent Kit tooling.

It is intentionally minimal: the 7-day scheduling loop and the LLM prompting remain in your bot runner; this plugin provides the single tool needed to execute (or parse-only) the `placeBet` step.

## Installation

This package is **not published to npm yet** for the hackathon setup. Install it via the local file path in this monorepo:

```bash
npm install ../hedera-agent-kit-plugins/torch-plugin
```

For a future published version, the equivalent command would be:

```bash
npm install @torch/hedera-agent-kit-torch-plugin
```

## Usage

```ts
import { HederaLangchainToolkit, AgentMode } from "hedera-agent-kit";
import {
  torchPlaceBetPlugin,
  torchPlaceBetPluginToolNames,
} from "@torch/hedera-agent-kit-torch-plugin";

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    context: { mode: AgentMode.AUTONOMOUS },
    tools: [torchPlaceBetPluginToolNames.TORCH_PLACE_BET_TOOL],
    plugins: [torchPlaceBetPlugin],
  },
});
```

## Functionality

**TorchPredictionMarket.placeBet tool**

This plugin exposes one deterministic tool:

| Tool Name | Description | Usage |
|---|---|---|
| `TORCH_PLACE_BET_TOOL` | Builds and submits the `placeBet(targetTimestamp, priceMin, priceMax)` contract call (payable HBAR), or runs parse-only mode. Input must include the exact forecast line in the format `Min: x, Max: y`. | Provide tool inputs exactly as documented below; use `execute=false` for dry-runs/validation. |

### Tool inputs

All inputs are validated at runtime (Zod) before execution.

- `torchContractId: string` — TorchPredictionMarket contract id (EVM address or Hedera id, accepted by the Hedera SDK).
- `gasLimit: number` — Gas limit for `ContractExecuteTransaction`.
- `targetTimestamp: number` — Unix timestamp (seconds) used as the `placeBet` `targetTimestamp`.
- `stakeHbar: string` — Payable stake in HBAR (e.g. `"0.1"`).
- `forecastRaw: string` — Exact model output line, expected format: `Min: x, Max: y` (e.g. `Min: 0.08000, Max: 0.15000`).
- `execute: boolean` — When `false`, the tool is parse-only (no on-chain transaction). When `true`, the tool executes the transaction.

### Tool outputs

The tool returns a deterministic JSON object including:

- `executed: boolean`
- Parse results used by the bot/dashboard artifacts:
  - `minStr`, `maxStr`
  - `priceMinInt`, `priceMaxInt` (8dp fixed-point integers as strings)
  - `stakeTinybar` (computed)
- If `execute=true`:
  - `txId`, `status`, and `receipt`

## Notes

- This plugin does **not** implement the daily “next 7 days” scheduling loop. That scheduling remains in your bot runner (systemd timer + runner logic).
- The intent is to keep the tool deterministic given the LLM’s `forecastRaw` string, so tx execution stays aligned with your existing `parseMinMax()` and `betPolicy` behavior.

## Best Practices (implemented)

- Parameter validation: the tool input is validated using Zod before any execution.
- Deterministic interface: the only free-form text input is `forecastRaw`, and the tool strictly parses it using the expected `Min: x, Max: y` format.
- Clear execution model: use `execute=false` for parse-only runs (dry-run / validation) and `execute=true` for on-chain execution.
- Transaction building: the tool uses `@hashgraph/sdk` to build a `ContractExecuteTransaction` calling `placeBet(...)` with explicit gas and payable HBAR.

