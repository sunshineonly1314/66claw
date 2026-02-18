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
  getStats,
  getCategoryStats,
  type SkillSearchOptions,
} from "../../agents/skills/marketplace/db.js";

// ========== skills_marketplace.search ==========

export const skillsMarketplaceSearch: GatewayRequestHandler = async ({ params, respond }) => {
  try {
    // 输入验证
    if (params.keyword && typeof params.keyword === "string" && params.keyword.length > 500) {
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

    const options: SkillSearchOptions = {
      keyword: params.keyword as string | undefined,
      category: params.category as string | undefined,
      tier: params.tier as string | undefined,
      cnBlocked: typeof params.cnBlocked === "boolean" ? params.cnBlocked : undefined,
      installed: typeof params.installed === "boolean" ? params.installed : undefined,
      orderBy: (params.orderBy as any) || "updated_at",
      orderDirection: (params.orderDirection as any) || "DESC",
      page: validPage,
      pageSize: validPageSize,
    };

    const result = searchItems(options);
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
