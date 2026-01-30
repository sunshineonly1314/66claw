/**
 * Web Setup Wizard HTTP Handler
 * Web 配置向导 HTTP 处理器
 *
 * 为首次安装用户提供 Web 界面配置向导
 * Provides web-based configuration wizard for first-time users
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";

const execAsync = promisify(exec);
import { fileURLToPath } from "node:url";
import type { ClawdbotConfig } from "../config/config.js";
import { loadConfig, writeConfigFile } from "../config/config.js";
import {
  CN_PROVIDERS,
  AFFILIATE_LINKS,
  detectChinaRegion,
  getCnRegionConfig,
  CN_DEFAULT_SECURITY_CONFIG,
  type AffiliateLink,
  type CnProviderConfig,
} from "../config/region-cn.js";
import { scheduleGatewaySigusr1Restart } from "../infra/restart.js";
import {
  setSiliconFlowApiKey,
  setDeepSeekApiKey,
  setGlmApiKey,
  setAliyunBailianApiKey,
  setVolcengineArkApiKey,
  setTencentHunyuanApiKey,
  setMinimaxApiKey,
} from "../commands/onboard-auth.js";
import { serveSetupPage } from "./setup-page.js";
import { discoverSiliconFlowModels } from "../agents/siliconflow-models.js";

// ============================================================================
// 类型定义 (Types)
// ============================================================================

export interface SetupWizardState {
  step: number;
  completed: boolean;
  region: "cn" | "global";
  provider?: string;
  apiKeyConfigured?: boolean;
  channelsConfigured?: string[];
  workspaceConfigured?: boolean;
  securityConfigured?: boolean;
}

interface SetupApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface ProviderListResponse {
  providers: CnProviderConfig[];
  affiliateLinks: AffiliateLink[];
  region: "cn" | "global";
}

interface ValidateApiKeyRequest {
  provider: string;
  apiKey: string;
}

interface ConfigureProviderRequest {
  provider: string;
  apiKey: string;
  model?: string;
}

interface ConfigureWorkspaceRequest {
  workspace: string;
  additionalDirs?: string[];
}

interface ConfigureSecurityRequest {
  mode: "standard" | "trust";
  trustedDirs?: string[];
}

interface ConfigureChannelsRequest {
  channels?: string[];
  dingtalk?: {
    appKey: string;
    appSecret: string;
    robotToken?: string;
  };
  feishu?: {
    appId: string;
    appSecret: string;
    encryptKey?: string;
    verificationToken?: string;
  };
}

// ============================================================================
// 常量 (Constants)
// ============================================================================

const SETUP_API_PREFIX = "/api/setup";
const SETUP_UI_PATH = "/setup";

// ============================================================================
// 辅助函数 (Helper Functions)
// ============================================================================

function sendJson(res: ServerResponse, status: number, body: SetupApiResponse) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.end(JSON.stringify(body));
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(body) as T);
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

function resolveSetupUiRoot(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../control-ui"),
    path.resolve(here, "../../dist/control-ui"),
    path.resolve(process.cwd(), "dist", "control-ui"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

// ============================================================================
// Setup Wizard State Management
// ============================================================================

let setupWizardState: SetupWizardState = {
  step: 1,
  completed: false,
  region: detectChinaRegion() ? "cn" : "global",
};

function getSetupState(): SetupWizardState {
  // 检查是否已完成配置
  const config = loadConfig();
  const hasApiKey = Boolean(
    config.auth?.profiles &&
    Object.keys(config.auth.profiles).length > 0
  );
  const hasWorkspace = Boolean(config.agents?.defaults?.workspace);

  if (hasApiKey && hasWorkspace) {
    setupWizardState.completed = true;
  }

  return setupWizardState;
}

function updateSetupState(updates: Partial<SetupWizardState>): SetupWizardState {
  setupWizardState = { ...setupWizardState, ...updates };
  return setupWizardState;
}

// ============================================================================
// API Handlers
// ============================================================================

/**
 * GET /api/setup/state - 获取向导状态
 */
