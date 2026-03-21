import type { Context, Plugin } from "hedera-agent-kit";
import {
  executeTorchPlaceBet,
  torchPlaceBetTool,
  torchPlaceBetPluginToolNames,
  type TorchPlaceBetResult,
} from "./tools/torchPlaceBetTool.js";

export const torchPlaceBetPlugin: Plugin = {
  name: "torch-plugin",
  version: "0.1.0",
  description: "Custom tool plugin for TorchPredictionMarket.placeBet.",
  tools: (context: Context) => [torchPlaceBetTool(context)],
};

export { executeTorchPlaceBet };
export type { TorchPlaceBetResult };
export { torchPlaceBetPluginToolNames };

export default {
  torchPlaceBetPlugin,
  torchPlaceBetPluginToolNames,
  executeTorchPlaceBet,
};

