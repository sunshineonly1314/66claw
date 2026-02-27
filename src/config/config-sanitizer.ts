/**
 * Configuration Sanitizer
 *
 * 安全地清理和修复配置文件中的常见问题
 * Safely cleans and fixes common configuration issues
 *
 * 用途:
 * 1. 移除无效的字段值
 * 2. 修复格式错误
 * 3. 确保向后兼容性
 */

export interface SanitizeResult {
  config: Record<string, unknown>;
  modified: boolean;
  changes: string[];
}

function sanitizeToolsConfig(config: Record<string, unknown>): {
  modified: boolean;
  changes: string[];
} {
  const changes: string[] = [];
  let modified = false;

  if (!config.tools || typeof config.tools !== "object") {
    return { modified, changes };
  }

  const tools = config.tools as Record<string, unknown>;

  // 0. 先清理 tools.web 本身 (如果是 null 或非对象)
  if (tools.web !== undefined && (typeof tools.web !== "object" || tools.web === null)) {
    delete tools.web;
    modified = true;
    changes.push("Fixed malformed tools.web (expected object)");
  }

  // 1. 清理 tools.web 的子字段
  if (tools.web && typeof tools.web === "object" && tools.web !== null) {
    const web = tools.web as Record<string, unknown>;

    if (web.search !== undefined && (typeof web.search !== "object" || web.search === null)) {
      delete web.search;
      modified = true;
      changes.push("Fixed malformed tools.web.search (expected object)");
    }

    if (web.fetch !== undefined && (typeof web.fetch !== "object" || web.fetch === null)) {
      delete web.fetch;
      modified = true;
      changes.push("Fixed malformed tools.web.fetch (expected object)");
    }

    if (web.search && typeof web.search === "object" && web.search !== null) {
      const search = web.search as Record<string, unknown>;
      const provider = search.provider;
      const validProviders = ["brave", "perplexity", "grok", "baidu", "bing", "bocha"];

      if (provider !== undefined) {
        if (provider === null || provider === "" || typeof provider !== "string") {
          delete search.provider;
          modified = true;
          changes.push("Removed invalid tools.web.search.provider (null or empty)");
        } else if (!validProviders.includes(provider)) {
          delete search.provider;
          modified = true;
          changes.push(`Removed unsupported tools.web.search.provider: "${provider}"`);
        }
      }
    }

    if (web.fetch && typeof web.fetch === "object" && web.fetch !== null) {
      const fetch = web.fetch as Record<string, unknown>;
      if (
        fetch.firecrawl !== undefined &&
        (typeof fetch.firecrawl !== "object" || fetch.firecrawl === null)
      ) {
        delete fetch.firecrawl;
        modified = true;
        changes.push("Fixed malformed tools.web.fetch.firecrawl (expected object)");
      }
    }
  }

  // 2. 清理 tools.write 和 tools.browser
  if (tools.write !== undefined && (typeof tools.write !== "object" || tools.write === null)) {
    delete tools.write;
    modified = true;
    changes.push("Fixed malformed tools.write (expected object)");
  }
  if (
    tools.browser !== undefined &&
    (typeof tools.browser !== "object" || tools.browser === null)
  ) {
    delete tools.browser;
    modified = true;
    changes.push("Fixed malformed tools.browser (expected object)");
  }

  return { modified, changes };
}

function sanitizeMcpConfig(config: Record<string, unknown>): {
  modified: boolean;
  changes: string[];
} {
  const changes: string[] = [];
  let modified = false;

  if (config.mcp !== undefined) {
    if (typeof config.mcp !== "object" || config.mcp === null) {
      delete config.mcp;
      modified = true;
      changes.push("Removed malformed mcp config (expected object)");
    } else {
      const mcp = config.mcp as Record<string, unknown>;
      if (mcp.servers !== undefined) {
        if (!Array.isArray(mcp.servers)) {
          delete mcp.servers;
          modified = true;
          changes.push("Fixed malformed mcp.servers (expected array)");
        }
      }
    }
  }

  return { modified, changes };
}

