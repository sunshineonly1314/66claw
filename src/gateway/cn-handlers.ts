/**
 * CN-only gateway handlers aggregator.
 *
 * 聚合所有 CN 独有的 gateway method handler，通过 server.impl.ts 的
 * extraHandlers 注入，避免修改上游 server-methods.ts 造成合并冲突。
 *
 * 新增 CN-only handler 时，在此文件导入并展开即可。
 */

import type { GatewayRequestHandlers } from "./server-methods/types.js";
import { modalityCapabilityHandlers } from "./server-methods/modality-capability.js";
import {
  mcpMarketplaceSearch,
  mcpMarketplaceGetById,
  mcpMarketplaceGetStats,
  mcpMarketplaceGetCategories,
} from "./server-methods/mcp-marketplace-search.js";
import {
  skillsMarketplaceSearch,
  skillsMarketplaceGetById,
  skillsMarketplaceGetStats,
  skillsMarketplaceGetCategories,
} from "./server-methods/skills-marketplace-search.js";
import { diagnoseHandlers } from "./server-methods/diagnose.js";
import { feedbackHandlers } from "./server-methods/feedback.js";
import { logReportHandlers } from "./server-methods/log-report.js";
import { licenseHandlers } from "./server-methods/license.js";
import { asrHandlers } from "./server-methods/asr.js";
import { asrStreamingHandlers } from "./server-methods/asr-streaming.js";
import { voiceTierHandlers } from "./server-methods/voice-tier.js";
import { imagegenTierHandlers } from "./server-methods/imagegen-tier.js";
import { kwsStreamingHandlers } from "./server-methods/kws-streaming.js";
import { capabilityMatrixHandlers } from "./server-methods/capability-matrix.js";
import { localEngineHandlers } from "./server-methods/local-engine.js";
import { updateExecuteHandlers } from "./server-methods/update-execute.js";
import { networkingHandlers } from "./server-methods/networking.js";
import { orchestratorHandlers } from "./server-methods/orchestrator.js";

export const cnGatewayHandlers: GatewayRequestHandlers = {
  ...modalityCapabilityHandlers,

  // MCP Marketplace Search API
  "mcp_marketplace.search": mcpMarketplaceSearch,
  "mcp_marketplace.get_by_id": mcpMarketplaceGetById,
  "mcp_marketplace.get_stats": mcpMarketplaceGetStats,
  "mcp_marketplace.get_categories": mcpMarketplaceGetCategories,

  // Skills Marketplace Search API
  "skills_marketplace.search": skillsMarketplaceSearch,
  "skills_marketplace.get_by_id": skillsMarketplaceGetById,
  "skills_marketplace.get_stats": skillsMarketplaceGetStats,
  "skills_marketplace.get_categories": skillsMarketplaceGetCategories,

  // Self-Troubleshoot Diagnostics API
  ...diagnoseHandlers,

  // User Feedback API
  ...feedbackHandlers,

  // Log Report to Ops Center API
  ...logReportHandlers,

  // License API (license.status, license.activate, etc.)
  ...licenseHandlers,

  // Voice: ASR (offline transcription via sherpa-onnx)
  ...asrHandlers,

  // Voice: ASR Streaming (tier-aware: GPU / VAD / CPU backends)
  ...asrStreamingHandlers,

  // Voice: Tier detection, model install, GPU sidecar control
  ...voiceTierHandlers,

  // ImageGen: Tier detection, model install, sd.cpp sidecar control
  ...imagegenTierHandlers,

  // Voice: KWS wake word streaming detection
  ...kwsStreamingHandlers,

  // Capability Matrix: unified 10-dimension capability status for model settings UI
  ...capabilityMatrixHandlers,

  // Local AI Engine: unified local model hub (hardware detect + install + sidecar control)
  ...localEngineHandlers,

  // Smooth Update: check, status, execute, dismiss
  ...updateExecuteHandlers,

  // Networking Center: status, discover, probe, configure, interfaces
  ...networkingHandlers,

  // Orchestrator: templates, community, deploy, plans, agents
  ...orchestratorHandlers,
};
