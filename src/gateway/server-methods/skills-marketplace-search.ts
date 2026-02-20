/**
 * Skills Marketplace Search Gateway Handlers
 * CN-ONLY FILE - 完全独立实现
 *
 * 提供 Skills 市场的搜索、分页、统计 API
 */

import type { GatewayRequestHandler } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  searchItems,
  getItemById,
  getItemsByIds,
  getStats,
  getCategoryStats,
} from "../../agents/skills/marketplace/db.js";
import { loadConfig } from "../../config/config.js";
import type { SkillSearchResult } from "../../agents/skills/marketplace/types.js";

// ========== skills_marketplace.search ==========

export const skillsMarketplaceSearch: GatewayRequestHandler = async ({ params, respond }) => {
  try {
    // 输入验证
    const keyword = typeof params.keyword === "string" ? params.keyword.trim() : undefined;
    if (keyword && keyword.length > 500) {
      return respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_ARGUMENT, "Keyword too long (max 500 chars)"),
      );
    }

    // 验证 page
    const rawPage = params.page as number | undefined;
    let validPage = 1;
    if (rawPage !== undefined) {
      if (!Number.isInteger(rawPage) || rawPage < 1 || rawPage > 1000000) {
        return respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_ARGUMENT, "page must be between 1 and 1000000"),
        );
      }
      validPage = rawPage;
    }

    // 验证 pageSize
    const rawPageSize = params.pageSize as number | undefined;
    let validPageSize = 20;
    if (rawPageSize !== undefined) {
      if (!Number.isInteger(rawPageSize) || rawPageSize < 1 || rawPageSize > 100) {
        return respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_ARGUMENT, "pageSize must be between 1 and 100"),
        );
      }
      validPageSize = rawPageSize;
    }

    // 提取过滤参数（空字符串视为无过滤）
    const category = typeof params.category === "string" && params.category ? params.category : undefined;
    const tier = typeof params.tier === "string" && params.tier ? params.tier : undefined;
    const cnBlocked = typeof params.cnBlocked === "boolean" ? params.cnBlocked : undefined;
    const installed = typeof params.installed === "boolean" ? params.installed : undefined;
    // 默认只显示远端可下载的 skills（source='proxy'），排除仅有评测数据的 qc 条目
    const source = (params.source === "proxy" || params.source === "qc") ? params.source : "proxy" as const;

    // FTS5 fallback — 原始 skills-index.db 搜索
    const fts5Search = (): SkillSearchResult =>
      searchItems({
        keyword: keyword || undefined,
        category,
        tier,
        cnBlocked,
        installed,
        source,
        orderBy: (params.orderBy as any) || "updated_at",
        orderDirection: (params.orderDirection as any) || "DESC",
        page: validPage,
        pageSize: validPageSize,
      });

    // 当有关键词且长度 >= 2 时，优先走 tool-index.sqlite 的混合搜索（FTS5 trigram + bge-m3 向量 + RRF 融合）
    // 获取语义排序的 skillId[]，再从 skills-index.db 拉完整数据
    // 失败时降级回 skills-index.db 自身的 FTS5 搜索
    let result: SkillSearchResult;

    if (keyword && keyword.length >= 2) {
      try {
        const { searchToolIndex } = await import("../../dispatch/tool-discovery.js");
        const embedding = loadConfig().toolDiscovery?.embedding;
        const { ids } = await searchToolIndex(keyword, {
          type: "skill",
          maxResults: 200,
          embedding,
        });

        if (ids.length > 0) {
          // 拉取全部匹配结果，保持 hybridSearch 的排序
          const fullResult = getItemsByIds(ids, { page: 1, pageSize: ids.length });

          // 在已排序的结果上应用过滤条件
          let filtered = fullResult.items;
          // 按数据来源过滤（默认 proxy = 可下载）
          if (source) {
            filtered = filtered.filter((item) => item.source === source);
          }
          if (category) {
            filtered = filtered.filter((item) => item.category === category);
          }
          if (tier) {
            filtered = filtered.filter((item) => item.tier === tier);
          }
          if (cnBlocked !== undefined) {
            filtered = filtered.filter((item) => Boolean(item.cnBlocked) === cnBlocked);
          }
          if (installed !== undefined) {
            filtered = filtered.filter((item) => Boolean(item.installed) === installed);
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
    console.error("[Skills Marketplace] Search error:", error);
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INTERNAL_ERROR, error.message || "Database search error"),
    );
  }
};

// ========== skills_marketplace.get_by_id ==========

export const skillsMarketplaceGetById: GatewayRequestHandler = async ({ params, respond }) => {
  try {
    const { skillId } = params;

    if (!skillId || typeof skillId !== "string") {
      return respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_ARGUMENT, "skillId is required"),
      );
    }

    const item = getItemById(skillId);

    if (!item) {
      return respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `Skill not found: ${skillId}`),
      );
    }

    respond(true, item);
  } catch (error: any) {
    console.error("[Skills Marketplace] GetById error:", error);
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INTERNAL_ERROR, error.message || "Database query error"),
    );
  }
};

// ========== skills_marketplace.get_stats ==========

export const skillsMarketplaceGetStats: GatewayRequestHandler = async ({ respond }) => {
  try {
    const stats = getStats();
    respond(true, stats);
  } catch (error: any) {
    console.error("[Skills Marketplace] GetStats error:", error);
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INTERNAL_ERROR, error.message || "Database stats error"),
    );
  }
};

// ========== skills_marketplace.get_categories ==========

export const skillsMarketplaceGetCategories: GatewayRequestHandler = async ({ respond }) => {
  try {
    const categories = getCategoryStats();
    respond(true, categories);
  } catch (error: any) {
    console.error("[Skills Marketplace] GetCategories error:", error);
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INTERNAL_ERROR, error.message || "Database categories error"),
    );
  }
};