function sanitizeUnknownRootFields(config: Record<string, unknown>): {
  modified: boolean;
  changes: string[];
} {
  const changes: string[] = [];
  let modified = false;

  const validRootFields = new Set([
    "meta",
    "license",
    "env",
    "setup",
    "wizard",
    "diagnostics",
    "logging",
    "update",
    "browser",
    "ui",
    "auth",
    "models",
    "nodeHost",
    "agents",
    "tools",
    "bindings",
    "broadcast",
    "audio",
    "media",
    "messages",
    "commands",
    "approvals",
    "session",
    "cron",
    "hooks",
    "web",
    "channels",
    "discovery",
    "canvasHost",
    "talk",
    "gateway",
    "skills",
    "plugins",
    "freeModels",
    "mcp",
  ]);

  const keys = Object.keys(config);
  for (const key of keys) {
    if (!validRootFields.has(key)) {
      changes.push(`Warning: Unknown root-level field detected: "${key}"`);
    }
  }

  // Sanitize gateway section — ensure port has valid type (common user error)
  if (
    config.gateway !== undefined &&
    config.gateway !== null &&
    typeof config.gateway === "object"
  ) {
    const gw = config.gateway as Record<string, unknown>;
    if (gw.port !== undefined && typeof gw.port !== "number") {
      const parsed = Number(gw.port);
      if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) {
        gw.port = parsed;
        modified = true;
        changes.push(`Fixed gateway.port: coerced string to number ${parsed}`);
      }
    }
  }

  return { modified, changes };
}

/**
 * 主清理函数 / Main sanitization function
 */
export function sanitizeConfig(config: Record<string, unknown>): SanitizeResult {
  // 防御性检查：传入非对象直接返回，不崩溃
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { config: config ?? {}, modified: false, changes: [] };
  }

  let sanitized: Record<string, unknown>;
  try {
    sanitized = JSON.parse(JSON.stringify(config));
  } catch {
    // 配置包含不可序列化的值（circular ref 等），直接返回原对象
    return { config, modified: false, changes: [] };
  }

  const allChanges: string[] = [];
  let anyModified = false;

  const toolsResult = sanitizeToolsConfig(sanitized);
  if (toolsResult.modified) {
    anyModified = true;
    allChanges.push(...toolsResult.changes);
  }

  const mcpResult = sanitizeMcpConfig(sanitized);
  if (mcpResult.modified) {
    anyModified = true;
    allChanges.push(...mcpResult.changes);
  }

  const unknownResult = sanitizeUnknownRootFields(sanitized);
  allChanges.push(...unknownResult.changes);

  return {
    config: sanitized,
    modified: anyModified,
    changes: allChanges,
  };
}

/**
 * 检查配置是否需要清理 / Check if configuration needs sanitization
 */
export function needsSanitization(config: Record<string, unknown>): boolean {
  const result = sanitizeConfig(config);
  return result.modified || result.changes.length > 0;
}

// ── Credential redaction for API responses ──────────────────────────

const REDACTED = "***";

const SENSITIVE_KEY_PATTERNS = [
  /apiKey$/i,
  /api_key$/i,
  /^token$/i,
  /Token$/,
  /secret$/i,
  /Secret$/,
  /password$/i,
  /Password$/,
  /^encodingAESKey$/i,
  /^encryptKey$/i,
  /^key$/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

function redactValue(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => redactValue(item));
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (isSensitiveKey(key) && typeof value === "string" && value.length > 0) {
        result[key] = REDACTED;
      } else {
        result[key] = redactValue(value);
      }
    }
    return result;
  }
  return obj;
}

/**
 * 对配置快照中的凭据进行脱敏，用于 API 响应
 * Redact credentials from a config snapshot for API responses.
 *
 * Recursively replaces string values whose key matches sensitive patterns
 * (apiKey, token, secret, password, etc.) with "***".
 */
export function redactConfigSnapshot<T extends Record<string, unknown>>(snapshot: T): T {
  try {
    const cloned = JSON.parse(JSON.stringify(snapshot)) as T;
    // Redact the parsed config object
    if ("config" in cloned && cloned.config && typeof cloned.config === "object") {
      (cloned as Record<string, unknown>).config = redactValue(cloned.config);
    }
    // Redact the raw JSON string (replace sensitive values inline)
    if ("raw" in cloned && typeof cloned.raw === "string") {
      (cloned as Record<string, unknown>).raw = redactRawConfigString(cloned.raw as string);
    }
    return cloned;
  } catch {
    return snapshot;
  }
}

function redactRawConfigString(raw: string): string {
  // Match JSON key-value patterns for sensitive keys and replace the value
  // Handles both JSON ("key": "value") and JSON5 (key: "value") formats
  return raw.replace(
    /("?(?:apiKey|api_key|token|botToken|appToken|userToken|signingSecret|appSecret|signSecret|secret|password|appPassword|encodingAESKey|encryptKey|verificationToken|key)"?\s*:\s*)"([^"]+)"/gi,
    '$1"***"',
  );
}
