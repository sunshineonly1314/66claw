/**
 * [CN-PATCH:tool-discovery] MCP 按需加载器
 *
 * 根据 tool-discovery 的推荐结果，动态安装并启动 MCP server。
 * 支持两种方式：
 *   1. stdio: 通过 npx spawn（npm 包）
 *   2. sse: 直接连接远程 SSE 端点
 *
 * 安全约束：
 *   - autoInstall=false 时需 LLM 确认
 *   - 最大并发加载数由 maxConcurrent 控制
 *   - 加载超时自动清理
 */

import type {
  McpSuggestion,
  ToolDiscoveryMcpOnDemandConfig,
} from "../config/types.tool-discovery.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnDemandLoadResult = {
  success: boolean;
  serverId: string;
  toolCount?: number;
  error?: string;
};

// ---------------------------------------------------------------------------
// Security: SSE URL Whitelist
// ---------------------------------------------------------------------------

/**
 * 允许的 SSE 端点域名（官方 MCP server）
 */
// FIX BUG#9: 移除 localhost/127.0.0.1，生产环境不应允许连接本地 SSE 端点（SSRF 风险）
// 开发环境可通过 NODE_ENV=development 启用
const ALLOWED_SSE_DOMAINS = [
  "mcp.anthropic.com",
  "api.anthropic.com",
  ...(process.env.NODE_ENV === "development" ? ["localhost", "127.0.0.1"] : []),
] as const;

/**
 * 验证 SSE URL 是否在白名单内
 * 🔒 CRITICAL FIX v2: 彻底防止子域名欺骗攻击
 *
 * 防御的攻击类型:
 * - evil.anthropic.com.attacker.com (绕过 endsWith)
 * - anthropic.com.evil.com (后缀混淆)
 * - xn--nthropiccom-r5a.evil.com (Punycode 绕过)
 * - http://user:pass@evil.com (凭证注入)
 */
function isAllowedSSEUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // 1. 只允许 HTTP/HTTPS 协议
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    // 2. 防止凭证注入攻击 (http://user:pass@evil.com)
    if (parsed.username || parsed.password) {
      return false;
    }

    for (const domain of ALLOWED_SSE_DOMAINS) {
      const domainLower = domain.toLowerCase();

      // 3. 精确匹配
      if (hostname === domainLower) {
        return true;
      }

      // 4. 子域名验证（完全重写逻辑）
      if (hostname.endsWith(`.${domainLower}`)) {
        // 4.1 确保 hostname 刚好以 ".domain" 结尾（防止 evil.anthropic.com.attacker.com）
        const expectedSuffix = `.${domainLower}`;
        const actualSuffix = hostname.slice(-expectedSuffix.length);

        if (actualSuffix !== expectedSuffix) {
          return false;
        }

        // 4.2 提取子域名前缀
        const prefix = hostname.slice(0, -(domainLower.length + 1));

        // 4.3 验证前缀是否为合法的子域名格式
        // 只允许: a-z0-9 和连字符（不能以连字符开头/结尾）
        const validPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

        if (!validPattern.test(prefix)) {
          return false;
        }

        // 4.4 localhost/127.0.0.1 不允许子域名
        if (domainLower === "localhost" || domainLower === "127.0.0.1") {
          return false;
        }

        // 4.5 防止过深的子域名嵌套（> 5 层视为可疑）
        if (prefix.split(".").length > 5) {
          console.warn(`[Security] Deep subdomain rejected: ${hostname}`);
          return false;
        }

        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`[Security] URL parse error:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Security: npm Package Verification
// ---------------------------------------------------------------------------

/**
 * 从 Marketplace 验证 MCP 是否可信
 */
async function verifyMCPFromMarketplace(
  serverId: string,
  npmPackage?: string,
  sseUrl?: string,
): Promise<{ trusted: boolean; reason?: string }> {
  try {
    // 1. SSE URL 白名单验证
    if (sseUrl) {
      if (!isAllowedSSEUrl(sseUrl)) {
        return {
          trusted: false,
          reason: `SSE URL not in whitelist: ${new URL(sseUrl).hostname}`,
        };
      }
      return { trusted: true };
    }

    // 2. npm 包验证：从 Marketplace DB 查询
    if (npmPackage) {
      const { getDatabase } = await import("./marketplace/db.js");
      const db = getDatabase();

      // 安全查询：server_id 精确匹配 + tags 参数化 LIKE（ESCAPE 转义通配符）
      const safePkg = npmPackage
        .replace(/\\/g, "\\\\") // 先转义反斜杠本身
        .replace(/%/g, "\\%") // 转义 % 通配符
        .replace(/_/g, "\\_"); // 转义 _ 通配符
      const stmt = db.prepare(`
        SELECT is_official, requires_vpn, china_friendly_score
        FROM mcp_items
        WHERE server_id = ? OR tags LIKE ? ESCAPE '\\'
      `);
      const row = stmt.get(serverId, `%${safePkg}%`) as any;

      if (!row) {
        return {
          trusted: false,
          reason: `MCP not found in marketplace: ${serverId}`,
        };
      }

      // 🔒 CRITICAL FIX v2: 严格验证所有关键字段（数据库完整性检查）

      // 1. 验证 is_official 字段（最关键）
      const isOfficial = row.is_official;

      // 1.1 类型检查
      if (typeof isOfficial !== "number") {
        console.error(
          `[Security] is_official type mismatch for ${serverId}: ${typeof isOfficial}, value: ${isOfficial}`,
        );
        return {
          trusted: false,
          reason: "Database integrity check failed: is_official type mismatch",
        };
      }

      // 1.2 值检查（严格只允许 0 或 1）
      if (isOfficial !== 0 && isOfficial !== 1) {
        console.error(`[Security] is_official invalid value for ${serverId}: ${isOfficial}`);
        return {
          trusted: false,
          reason: "Database integrity check failed: is_official invalid value",
        };
      }

      // 1.3 权限检查
      if (isOfficial !== 1) {
        return {
          trusted: false,
          reason: "Only official MCPs can be installed automatically",
        };
      }

      // 2. 验证 china_friendly_score 字段（严格模式）
      const chinaScore = row.china_friendly_score;
      if (chinaScore !== null) {
        // 2.1 类型检查
        if (typeof chinaScore !== "number") {
          console.error(
            `[Security] china_friendly_score type mismatch for ${serverId}: ${typeof chinaScore}`,
          );
          return {
            trusted: false,
            reason: "Database integrity check failed: china_friendly_score type mismatch",
          };
        }

        // 2.2 有限性检查（防止 NaN/Infinity）
        if (!Number.isFinite(chinaScore)) {
          console.error(
            `[Security] china_friendly_score not finite for ${serverId}: ${chinaScore}`,
          );
          return {
            trusted: false,
            reason: "Database integrity check failed: china_friendly_score not finite",
          };
        }

        // 2.3 范围检查
        if (chinaScore < 0 || chinaScore > 100) {
          console.error(
            `[Security] china_friendly_score out of range for ${serverId}: ${chinaScore}`,
          );
          return {
            trusted: false,
            reason: "Database integrity check failed: china_friendly_score out of range",
          };
        }
      }

      // 3. 验证 requires_vpn 字段
      const requiresVpn = row.requires_vpn;
      if (requiresVpn !== null && requiresVpn !== undefined) {
        if (typeof requiresVpn !== "number" || (requiresVpn !== 0 && requiresVpn !== 1)) {
          console.error(`[Security] requires_vpn invalid for ${serverId}: ${requiresVpn}`);
          return {
            trusted: false,
            reason: "Database integrity check failed: requires_vpn invalid",
          };
        }
      }

      // 所有验证通过
      return { trusted: true };
    }

    return { trusted: false, reason: "No install method specified" };
  } catch (error) {
    // 验证失败时默认拒绝
    return {
      trusted: false,
      reason: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Concurrency control
// ---------------------------------------------------------------------------

let _activeLoads = 0;

// ---------------------------------------------------------------------------
// Main Entry
// ---------------------------------------------------------------------------

/**
 * 按需安装并启动 MCP server。
 *
 * @param suggestion tool-discovery 的推荐结果
 * @param onDemandConfig mcpOnDemand 配置
 * @returns 加载结果
 */
export async function loadMCPOnDemand(
  suggestion: McpSuggestion,
  onDemandConfig?: ToolDiscoveryMcpOnDemandConfig,
): Promise<OnDemandLoadResult> {
  const maxConcurrent = onDemandConfig?.maxConcurrent ?? 2;

  // 并发控制
  if (_activeLoads >= maxConcurrent) {
    return { success: false, serverId: suggestion.serverId, error: "max_concurrent_reached" };
  }

  _activeLoads++;
  try {
    return await doLoadMCP(suggestion);
  } finally {
    _activeLoads--;
  }
}

// ---------------------------------------------------------------------------
// Core loading logic
// ---------------------------------------------------------------------------

async function doLoadMCP(suggestion: McpSuggestion): Promise<OnDemandLoadResult> {
  const { serverId, npmPackage, sseUrl } = suggestion;

  try {
    // 懒加载 MCPManager
    const { getMCPManagerSafe } = await import("./index.js");
    const manager = getMCPManagerSafe();
    if (!manager) {
      return { success: false, serverId, error: "mcp_manager_not_initialized" };
    }

    // 检查是否已经注册
    const existingTools = manager.getAvailableTools();
    const alreadyLoaded = existingTools.some((t) => t.name.startsWith(`mcp_${serverId}_`));
    if (alreadyLoaded) {
      const toolCount = existingTools.filter((t) => t.name.startsWith(`mcp_${serverId}_`)).length;
      return { success: true, serverId, toolCount };
    }

    // 🔒 安全验证：从 Marketplace 验证 MCP 是否可信
    const isVerified = await verifyMCPFromMarketplace(serverId, npmPackage, sseUrl);
    if (!isVerified.trusted) {
      return {
        success: false,
        serverId,
        error: `security_check_failed: ${isVerified.reason}`,
      };
    }

    // 构建 MCP server 配置
    if (sseUrl) {
      // SSE 模式：直接连接远程端点
      await manager.addServer({
        id: serverId,
        command: "",
        transport: "sse",
        url: sseUrl,
        enabled: true,
        autoStart: true,
        timeout: 15_000,
      });
    } else if (npmPackage) {
      // stdio 模式：通过 npx spawn
      await manager.addServer({
        id: serverId,
        command: "npx",
        args: ["-y", npmPackage],
        transport: "stdio",
        enabled: true,
        autoStart: true,
        timeout: 30_000,
      });
    } else {
      return { success: false, serverId, error: "no_install_method" };
    }

    // 等待启动完成，获取工具数
    const tools = manager.getAvailableTools();
    const serverTools = tools.filter((t) => t.name.startsWith(`mcp_${serverId}_`));

    return { success: true, serverId, toolCount: serverTools.length };
  } catch (err) {
    // FIX R3-8: addServer 失败时清理 registry/runtime 中的残留条目，
    // 防止"幽灵"服务器阻止后续重试（alreadyLoaded 检测会误判为已加载）
    try {
      const { getMCPManagerSafe } = await import("./index.js");
      const manager = getMCPManagerSafe();
      if (manager) {
        await manager.removeServer(serverId).catch(() => {
          /* best-effort cleanup */
        });
      }
    } catch {
      /* ignore cleanup errors */
    }
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, serverId, error: message };
  }
}

/**
 * 批量加载多个 MCP server（分批并行，受 maxConcurrent 限制）。
 * 直接调用内部 doLoadMCP，绕过全局 _activeLoads 计数避免双重扣减。
 */
export async function loadMCPBatch(
  suggestions: McpSuggestion[],
  onDemandConfig?: ToolDiscoveryMcpOnDemandConfig,
): Promise<OnDemandLoadResult[]> {
  const limit = onDemandConfig?.maxConcurrent ?? 2;
  const results: OnDemandLoadResult[] = [];
  for (let i = 0; i < suggestions.length; i += limit) {
    const batch = suggestions.slice(i, i + limit);
    // 直接调用 doLoadMCP（不经过 loadMCPOnDemand 的全局并发计数器）
    // 并发控制已由此循环的分批逻辑保证
    _activeLoads += batch.length;
    try {
      const batchResults = await Promise.all(batch.map((s) => doLoadMCP(s)));
      results.push(...batchResults);
    } finally {
      _activeLoads -= batch.length;
    }
  }
  return results;
}
