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
import { MODEL_CONFIG_HANDLERS } from "./server-methods/model-config.js";
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

export const cnGatewayHandlers: GatewayRequestHandlers = {
  ...modalityCapabilityHandlers,
  ...MODEL_CONFIG_HANDLERS,

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
};