async function handleGetState(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const state = getSetupState();
  sendJson(res, 200, { ok: true, data: state });
}

/**
 * GET /api/setup/providers - 获取可用的 AI 提供商列表
 */
async function handleGetProviders(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const region = detectChinaRegion() ? "cn" : "global";
  const regionConfig = getCnRegionConfig();

  const response: ProviderListResponse = {
    providers: Object.values(CN_PROVIDERS),
    affiliateLinks: Object.values(AFFILIATE_LINKS),
    region,
  };

  // 如果是中国区，按推荐顺序排序
  if (region === "cn") {
    response.providers = regionConfig.recommendedProviders
      .map((id) => CN_PROVIDERS[id])
      .filter((p): p is CnProviderConfig => p !== undefined);
  }

  sendJson(res, 200, { ok: true, data: response });
}

/**
 * POST /api/setup/validate-api-key - 验证 API Key（基本格式检查）
 */
async function handleValidateApiKey(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<ValidateApiKeyRequest>(req);
  if (!body || !body.provider || !body.apiKey) {
    sendJson(res, 400, { ok: false, error: "缺少必要参数" });
    return;
  }

  const { provider, apiKey } = body;

  // 基本格式验证
  if (apiKey.trim().length < 10) {
    sendJson(res, 400, { ok: false, error: "API Key 格式不正确" });
    return;
  }

  sendJson(res, 200, { ok: true, data: { valid: true } });
}

interface VerifyApiKeyRequest {
  provider: string;
  apiKey: string;
  model?: string;
}

/**
 * POST /api/setup/verify-apikey - 验证 API Key 是否有效（实际调用 API 测试）
 */
