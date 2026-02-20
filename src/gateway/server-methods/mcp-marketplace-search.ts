/**
 * MCP Marketplace Search Gateway Handler
 * CN-ONLY FILE - 完全独立实现
 *
 * 提供 MCP 市场的搜索、分页、统计 API
 */

import type { GatewayRequestHandler } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  searchItems,
  getItemById,
  getItemsByServerIds,
  getStats,
  getCategoryStats,
  type SearchOptions,
  type SearchResult,
} from "../../mcp/marketplace/db.js";
import { loadConfig } from "../../config/config.js";

// ========== mcp_marketplace.search ==========

export const mcpMarketplaceSearch: GatewayRequestHandler = async ({ params, respond }) => {
  try {
    // 输入验证
    if (params.keyword && typeof params.keyword === "string" && params.keyword.length > 500) {
      return respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_ARGUMENT, "Keyword too long (max 500 chars)"),
      );
    }

    // 🔒 CRITICAL FIX v2: 严格输入验证防止整数溢出和精度问题
    const rawPage = params.page as number | undefined;
    const rawPageSize = params.pageSize as number | undefined;

    const MAX_PAGE = 1000000;
    const MAX_PAGE_SIZE = 100;

    // 验证 page: 必须是安全整数，范围 1-1000000
    let validPage = 1;
    if (rawPage !== undefined) {
      // 类型检查
      if (typeof rawPage !== "number") {
        return respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_ARGUMENT, "page must be a number"),
        );
      }

      // 🔒 关键：检查是否为安全整数（防止 IEEE 754 精度丢失）
      if (!Number.isSafeInteger(rawPage)) {
        return respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_ARGUMENT, "page must be a safe integer"),
        );
      }

      // 范围检查
      if (rawPage < 1 || rawPage > MAX_PAGE) {
        return respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_ARGUMENT, `page must be between 1 and ${MAX_PAGE}`),
        );
      }

      validPage = rawPage;
    }

    // 验证 pageSize: 必须是安全整数，范围 1-100
    let validPageSize = 20;
    if (rawPageSize !== undefined) {
      if (typeof rawPageSize !== "number") {
        return respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_ARGUMENT, "pageSize must be a number"),
        );
      }

      if (!Number.isSafeInteger(rawPageSize)) {
        return respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_ARGUMENT, "pageSize must be a safe integer"),
        );
      }

      if (rawPageSize < 1 || rawPageSize > MAX_PAGE_SIZE) {
        return respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_ARGUMENT,
            `pageSize must be between 1 and ${MAX_PAGE_SIZE}`,
          ),
        );
      }

      validPageSize = rawPageSize;
    }

    // 验证 minChinaScore: 必须是安全整数，范围 0-100
    const rawMinChinaScore = params.minChinaScore as number | undefined;
    if (rawMinChinaScore !== undefined) {
      if (typeof rawMinChinaScore !== "number") {
        return respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_ARGUMENT, "minChinaScore must be a number"),
        );
      }

      if (!Number.isSafeInteger(rawMinChinaScore)) {
        return respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_ARGUMENT, "minChinaScore must be a safe integer"),
        );
      }

      if (rawMinChinaScore < 0 || rawMinChinaScore > 100) {
        return respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_ARGUMENT, "minChinaScore must be between 0 and 100"),
        );
      }
    }

    const keyword = typeof params.keyword === "string" ? params.keyword.trim() : undefined;
    const category = params.category as string | undefined;
    const requiresVPN = params.requiresVPN as boolean | undefined;
    const isOfficial = params.isOfficial as boolean | undefined;

    // FTS5 fallback — 原始 mcp-index.db 搜索
    const fts5Search = (): SearchResult =>
      searchItems({
        keyword: keyword || undefined,
        category,
        minChinaScore: rawMinChinaScore,
        requiresVPN,
        isOfficial,
        orderBy: (params.orderBy as any) || "updated_at",
        orderDirection: (params.orderDirection as any) || "DESC",
        page: validPage,
        pageSize: validPageSize,
      });

    // 当有关键词且长度 >= 2 时，优先走 tool-index.sqlite 的混合搜索
    // （FTS5 trigram + bge-m3 向量 + RRF 融合），获取语义排序的 serverId[]，
    // 再从 mcp-index.db 拉完整数据。失败时降级回 mcp-index.db 自身的 FTS5 搜索。
    let result: SearchResult;

    if (keyword && keyword.length >= 2) {
      try {
        const { searchToolIndex } = await import("../../dispatch/tool-discovery.js");
        const embedding = loadConfig().toolDiscovery?.embedding;
        const { ids } = await searchToolIndex(keyword, {
          type: "mcp",
          maxResults: 200,
          embedding,
        });

        if (ids.length > 0) {
          // 拉取全部匹配结果，保持 hybridSearch 的排序
          const fullResult = getItemsByServerIds(ids, { page: 1, pageSize: ids.length });

          // 在已排序的结果上应用过滤条件
          let filtered = fullResult.items;
          if (category) {
            filtered = filtered.filter((item) => item.category === category);
          }
          if (rawMinChinaScore !== undefined) {
            filtered = filtered.filter((item) =>
              (item.availability?.chinaFriendlyScore ?? 0) >= rawMinChinaScore,
            );
          }
          if (requiresVPN !== undefined) {
            filtered = filtered.filter((item) =>
              Boolean(item.availability?.requiresVPN) === requiresVPN,
            );
          }
          if (isOfficial !== undefined) {
            filtered = filtered.filter((item) => Boolean(item.isOfficial) === isOfficial);
          }

          // 手动分页
          const total = filtered.length;
          const offset = (validPage - 1) * validPageSize;
          const paged = filtered.slice(offset, offset + validPageSize);

          result = {
            items: paged,
            total,
            page: validPage,
            pageSize: validPageSize,
            totalPages: Math.ceil(total / validPageSize),
          };
        } else {
          // hybridSearch 无结果，回退 FTS5
          result = fts5Search();
        }
      } catch {
        // hybridSearch 不可用（索引未建、模块未加载等），回退 FTS5
        result = fts5Search();
      }
    } else {
      // 无关键词或关键词太短，走 FTS5
      result = fts5Search();
    }

    respond(true, result);
  } catch (error: any) {
    console.error("[MCP Marketplace] Search error:", error);
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INTERNAL_ERROR, error.message || "Database search error"),
    );
  }
};