async function handleVerifyApiKey(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<VerifyApiKeyRequest>(req);
  if (!body || !body.provider || !body.apiKey) {
    sendJson(res, 400, { ok: false, error: "缺少必要参数" });
    return;
  }

  const { provider, apiKey, model } = body;
  const trimmedKey = apiKey.trim();

  // 基本格式验证
  if (trimmedKey.length < 10) {
    sendJson(res, 200, { ok: true, data: { valid: false, error: "API Key 格式不正确，长度不足" } });
    return;
  }

  try {
    const providerConfig = CN_PROVIDERS[provider];
    if (!providerConfig) {
      sendJson(res, 200, { ok: true, data: { valid: false, error: `不支持的提供商: ${provider}` } });
      return;
    }

    // 根据不同提供商调用对应的验证接口
    const endpoint = providerConfig.apiEndpoint;
    const testModel = model || providerConfig.models[0]?.id || "test";

    // 构建测试请求
    let testUrl = endpoint;
    let testHeaders: Record<string, string> = {};
    let testBody: string = "";

    if (provider === "siliconflow") {
      testUrl = `${endpoint}/chat/completions`;
      testHeaders = {
        "Authorization": `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (provider === "aliyun-bailian") {
      testUrl = `${endpoint}/chat/completions`;
      testHeaders = {
        "Authorization": `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (provider === "deepseek") {
      testUrl = `${endpoint}/chat/completions`;
      testHeaders = {
        "Authorization": `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (provider === "glm") {
      testUrl = `${endpoint}/chat/completions`;
      testHeaders = {
        "Authorization": `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (provider === "volcengine-ark") {
      testUrl = `${endpoint}/chat/completions`;
      testHeaders = {
        "Authorization": `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (provider === "tencent-hunyuan") {
      // 腾讯混元使用不同的认证方式，暂时跳过实际验证
      sendJson(res, 200, { ok: true, data: { valid: true, message: "格式验证通过" } });
      return;
    } else if (provider === "minimax") {
      testUrl = `${endpoint}/messages`;
      testHeaders = {
        "x-api-key": trimmedKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else {
      // 未知提供商，仅做格式验证
      sendJson(res, 200, { ok: true, data: { valid: true, message: "格式验证通过" } });
      return;
    }

    // 发起测试请求
    const response = await fetch(testUrl, {
      method: "POST",
      headers: testHeaders,
      body: testBody,
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      sendJson(res, 200, { ok: true, data: { valid: true, message: "API Key 验证成功" } });
    } else {
      const errorText = await response.text();
      let errorMessage = "API Key 无效";
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        if (response.status === 401) {
          errorMessage = "API Key 无效或已过期";
        } else if (response.status === 403) {
          errorMessage = "API Key 权限不足";
        } else if (response.status === 429) {
          errorMessage = "请求频率超限，请稍后重试";
        }
      }
      
      sendJson(res, 200, { ok: true, data: { valid: false, error: errorMessage } });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT")) {
      sendJson(res, 200, { ok: true, data: { valid: false, error: "连接超时，请检查网络或稍后重试" } });
    } else {
      sendJson(res, 200, { ok: true, data: { valid: false, error: `验证失败: ${errorMsg}` } });
    }
  }
}

/**
 * POST /api/setup/configure-provider - 配置 AI 提供商
 */
async function handleConfigureProvider(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<ConfigureProviderRequest>(req);
  if (!body || !body.provider || !body.apiKey) {
    sendJson(res, 400, { ok: false, error: "缺少必要参数" });
    return;
  }

  const { provider, apiKey, model } = body;

  try {
    // 保存 API Key
    const trimmedKey = apiKey.trim();
    if (provider === "siliconflow") {
      await setSiliconFlowApiKey(trimmedKey);
    } else if (provider === "deepseek") {
      await setDeepSeekApiKey(trimmedKey);
    } else if (provider === "glm") {
      await setGlmApiKey(trimmedKey);
    } else if (provider === "aliyun-bailian") {
      await setAliyunBailianApiKey(trimmedKey);
    } else if (provider === "volcengine-ark") {
      await setVolcengineArkApiKey(trimmedKey);
    } else if (provider === "tencent-hunyuan") {
      await setTencentHunyuanApiKey(trimmedKey);
    } else if (provider === "minimax") {
      await setMinimaxApiKey(trimmedKey);
    } else {
      sendJson(res, 400, { ok: false, error: `不支持的提供商: ${provider}` });
      return;
    }

    // 更新配置
    const config = loadConfig();
    const providerConfig = CN_PROVIDERS[provider];
    const defaultModel = model || providerConfig?.models[0]?.id;
    const modelRef = defaultModel ? `${provider}/${defaultModel}` : undefined;

    const nextConfig: ClawdbotConfig = {
      ...config,
      auth: {
        ...config.auth,
        profiles: {
          ...config.auth?.profiles,
          [`${provider}:default`]: {
            provider,
            mode: "api_key",
          },
        },
        order: {
          ...config.auth?.order,
          [provider]: [`${provider}:default`],
        },
      },
      agents: {
        ...config.agents,
        defaults: {
          ...config.agents?.defaults,
          model: modelRef
            ? {
                ...config.agents?.defaults?.model,
                primary: modelRef,
              }
            : config.agents?.defaults?.model,
        },
      },
    };

    await writeConfigFile(nextConfig);

    updateSetupState({
      step: 2,
      provider,
      apiKeyConfigured: true,
    });

    sendJson(res, 200, { ok: true, data: { configured: true, model: modelRef } });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `配置失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * POST /api/setup/validate-path - 验证路径是否存在且可访问
 */
async function handleValidatePath(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<{ path: string }>(req);
  if (!body || !body.path) {
    sendJson(res, 400, { ok: false, error: "缺少路径参数" });
    return;
  }

  const targetPath = body.path.trim();

  try {
    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      sendJson(res, 200, {
        ok: true,
        data: {
          valid: false,
          exists: true,
          isDirectory: false,
          error: "指定的路径不是目录",
        },
      });
      return;
    }

    // 检查是否可读
    try {
      fs.accessSync(targetPath, fs.constants.R_OK);
    } catch {
      sendJson(res, 200, {
        ok: true,
        data: {
          valid: false,
          exists: true,
          isDirectory: true,
          readable: false,
          error: "目录无读取权限",
        },
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      data: {
        valid: true,
        exists: true,
        isDirectory: true,
        readable: true,
        path: targetPath,
      },
    });
  } catch {
    sendJson(res, 200, {
      ok: true,
      data: {
        valid: false,
        exists: false,
        error: "路径不存在或无法访问",
      },
    });
  }
}

/**
 * GET /api/setup/browse-directory - 列出目录内容用于 Web 文件浏览器
 * 查询参数: path - 要列出的目录路径（可选，默认为用户主目录）
 */
async function handleBrowseDirectory(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const requestedPath = url.searchParams.get("path");

    // 确定要列出的路径
    let targetPath: string;
    if (requestedPath) {
      targetPath = requestedPath;
    } else {
      // 默认路径：用户主目录
      targetPath = os.homedir();
    }

    // 规范化路径
    targetPath = path.resolve(targetPath);

    // 安全检查：确保路径存在且是目录
    let stats: fs.Stats;
    try {
      stats = fs.statSync(targetPath);
      if (!stats.isDirectory()) {
        sendJson(res, 400, { ok: false, error: "指定的路径不是目录" });
        return;
      }
    } catch {
      sendJson(res, 400, { ok: false, error: "路径不存在或无法访问" });
      return;
    }

    // 读取目录内容
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });

    // 筛选并格式化目录列表
    const directories: Array<{ name: string; path: string }> = [];
    for (const entry of entries) {
      // 只列出目录，跳过隐藏目录（以.开头）
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        directories.push({
          name: entry.name,
          path: path.join(targetPath, entry.name),
        });
      }
    }

    // 按名称排序
    directories.sort((a, b) => a.name.localeCompare(b.name));

    // 获取父目录（用于向上导航）
    const parentPath = path.dirname(targetPath);
    const hasParent = parentPath !== targetPath;

    // 获取驱动器列表（Windows）
    let drives: string[] = [];
    if (os.platform() === "win32") {
      // Windows: 列出可用驱动器
      for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        const drivePath = `${letter}:\\`;
        try {
          fs.accessSync(drivePath);
          drives.push(drivePath);
        } catch {
          // 驱动器不存在或不可访问
        }
      }
    }

    sendJson(res, 200, {
      ok: true,
      data: {
        currentPath: targetPath,
        parentPath: hasParent ? parentPath : null,
        directories,
        drives,
        separator: path.sep,
      },
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `读取目录失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * POST /api/setup/configure-workspace - 配置工作目录
 */
async function handleConfigureWorkspace(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<ConfigureWorkspaceRequest>(req);
  if (!body || !body.workspace) {
    sendJson(res, 400, { ok: false, error: "缺少工作目录" });
    return;
  }

  const { workspace, additionalDirs } = body;

  try {
    // 确保目录存在
    if (!fs.existsSync(workspace)) {
      fs.mkdirSync(workspace, { recursive: true });
    }

    // 更新配置
    const config = loadConfig();
    const nextConfig: ClawdbotConfig = {
      ...config,
      agents: {
        ...config.agents,
        defaults: {
          ...config.agents?.defaults,
          workspace,
        },
      },
    };

    // 如果有额外的授权目录，添加到配置中
    if (additionalDirs && additionalDirs.length > 0) {
      // TODO: 实现目录授权配置
    }

    await writeConfigFile(nextConfig);

    updateSetupState({
      step: 3,
      workspaceConfigured: true,
    });

    sendJson(res, 200, { ok: true, data: { workspace } });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `配置失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * 将目录路径转换为 Docker bind 格式
 * Convert directory path to Docker bind format
 */
function formatDockerBind(hostPath: string): string {
  // 获取目录名作为容器内路径
  const dirName = path.basename(hostPath);
  const containerPath = `/trusted/${dirName}`;
  return `${hostPath}:${containerPath}:rw`;
}

/**
 * POST /api/setup/configure-security - 配置安全设置
 */
async function handleConfigureSecurity(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<ConfigureSecurityRequest>(req);
  if (!body || !body.mode) {
    sendJson(res, 400, { ok: false, error: "缺少安全模式" });
    return;
  }

  const { mode, trustedDirs } = body;

  try {
    const config = loadConfig();
    let nextConfig: ClawdbotConfig = { ...config };

    if (mode === "standard") {
      // 转换信任目录为 Docker binds 格式
      const binds =
        trustedDirs && trustedDirs.length > 0
          ? trustedDirs.map((dir) => formatDockerBind(dir))
          : undefined;

      // 应用推荐的安全配置
      nextConfig = {
        ...nextConfig,
        agents: {
          ...nextConfig.agents,
          defaults: {
            ...nextConfig.agents?.defaults,
            sandbox: {
              ...CN_DEFAULT_SECURITY_CONFIG.sandbox,
              docker: binds
                ? {
                    ...nextConfig.agents?.defaults?.sandbox?.docker,
                    binds,
                  }
                : nextConfig.agents?.defaults?.sandbox?.docker,
            },
          },
        },
        tools: {
          ...nextConfig.tools,
          exec: {
            ...nextConfig.tools?.exec,
            security: "allowlist",
            ask: "on-miss",  // 未知命令询问用户，而不是直接拒绝
            // 预置常用命令白名单（Windows + Linux + 开发工具）
            safeBins: [
              // Windows 常用
              "notepad", "explorer", "calc", "mspaint", "code", "cmd", "powershell",
              "start", "where", "dir", "type", "echo", "set", "cd", "mkdir", "copy",
              // 开发工具 - 通用
              "python", "python3", "pip", "pip3",
              "node", "npm", "pnpm", "yarn", "bun",
              "git", "curl", "wget",
              // 开发工具 - Java
              "java", "javac", "mvn", "gradle",
              // 开发工具 - 其他语言
              "go", "cargo", "dotnet",
              // 压缩工具
              "tar", "zip", "unzip",
              // Linux 基础
              "ls", "cat", "grep", "find", "head", "tail", "wc", "sort", "uniq", "jq",
              "cp", "mv", "mkdir", "touch", "chmod", "pwd", "which", "env",
              // 浏览器
              "chrome", "msedge", "firefox",
            ],
          },
        },
      };
    }
    // mode === "trust" 时不添加额外限制

    await writeConfigFile(nextConfig);

    updateSetupState({
      step: 4,
      securityConfigured: true,
    });

    sendJson(res, 200, { ok: true, data: { mode, trustedDirs } });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `配置失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * 验证钉钉 AppKey 和 AppSecret
 */
async function verifyDingtalkCredentials(appKey: string, appSecret: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(appKey)}&appsecret=${encodeURIComponent(appSecret)}`;
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json() as { errcode: number; errmsg: string; access_token?: string };

    if (data.errcode === 0 && data.access_token) {
      return { valid: true };
    } else {
      // 钉钉错误码说明
      let errorMsg = data.errmsg || "验证失败";
      if (data.errcode === 40089) {
        errorMsg = "AppKey 不存在或无效";
      } else if (data.errcode === 40091) {
        errorMsg = "AppSecret 不正确";
      } else if (data.errcode === 40014) {
        errorMsg = "应用凭证无效";
      }
      return { valid: false, error: errorMsg };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("timeout")) {
      return { valid: false, error: "连接钉钉服务超时，请检查网络" };
    }
    return { valid: false, error: `验证失败: ${msg}` };
  }
}

/**
 * 验证飞书 App ID 和 App Secret
 */
async function verifyFeishuCredentials(appId: string, appSecret: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json() as { code: number; msg: string; tenant_access_token?: string };

    if (data.code === 0 && data.tenant_access_token) {
      return { valid: true };
    } else {
      // 飞书错误码说明
      let errorMsg = data.msg || "验证失败";
      if (data.code === 10003) {
        errorMsg = "App ID 不存在";
      } else if (data.code === 10014) {
        errorMsg = "App Secret 不正确";
      } else if (data.code === 10015) {
        errorMsg = "应用凭证已过期";
      }
      return { valid: false, error: errorMsg };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("timeout")) {
      return { valid: false, error: "连接飞书服务超时，请检查网络" };
    }
    return { valid: false, error: `验证失败: ${msg}` };
  }
}

/**
 * POST /api/setup/verify-channel - 验证渠道凭证
 */
async function handleVerifyChannel(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<{ channel: string; credentials: Record<string, string> }>(req);
  if (!body || !body.channel || !body.credentials) {
    sendJson(res, 400, { ok: false, error: "缺少必要参数" });
    return;
  }

  const { channel, credentials } = body;

  try {
    let result: { valid: boolean; error?: string };

    if (channel === "dingtalk") {
      if (!credentials.appKey || !credentials.appSecret) {
        sendJson(res, 200, { ok: true, data: { valid: false, error: "请填写 App Key 和 App Secret" } });
        return;
      }
      result = await verifyDingtalkCredentials(credentials.appKey, credentials.appSecret);
    } else if (channel === "feishu") {
      if (!credentials.appId || !credentials.appSecret) {
        sendJson(res, 200, { ok: true, data: { valid: false, error: "请填写 App ID 和 App Secret" } });
        return;
      }
      result = await verifyFeishuCredentials(credentials.appId, credentials.appSecret);
    } else {
      sendJson(res, 200, { ok: true, data: { valid: true, message: "该渠道暂不支持在线验证" } });
      return;
    }

    sendJson(res, 200, { ok: true, data: result });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `验证失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * POST /api/setup/configure-channels - 配置聊天渠道
 */
async function handleConfigureChannels(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<ConfigureChannelsRequest>(req);
  
  try {
    // 加载当前配置
    const config = loadConfig();
    const configuredChannels: string[] = [];
    const verificationResults: Record<string, { valid: boolean; error?: string }> = {};

    // 构建渠道配置对象
    const channelsConfig: Record<string, unknown> = { ...config.channels };
    
    // 处理钉钉配置
    if (body?.dingtalk?.appKey && body?.dingtalk?.appSecret) {
      // 验证钉钉凭证
      const dingtalkResult = await verifyDingtalkCredentials(body.dingtalk.appKey, body.dingtalk.appSecret);
      verificationResults.dingtalk = dingtalkResult;
      
      if (!dingtalkResult.valid) {
        sendJson(res, 200, {
          ok: false,
          error: `钉钉凭证验证失败: ${dingtalkResult.error}`,
          data: { verificationResults },
        });
        return;
      }

      channelsConfig.dingtalk = {
        enabled: true,
        app: {
          appKey: body.dingtalk.appKey,
          appSecret: body.dingtalk.appSecret,
          ...(body.dingtalk.robotToken ? { robotCode: body.dingtalk.robotToken } : {}),
        },
      };
      configuredChannels.push("dingtalk");
    }

    // 处理飞书配置
    if (body?.feishu?.appId && body?.feishu?.appSecret) {
      // 验证飞书凭证
      const feishuResult = await verifyFeishuCredentials(body.feishu.appId, body.feishu.appSecret);
      verificationResults.feishu = feishuResult;

      if (!feishuResult.valid) {
        sendJson(res, 200, {
          ok: false,
          error: `飞书凭证验证失败: ${feishuResult.error}`,
          data: { verificationResults },
        });
        return;
      }

      channelsConfig.feishu = {
        enabled: true,
        app: {
          appId: body.feishu.appId,
          appSecret: body.feishu.appSecret,
          ...(body.feishu.encryptKey ? { encryptKey: body.feishu.encryptKey } : {}),
          ...(body.feishu.verificationToken ? { verificationToken: body.feishu.verificationToken } : {}),
        },
      };
      configuredChannels.push("feishu");
    }

    // 处理简单的渠道列表（兼容旧接口）
    if (body?.channels) {
      for (const channelId of body.channels) {
        if (!channelsConfig[channelId]) {
          channelsConfig[channelId] = { enabled: true };
        }
        if (!configuredChannels.includes(channelId)) {
          configuredChannels.push(channelId);
        }
      }
    }

    // 合并到现有配置
    const nextConfig: ClawdbotConfig = {
      ...config,
      channels: channelsConfig as ClawdbotConfig["channels"],
    };

    // 持久化到磁盘
    await writeConfigFile(nextConfig);

    updateSetupState({
      step: 5,
      channelsConfigured: configuredChannels,
    });

    sendJson(res, 200, { ok: true, data: { channels: configuredChannels, verificationResults } });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `配置失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * POST /api/setup/complete - 完成配置
 */
async function handleComplete(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  updateSetupState({
    completed: true,
  });

  sendJson(res, 200, { ok: true, data: { completed: true } });
}

/**
 * Tecbinai 验证 API 响应类型
 */
interface TecbinaiVerifyResponse {
  code: number;
  message: string;
  data: {
    valid: boolean;
    status: string | null;
    expiresAt: string | null;
    message: string;
  };
}

/**
 * POST /api/setup/validate-license - 验证 ClawdbotCN 许可证
 * 对接 Tecbinai 产品 Key 校验 API
 */
async function handleValidateLicense(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<{ token: string }>(req);
  if (!body || !body.token) {
    sendJson(res, 400, { ok: false, error: "缺少许可证 Key" });
    return;
  }

  const key = body.token.trim();

  try {
    // Tecbinai 产品 Key 校验 API
    const validateUrl = "https://www.tecbinai.com/api/api/verify-key";
    
    // 调用 Tecbinai 验证服务
    const response = await fetch(validateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key }),
      signal: AbortSignal.timeout(15000), // 15 秒超时
    });

    if (!response.ok) {
      throw new Error(`验证服务返回错误: ${response.status}`);
    }

    const result = await response.json() as TecbinaiVerifyResponse;

    if (result.code === 200 && result.data?.valid) {
      // 验证成功，保存许可证状态到配置
      const config = loadConfig();
      const nextConfig = {
        ...config,
        license: {
          key,
          status: result.data.status ?? undefined,
          expiresAt: result.data.expiresAt ?? undefined,
          validatedAt: new Date().toISOString(),
        },
      };
      await writeConfigFile(nextConfig);

      sendJson(res, 200, {
        ok: true,
        data: {
          valid: true,
          status: result.data.status,
          expiresAt: result.data.expiresAt,
          message: result.data.message || "许可证验证成功",
        },
      });
    } else {
      // 验证失败，返回 Tecbinai 的错误消息
      sendJson(res, 200, {
        ok: true,
        data: {
          valid: false,
          error: result.data?.message || "许可证无效",
        },
      });
    }
  } catch (error) {
    // 如果验证服务不可用，暂时允许使用（开发模式）
    const isDev = process.env.NODE_ENV === "development" || process.env.CLAWDBOT_DEV === "1";
    
    if (isDev) {
      // 开发模式：允许跳过验证
      const config = loadConfig();
      const nextConfig = {
        ...config,
        license: {
          key,
          status: "dev",
          expiresAt: undefined,
          validatedAt: new Date().toISOString(),
        },
      };
      await writeConfigFile(nextConfig);

      sendJson(res, 200, {
        ok: true,
        data: { valid: true, message: "开发模式：跳过在线验证" },
      });
    } else {
      sendJson(res, 200, {
        ok: true,
        data: {
          valid: false,
          error: `验证服务连接失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      });
    }
  }
}

/**
 * POST /api/setup/restart - 重启 Gateway 以应用配置
 */
async function handleRestart(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    // 延迟 1 秒重启，让响应先返回
    const result = scheduleGatewaySigusr1Restart({
      delayMs: 1000,
      reason: "setup-wizard-complete",
    });

    sendJson(res, 200, {
      ok: true,
      data: {
        restarting: true,
        delayMs: result.delayMs,
        message: "Gateway 将在 1 秒后重启",
      },
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `重启失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * GET /api/setup/affiliate-links - 获取推广链接
 */
async function handleGetAffiliateLinks(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  sendJson(res, 200, {
    ok: true,
    data: Object.values(AFFILIATE_LINKS),
  });
}

interface FetchModelsRequest {
  provider: string;
  apiKey?: string;
}

/**
 * POST /api/setup/fetch-models - 获取提供商的模型列表
 */
async function handleFetchModels(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<FetchModelsRequest>(req);
  if (!body || !body.provider) {
    sendJson(res, 400, { ok: false, error: "缺少提供商参数" });
    return;
  }

  const { provider, apiKey } = body;

  try {
    let models: Array<{ id: string; name: string; description?: string }> = [];

    if (provider === "siliconflow") {
      // 从 SiliconFlow API 获取模型列表
      const siliconflowModels = await discoverSiliconFlowModels(apiKey);
      models = siliconflowModels.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.reasoning ? "推理模型" : undefined,
      }));
    } else {
      // 对于其他提供商，返回静态配置的模型列表
      const providerConfig = CN_PROVIDERS[provider];
      if (providerConfig) {
        models = providerConfig.models;
      }
    }

    sendJson(res, 200, { ok: true, data: { models } });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `获取模型列表失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// ============================================================================
// Main HTTP Handler
// ============================================================================

/**
 * 处理 Setup Wizard 相关的 HTTP 请求
 */
export async function handleSetupWizardHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const urlRaw = req.url;
  if (!urlRaw) return false;

  const url = new URL(urlRaw, "http://localhost");
  const pathname = url.pathname;

  // 处理 API 请求
  if (pathname.startsWith(SETUP_API_PREFIX)) {
    const apiPath = pathname.slice(SETUP_API_PREFIX.length);

    // 设置 CORS 头
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return true;
    }

    // 路由 API 请求
    if (req.method === "GET") {
      switch (apiPath) {
        case "/state":
          await handleGetState(req, res);
          return true;
        case "/providers":
          await handleGetProviders(req, res);
          return true;
        case "/affiliate-links":
          await handleGetAffiliateLinks(req, res);
          return true;
        case "/browse-directory":
          await handleBrowseDirectory(req, res);
          return true;
      }
    }

    if (req.method === "POST") {
      switch (apiPath) {
        case "/validate-api-key":
          await handleValidateApiKey(req, res);
          return true;
        case "/verify-apikey":
          await handleVerifyApiKey(req, res);
          return true;
        case "/validate-path":
          await handleValidatePath(req, res);
          return true;
        case "/configure-provider":
          await handleConfigureProvider(req, res);
          return true;
        case "/configure-workspace":
          await handleConfigureWorkspace(req, res);
          return true;
        case "/configure-security":
          await handleConfigureSecurity(req, res);
          return true;
        case "/configure-channels":
          await handleConfigureChannels(req, res);
          return true;
        case "/verify-channel":
          await handleVerifyChannel(req, res);
          return true;
        case "/complete":
          await handleComplete(req, res);
          return true;
        case "/restart":
          await handleRestart(req, res);
          return true;
        case "/validate-license":
          await handleValidateLicense(req, res);
          return true;
        case "/fetch-models":
          await handleFetchModels(req, res);
          return true;
      }
    }

    // 未知的 API 端点
    sendJson(res, 404, { ok: false, error: "未知的 API 端点" });
    return true;
  }

  // 处理 Setup UI 页面请求
  if (pathname === SETUP_UI_PATH || pathname === `${SETUP_UI_PATH}/`) {
    // 获取当前的 gateway token（优先从环境变量，然后从配置）
    const config = loadConfig();
    const gatewayToken = process.env.CLAWDBOT_GATEWAY_TOKEN ?? config.gateway?.auth?.token;
    serveSetupPage(res, gatewayToken);
    return true;
  }

  return false;
}

/**
 * 检查是否需要显示 Setup Wizard
 */
export function shouldShowSetupWizard(): boolean {
  const config = loadConfig();

  // 检查是否已配置 API Key
  const hasApiKey = Boolean(
    config.auth?.profiles &&
    Object.keys(config.auth.profiles).length > 0
  );

  // 检查是否已配置工作目录
  const hasWorkspace = Boolean(config.agents?.defaults?.workspace);

  // 如果缺少必要配置，显示 Setup Wizard
  return !hasApiKey || !hasWorkspace;
}

/**
 * 获取 Setup Wizard 的 URL
 */
export function getSetupWizardUrl(port: number): string {
  return `http://localhost:${port}/setup`;
}