// ========== mcp_marketplace.get_by_id ==========

export const mcpMarketplaceGetById: GatewayRequestHandler = async ({ params, respond }) => {
  try {
    const { serverId } = params;

    if (!serverId || typeof serverId !== "string") {
      return respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_ARGUMENT, "serverId is required"),
      );
    }

    const item = getItemById(serverId);

    if (!item) {
      return respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `MCP not found: ${serverId}`),
      );
    }

    respond(true, item);
  } catch (error: any) {
    console.error("[MCP Marketplace] GetById error:", error);
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INTERNAL_ERROR, error.message || "Database query error"),
    );
  }
};

// ========== mcp_marketplace.get_stats ==========

export const mcpMarketplaceGetStats: GatewayRequestHandler = async ({ respond }) => {
  try {
    const stats = getStats();
    respond(true, stats);
  } catch (error: any) {
    console.error("[MCP Marketplace] GetStats error:", error);
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INTERNAL_ERROR, error.message || "Database stats error"),
    );
  }
};

// ========== mcp_marketplace.get_categories ==========

export const mcpMarketplaceGetCategories: GatewayRequestHandler = async ({ respond }) => {
  try {
    const categories = getCategoryStats();
    respond(true, categories);
  } catch (error: any) {
    console.error("[MCP Marketplace] GetCategories error:", error);
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INTERNAL_ERROR, error.message || "Database categories error"),
    );
  }
};
