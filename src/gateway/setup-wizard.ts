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
import type { ChannelId } from "../channels/plugins/types.js";

// ============================================================================
// 渠道启动回调（用于配置保存后立即启动渠道）
// ============================================================================

type ChannelStartCallback = (channelId: ChannelId) => Promise<void>;
let channelStartCallback: ChannelStartCallback | null = null;

/**
 * 设置渠道启动回调
 * 由 Gateway 初始化时调用，传入 startChannel 函数
 */
export function setChannelStartCallback(callback: ChannelStartCallback): void {
  channelStartCallback = callback;
}
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
import { updateGatewayLicenseState } from "./license-check.js";
import {
  startTokenAutoRefresh,
  verifyLicenseWithRetry,
  refreshToken,
  switchDevice,
  DeviceSwitchError,
  type LicenseVerifyResponseData,
  LicenseErrorCode,
  getDeviceId,
  getSetupQrcode,
} from "../license/index.js";
import {
  setSiliconFlowApiKey,
  setDeepSeekApiKey,
  setGlmApiKey,
  setAliyunBailianApiKey,
  setVolcengineArkApiKey,
  setTencentHunyuanApiKey,
  setMinimaxApiKey,
  setGeminiApiKey,
  setOpenAiApiKey,
  setAnthropicApiKey,
  setNvidiaApiKey,
  setMoonshotApiKey,
  setModelscopeApiKey,
  setKimiCodeApiKey,
  setOllamaApiKey,
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
  /** 自定义 API 端点 (仅 provider=custom 时使用) */
  endpoint?: string;
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
  wecom?: {
    corpId: string;
    agentId: number;
    agentSecret: string;
    token?: string;
    encodingAESKey?: string;
  };
  qqbot?: {
    appId: string;
    appSecret: string;
    token?: string;
    sandbox?: boolean;
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
  const hasApiKey = Boolean(config.auth?.profiles && Object.keys(config.auth.profiles).length > 0);
  const hasWorkspace = Boolean(config.agents?.defaults?.workspace);
  const hasLicense = Boolean(config.license?.key);
  const setupCompleted = Boolean(config.setup?.completedAt);

  // 只有在满足以下条件之一时才标记为已完成：
  // 1. 有 license（激活成功）
  // 2. 配置文件中有 setup.completedAt 标记（handleComplete 写入）
  if (hasApiKey && hasWorkspace && (hasLicense || setupCompleted)) {
    setupWizardState.completed = true;
  }

  // Resume from the last completed step so the user does not have to
  // start over after closing the browser mid-wizard.
  const savedStep = config.setup?.lastCompletedStep;
  if (
    typeof savedStep === "number" &&
    savedStep >= 0 &&
    !setupWizardState.completed &&
    setupWizardState.step <= 1
  ) {
    setupWizardState.step = savedStep + 1;
  }

  return setupWizardState;
}

function updateSetupState(updates: Partial<SetupWizardState>): SetupWizardState {
  setupWizardState = { ...setupWizardState, ...updates };

  // Persist the last completed step so the wizard can resume from this point
  // even if the user closes the browser.  Best-effort – failure here must not
  // break the wizard flow.
  if (typeof updates.step === "number" && updates.step > 1) {
    try {
      const current = loadConfig();
      const lastCompletedStep = updates.step - 1;
      if ((current.setup?.lastCompletedStep ?? -1) < lastCompletedStep) {
        void writeConfigFile({
          ...current,
          setup: { ...current.setup, lastCompletedStep },
        }).catch(() => {
          /* best-effort: wizard continues even if checkpoint fails */
        });
      }
    } catch {
      /* best-effort: config read failure is non-fatal here */
    }
  }

  return setupWizardState;
}

// ============================================================================
// API Handlers
// ============================================================================

/**
 * GET /api/setup/state - 获取向导状态
 */
async function handleGetState(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const state = getSetupState();
  sendJson(res, 200, { ok: true, data: state });
}

/**
 * GET /api/setup/providers - 获取可用的 AI 提供商列表
 */
async function handleGetProviders(_req: IncomingMessage, res: ServerResponse): Promise<void> {
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
async function handleValidateApiKey(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody<ValidateApiKeyRequest>(req);
  if (!body || !body.provider || !body.apiKey) {
    sendJson(res, 400, { ok: false, error: "缺少必要参数" });
    return;
  }

  const { provider, apiKey } = body;

  // Ollama 本地服务无需真正的 API Key，允许短字符串（如 "ollama"）
  const minLength = provider === "ollama" ? 1 : 10;

  // 基本格式验证
  if (apiKey.trim().length < minLength) {
    sendJson(res, 400, { ok: false, error: "API Key 格式不正确" });
    return;
  }

  sendJson(res, 200, { ok: true, data: { valid: true } });
}

interface VerifyApiKeyRequest {
  provider: string;
  apiKey: string;
  model?: string;
  /** 自定义 API 端点 (仅 provider=custom 时使用) */
  endpoint?: string;
}

/**
 * POST /api/setup/verify-apikey - 验证 API Key 是否有效（实际调用 API 测试）
 */
async function handleVerifyApiKey(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody<VerifyApiKeyRequest>(req);
  if (!body || !body.provider || !body.apiKey) {
    sendJson(res, 400, { ok: false, error: "缺少必要参数" });
    return;
  }

  const { provider, apiKey, model, endpoint: customEndpoint } = body;
  const trimmedKey = apiKey.trim();

  // Ollama 本地服务无需真正的 API Key，允许短字符串（如 "ollama"）
  const minKeyLength = provider === "ollama" ? 1 : 10;

  // 基本格式验证
  if (trimmedKey.length < minKeyLength) {
    sendJson(res, 200, { ok: true, data: { valid: false, error: "API Key 格式不正确，长度不足" } });
    return;
  }

  try {
    // 自定义 API：使用用户提供的 endpoint，走 OpenAI 兼容验证
    if (provider === "custom") {
      if (!customEndpoint) {
        sendJson(res, 200, {
          ok: true,
          data: { valid: false, error: "请提供自定义 API 端点地址" },
        });
        return;
      }
      const testModel = model || "test";
      // 标准化 endpoint：去掉尾部斜杠
      const baseUrl = customEndpoint.replace(/\/+$/, "");
      // 拼接 /chat/completions（如果用户已经包含了则不重复拼）
      const testUrl = baseUrl.endsWith("/chat/completions")
        ? baseUrl
        : `${baseUrl}/chat/completions`;
      const testHeaders: Record<string, string> = {
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      };
      const testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });

      const response = await fetch(testUrl, {
        method: "POST",
        headers: testHeaders,
        body: testBody,
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        sendJson(res, 200, { ok: true, data: { valid: true, message: "自定义 API 验证成功" } });
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
          } else if (response.status === 404) {
            errorMessage = "API 端点不存在，请检查地址是否正确";
          } else if (response.status === 429) {
            errorMessage = "请求频率超限，请稍后重试";
          }
        }
        sendJson(res, 200, { ok: true, data: { valid: false, error: errorMessage } });
      }
      return;
    }

    const providerConfig = CN_PROVIDERS[provider];
    if (!providerConfig) {
      sendJson(res, 200, {
        ok: true,
        data: { valid: false, error: `不支持的提供商: ${provider}` },
      });
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
        Authorization: `Bearer ${trimmedKey}`,
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
        Authorization: `Bearer ${trimmedKey}`,
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
        Authorization: `Bearer ${trimmedKey}`,
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
        Authorization: `Bearer ${trimmedKey}`,
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
        Authorization: `Bearer ${trimmedKey}`,
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
      // MiniMax 使用 Anthropic Messages 兼容 API，路径为 /v1/messages
      // 需要同时设置 x-api-key 和 Authorization 头
      testUrl = `${endpoint}/v1/messages`;
      testHeaders = {
        "x-api-key": trimmedKey,
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (provider === "moonshot") {
      // Kimi (月之暗面) 使用 OpenAI 兼容 API
      testUrl = `${endpoint}/chat/completions`;
      testHeaders = {
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (provider === "kimi-code") {
      // Kimi Code 代码专用模型，使用 OpenAI 兼容 API + 特殊 User-Agent
      testUrl = `${endpoint}/chat/completions`;
      testHeaders = {
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
        "User-Agent": "KimiCLI/0.77",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (provider === "modelscope") {
      // 魔搭社区使用 OpenAI 兼容 API
      // 参考: https://modelscope.cn/docs/model-service/API-Inference/intro
      // Token 获取: https://modelscope.cn/my/myaccesstoken
      // 注意: ModelScope 对参数校验较严格，不传 undefined 字段；部分模型冷启动较慢
      try {
        const msTestUrl = `${endpoint}/chat/completions`;
        const msResponse = await fetch(msTestUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${trimmedKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: testModel,
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 5,
          }),
          signal: AbortSignal.timeout(30000), // ModelScope 冷启动可能较慢
        });
        if (msResponse.ok) {
          sendJson(res, 200, { ok: true, data: { valid: true, message: "API Key 验证成功" } });
        } else {
          const msErrText = await msResponse.text();
          let msError = "API Key 无效";
          try {
            const msErrJson = JSON.parse(msErrText);
            msError = msErrJson.error?.message || msErrJson.message || msError;
          } catch {
            /* use default */
          }
          if (msResponse.status === 401) {
            msError = "Token 无效或已过期，请前往 modelscope.cn/my/myaccesstoken 重新获取";
          } else if (msResponse.status === 403) {
            msError = "权限不足。请确认已在魔搭社区绑定阿里云账号，并已获取有效的 Access Token";
          } else if (msResponse.status === 429) {
            msError = "已超出每日免费调用限额（2000次/天），请明日再试或更换 Token";
          } else if (
            msResponse.status === 404 ||
            msError.includes("not found") ||
            msError.includes("does not exist")
          ) {
            msError = `模型 ${testModel} 不支持 API 推理或不存在。请在 modelscope.cn 确认该模型已启用 API-Inference`;
          } else if (msResponse.status === 400) {
            msError = `请求参数错误: ${msError}。请检查模型名称是否正确（格式如 Qwen/Qwen3-72B-Instruct）`;
          }
          sendJson(res, 200, { ok: true, data: { valid: false, error: msError } });
        }
        return;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT")) {
          sendJson(res, 200, {
            ok: true,
            data: { valid: false, error: "连接魔搭社区超时（模型可能正在冷启动中），请稍后重试" },
          });
        } else {
          sendJson(res, 200, { ok: true, data: { valid: false, error: `验证失败: ${errMsg}` } });
        }
        return;
      }
    } else if (provider === "google") {
      // Google Gemini 使用 REST API，参数通过 URL 传递
      // 参考: https://ai.google.dev/gemini-api/docs
      testUrl = `${endpoint}/models/${testModel}:generateContent?key=${trimmedKey}`;
      testHeaders = {
        "Content-Type": "application/json",
      };
      testBody = JSON.stringify({
        contents: [{ parts: [{ text: "Hi" }] }],
      });
    } else if (provider === "openai") {
      // OpenAI 使用标准 Chat Completions API
      // 参考: https://platform.openai.com/docs/api-reference/chat
      testUrl = `${endpoint}/chat/completions`;
      testHeaders = {
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (provider === "anthropic") {
      // Anthropic Claude 使用 Messages API
      // 参考: https://docs.anthropic.com/en/api/messages
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
    } else if (provider === "nvidia") {
      // NVIDIA NIM 使用 OpenAI 兼容 API
      // 参考: https://docs.api.nvidia.com/nim/reference/llm-apis
      testUrl = `${endpoint}/chat/completions`;
      testHeaders = {
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    } else if (provider === "ollama") {
      // Ollama 本地模型：先检测服务是否运行，再验证模型是否可用
      // Ollama 原生 API 地址为 http://localhost:11434（不带 /v1）
      // OpenAI 兼容 API 地址为 http://localhost:11434/v1
      const ollamaBase = endpoint.replace(/\/v1\/?$/, "");
      try {
        // 第一步：调用 /api/tags 检测 Ollama 服务是否运行
        const tagsResponse = await fetch(`${ollamaBase}/api/tags`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!tagsResponse.ok) {
          sendJson(res, 200, {
            ok: true,
            data: {
              valid: false,
              error: `Ollama 服务响应异常 (HTTP ${tagsResponse.status})，请检查 Ollama 是否正常运行`,
            },
          });
          return;
        }
        const tagsData = (await tagsResponse.json()) as { models?: Array<{ name: string }> };
        const localModels = tagsData.models ?? [];

        if (localModels.length === 0) {
          sendJson(res, 200, {
            ok: true,
            data: {
              valid: false,
              error:
                "Ollama 已运行，但未找到任何本地模型。请先运行 ollama pull <模型名> 下载模型（例如: ollama pull qwen3:8b）",
            },
          });
          return;
        }

        // 第二步：检查用户选择的模型是否已下载
        const modelExists = localModels.some(
          (m) => m.name === testModel || m.name.startsWith(`${testModel}:`),
        );
        const modelNames = localModels.map((m) => m.name).join(", ");

        if (!modelExists) {
          sendJson(res, 200, {
            ok: true,
            data: {
              valid: true,
              message: `Ollama 连接成功！已安装模型: ${modelNames}。注意: 当前选择的模型 ${testModel} 未安装，请运行 ollama pull ${testModel}`,
            },
          });
          return;
        }

        // 第三步：通过 OpenAI 兼容 API 实际测试模型是否能正常推理
        try {
          const chatResponse = await fetch(`${ollamaBase}/v1/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${trimmedKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: testModel,
              messages: [{ role: "user", content: "Hi" }],
              max_tokens: 1,
            }),
            signal: AbortSignal.timeout(30000),
          });
          if (chatResponse.ok) {
            sendJson(res, 200, {
              ok: true,
              data: { valid: true, message: `Ollama 验证成功！模型 ${testModel} 可正常使用` },
            });
          } else {
            const errText = await chatResponse.text();
            sendJson(res, 200, {
              ok: true,
              data: {
                valid: true,
                message: `Ollama 连接成功，模型 ${testModel} 已安装，但推理测试返回 ${chatResponse.status}: ${errText.slice(0, 200)}`,
              },
            });
          }
        } catch {
          // chat 测试超时但服务本身是通的，仍算成功
          sendJson(res, 200, {
            ok: true,
            data: {
              valid: true,
              message: `Ollama 连接成功！模型 ${testModel} 已安装（推理测试超时，可能模型正在加载中）`,
            },
          });
        }
        return;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (
          errMsg.includes("fetch failed") ||
          errMsg.includes("ECONNREFUSED") ||
          errMsg.includes("connect")
        ) {
          sendJson(res, 200, {
            ok: true,
            data: {
              valid: false,
              error:
                "无法连接到 Ollama 服务。请确认：\n1. 已安装 Ollama（https://ollama.com）\n2. Ollama 服务正在运行（命令行执行 ollama serve）\n3. 服务地址为 http://localhost:11434",
            },
          });
        } else if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT")) {
          sendJson(res, 200, {
            ok: true,
            data: { valid: false, error: "连接 Ollama 服务超时，请检查 Ollama 是否正在运行" },
          });
        } else {
          sendJson(res, 200, {
            ok: true,
            data: { valid: false, error: `Ollama 验证失败: ${errMsg}` },
          });
        }
        return;
      }
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

        // 火山引擎特殊错误处理：模型未开通
        if (
          provider === "volcengine-ark" &&
          (errorMessage.includes("does not exist") ||
            errorMessage.includes("do not have access") ||
            errorMessage.includes("not found") ||
            errorMessage.includes("invalid model"))
        ) {
          errorMessage =
            "模型未开通！请先访问火山方舟控制台「开通管理」页面开通该模型：https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement";
        }
      } catch {
        if (response.status === 401) {
          errorMessage = "API Key 无效或已过期";
        } else if (response.status === 403) {
          errorMessage = "API Key 权限不足";
        } else if (response.status === 429) {
          errorMessage = "请求频率超限，请稍后重试";
        } else if (response.status === 404 && provider === "volcengine-ark") {
          errorMessage =
            "模型未开通！请先访问火山方舟控制台「开通管理」页面开通该模型：https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement";
        }
      }

      sendJson(res, 200, { ok: true, data: { valid: false, error: errorMessage } });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT")) {
      sendJson(res, 200, {
        ok: true,
        data: { valid: false, error: "连接超时，请检查网络或稍后重试" },
      });
    } else {
      sendJson(res, 200, { ok: true, data: { valid: false, error: `验证失败: ${errorMsg}` } });
    }
  }
}

/**
 * POST /api/setup/configure-provider - 配置 AI 提供商
 */
async function handleConfigureProvider(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody<ConfigureProviderRequest>(req);
  if (!body || !body.provider || !body.apiKey) {
    sendJson(res, 400, { ok: false, error: "缺少必要参数" });
    return;
  }

  const { provider, apiKey, model, endpoint: customEndpoint } = body;

  try {
    // 保存 API Key
    const trimmedKey = apiKey.trim();

    // 自定义 API：使用 OpenAI 兼容方式保存，endpoint 写入 models.providers
    if (provider === "custom") {
      if (!customEndpoint) {
        sendJson(res, 400, { ok: false, error: "自定义 API 需要提供端点地址" });
        return;
      }
      // 使用 openai 的 auth profile 存储 API Key（自定义 API 兼容 OpenAI 格式）
      await setOpenAiApiKey(trimmedKey);

      const baseUrl = customEndpoint.replace(/\/+$/, "");
      const defaultModel = model || "custom-model";
      // 自定义提供商的 model ref 使用 custom-openai 命名空间
      const modelRef = `custom-openai/${defaultModel}`;

      const config = loadConfig();
      const nextConfig: ClawdbotConfig = {
        ...config,
        auth: {
          ...config.auth,
          profiles: {
            ...config.auth?.profiles,
            "openai:default": {
              provider: "openai",
              mode: "api_key",
            },
          },
          order: {
            ...config.auth?.order,
            openai: ["openai:default"],
          },
        },
        agents: {
          ...config.agents,
          defaults: {
            ...config.agents?.defaults,
            model: {
              ...config.agents?.defaults?.model,
              primary: modelRef,
            },
          },
        },
        // 将自定义 endpoint 写入 models.providers 配置
        models: {
          ...config.models,
          providers: {
            ...config.models?.providers,
            "custom-openai": {
              baseUrl,
              api: "openai-completions",
              apiKey: trimmedKey,
              models: [
                {
                  id: defaultModel,
                  name: defaultModel,
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
              ],
            },
          },
        },
      };

      await writeConfigFile(nextConfig);

      updateSetupState({
        step: 2,
        provider: "custom",
        apiKeyConfigured: true,
      });

      sendJson(res, 200, { ok: true, data: { configured: true, model: modelRef } });
      return;
    }

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
    } else if (provider === "moonshot") {
      await setMoonshotApiKey(trimmedKey);
    } else if (provider === "kimi-code") {
      await setKimiCodeApiKey(trimmedKey);
    } else if (provider === "modelscope") {
      await setModelscopeApiKey(trimmedKey);
    } else if (provider === "google") {
      await setGeminiApiKey(trimmedKey);
    } else if (provider === "openai") {
      await setOpenAiApiKey(trimmedKey);
    } else if (provider === "anthropic") {
      await setAnthropicApiKey(trimmedKey);
    } else if (provider === "nvidia") {
      await setNvidiaApiKey(trimmedKey);
    } else if (provider === "ollama") {
      await setOllamaApiKey(trimmedKey);
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
async function handleValidatePath(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
async function handleBrowseDirectory(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
async function handleConfigureWorkspace(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
async function handleConfigureSecurity(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

      // 根据部署环境选择 exec 权限策略：
      // - CN 区 / Windows 打包模式：full + off（最大能力释放，小白无需确认）
      // - 其他环境（macOS 在线等）：allowlist + on-miss（未知命令询问用户）
      const isCn = detectChinaRegion();
      const execSecurity = isCn ? ("full" as const) : ("allowlist" as const);
      const execAsk = isCn ? ("off" as const) : ("on-miss" as const);

      // 预置常用命令白名单（Windows + Linux + 开发工具）
      const safeBins = [
        // Windows 常用
        "notepad",
        "explorer",
        "calc",
        "mspaint",
        "code",
        "cmd",
        "powershell",
        "start",
        "where",
        "dir",
        "type",
        "echo",
        "set",
        "cd",
        "mkdir",
        "copy",
        // 开发工具 - 通用
        "python",
        "python3",
        "pip",
        "pip3",
        "node",
        "npm",
        "pnpm",
        "yarn",
        "bun",
        "git",
        "curl",
        "wget",
        // 开发工具 - Java
        "java",
        "javac",
        "mvn",
        "gradle",
        // 开发工具 - 其他语言
        "go",
        "cargo",
        "dotnet",
        // 压缩工具
        "tar",
        "zip",
        "unzip",
        // Linux 基础
        "ls",
        "cat",
        "grep",
        "find",
        "head",
        "tail",
        "wc",
        "sort",
        "uniq",
        "jq",
        "cp",
        "mv",
        "mkdir",
        "touch",
        "chmod",
        "pwd",
        "which",
        "env",
        // 浏览器
        "chrome",
        "msedge",
        "firefox",
      ];

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
            security: execSecurity,
            ask: execAsk,
            safeBins,
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
 *
 * 调用钉钉 API 获取 access_token 来验证凭证是否有效
 * 参考: https://open.dingtalk.com/document/orgapp/obtain-the-access_token-of-an-internal-app
 */
async function verifyDingtalkCredentials(
  appKey: string,
  appSecret: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(appKey)}&appsecret=${encodeURIComponent(appSecret)}`;
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    const data = (await response.json()) as {
      errcode: number;
      errmsg: string;
      access_token?: string;
    };

    if (data.errcode === 0 && data.access_token) {
      return { valid: true };
    } else {
      // 钉钉错误码说明 - 提供更详细的排查建议
      let errorMsg = data.errmsg || "验证失败";
      if (data.errcode === 40089) {
        errorMsg =
          "AppKey 不存在或无效。请检查：1) AppKey 是否复制完整（无多余空格）；2) 应用是否已在「版本管理与发布」中发布上线";
      } else if (data.errcode === 40091) {
        errorMsg =
          "AppSecret 不正确。请到钉钉开放平台「凭证与基础信息」页面点击「重置」生成新的 Secret";
      } else if (data.errcode === 40014) {
        errorMsg = "应用凭证无效。请检查 AppKey 和 AppSecret 是否匹配同一个应用";
      } else if (data.errcode === 400013) {
        errorMsg = "应用未启用。请在钉钉开放平台「版本管理与发布」中发布应用";
      }
      return { valid: false, error: errorMsg };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("timeout")) {
      return { valid: false, error: "连接钉钉服务超时，请检查网络连接" };
    }
    return { valid: false, error: `验证失败: ${msg}` };
  }
}

/**
 * 验证飞书 App ID 和 App Secret
 */
async function verifyFeishuCredentials(
  appId: string,
  appSecret: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      signal: AbortSignal.timeout(10000),
    });

    const data = (await response.json()) as {
      code: number;
      msg: string;
      tenant_access_token?: string;
    };

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
 * 验证企业微信 CorpID 和 AgentSecret
 */
async function verifyWecomCredentials(
  corpId: string,
  agentSecret: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    // 企业微信获取 access_token API
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(agentSecret)}`;
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    const data = (await response.json()) as {
      errcode: number;
      errmsg: string;
      access_token?: string;
      expires_in?: number;
    };

    if (data.errcode === 0 && data.access_token) {
      return { valid: true };
    } else {
      // 企业微信错误码说明
      let errorMsg = data.errmsg || "验证失败";
      if (data.errcode === 40013) {
        errorMsg = "企业 ID (CorpID) 无效";
      } else if (data.errcode === 40001) {
        errorMsg = "应用 Secret 不正确";
      } else if (data.errcode === 40056) {
        errorMsg = "应用 Secret 不正确或已过期";
      } else if (data.errcode === 42001) {
        errorMsg = "应用凭证已过期，请重新获取";
      } else if (data.errcode === 40091) {
        errorMsg = "Secret 不合法";
      } else if (data.errcode === -1) {
        errorMsg = "系统繁忙，请稍后再试";
      }
      return { valid: false, error: errorMsg };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("timeout")) {
      return { valid: false, error: "连接企业微信服务超时，请检查网络" };
    }
    return { valid: false, error: `验证失败: ${msg}` };
  }
}

/**
 * POST /api/setup/verify-channel - 验证渠道凭证
 */
async function handleVerifyChannel(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
        sendJson(res, 200, {
          ok: true,
          data: { valid: false, error: "请填写 App Key 和 App Secret" },
        });
        return;
      }
      result = await verifyDingtalkCredentials(credentials.appKey, credentials.appSecret);
    } else if (channel === "feishu") {
      if (!credentials.appId || !credentials.appSecret) {
        sendJson(res, 200, {
          ok: true,
          data: { valid: false, error: "请填写 App ID 和 App Secret" },
        });
        return;
      }
      result = await verifyFeishuCredentials(credentials.appId, credentials.appSecret);
    } else if (channel === "wecom") {
      if (!credentials.corpId || !credentials.agentSecret) {
        sendJson(res, 200, {
          ok: true,
          data: { valid: false, error: "请填写企业 ID 和应用 Secret" },
        });
        return;
      }
      result = await verifyWecomCredentials(credentials.corpId, credentials.agentSecret);
    } else if (channel === "qqbot") {
      if (!credentials.appId || !credentials.appSecret) {
        sendJson(res, 200, {
          ok: true,
          data: { valid: false, error: "请填写 AppID 和 AppSecret" },
        });
        return;
      }
      // TODO: 实现 verifyQqbotCredentials 函数
      result = { valid: true };
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
async function handleConfigureChannels(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
      const dingtalkResult = await verifyDingtalkCredentials(
        body.dingtalk.appKey,
        body.dingtalk.appSecret,
      );
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

      // 使用新版扁平配置格式 (推荐)
      channelsConfig.feishu = {
        enabled: true,
        appId: body.feishu.appId,
        appSecret: body.feishu.appSecret,
        connectionMode: "websocket", // 默认使用 WebSocket 长连接
        ...(body.feishu.encryptKey ? { encryptKey: body.feishu.encryptKey } : {}),
        ...(body.feishu.verificationToken
          ? { verificationToken: body.feishu.verificationToken }
          : {}),
      };
      configuredChannels.push("feishu");
    }

    // 处理企业微信配置
    if (body?.wecom?.corpId && body?.wecom?.agentId && body?.wecom?.agentSecret) {
      // 验证企业微信凭证
      const wecomResult = await verifyWecomCredentials(body.wecom.corpId, body.wecom.agentSecret);
      verificationResults.wecom = wecomResult;

      if (!wecomResult.valid) {
        sendJson(res, 200, {
          ok: false,
          error: `企业微信凭证验证失败: ${wecomResult.error}`,
          data: { verificationResults },
        });
        return;
      }

      channelsConfig.wecom = {
        enabled: true,
        app: {
          corpId: body.wecom.corpId,
          agentId: body.wecom.agentId,
          agentSecret: body.wecom.agentSecret,
          ...(body.wecom.token ? { token: body.wecom.token } : {}),
          ...(body.wecom.encodingAESKey ? { encodingAESKey: body.wecom.encodingAESKey } : {}),
        },
      };
      configuredChannels.push("wecom");
    }

    // 处理 QQ 机器人配置
    if (body?.qqbot?.appId && body?.qqbot?.appSecret) {
      // TODO: 实现 verifyQqbotCredentials 函数，暂时跳过验证
      const qqbotResult = { valid: true };
      verificationResults.qqbot = qqbotResult;

      channelsConfig.qqbot = {
        enabled: true,
        sandbox: body.qqbot.sandbox ?? false,
        app: {
          appId: body.qqbot.appId,
          appSecret: body.qqbot.appSecret,
          ...(body.qqbot.token ? { token: body.qqbot.token } : {}),
        },
      };
      configuredChannels.push("qqbot");
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
    // 注：渠道插件默认启用（BUNDLED_ENABLED_BY_DEFAULT），无需设置 plugins.entries
    // channels.* 配置变更会触发热更新，自动重启对应渠道
    const nextConfig: ClawdbotConfig = {
      ...config,
      channels: channelsConfig as ClawdbotConfig["channels"],
    };

    // 持久化到磁盘
    await writeConfigFile(nextConfig);

    // 立即启动配置的渠道（热更新，无需重启 Gateway）
    const startedChannels: string[] = [];
    if (channelStartCallback) {
      for (const channelId of configuredChannels) {
        try {
          await channelStartCallback(channelId as ChannelId);
          startedChannels.push(channelId);
        } catch (err) {
          console.error(`[setup-wizard] Failed to start channel ${channelId}:`, err);
        }
      }
    }

    updateSetupState({
      step: 5,
      channelsConfigured: configuredChannels,
    });

    sendJson(res, 200, {
      ok: true,
      data: { channels: configuredChannels, verificationResults, startedChannels },
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `配置失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * GET /api/setup/qrcode - 获取体验群二维码
 *
 * 在 setup wizard 的 Step 4 中展示，帮助用户扫码加群获取体验秘钥。
 * 复用 support-qrcode 模块的本地二维码读取能力。
 */
async function handleGetQrcode(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const qrcode = getSetupQrcode();

    if (!qrcode) {
      sendJson(res, 200, { ok: true, data: { qrcode: null } });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      data: {
        qrcode: {
          base64: qrcode.base64,
          groupName: qrcode.groupName,
        },
      },
    });
  } catch (error) {
    sendJson(res, 200, { ok: true, data: { qrcode: null } });
  }
}

/**
 * POST /api/setup/complete - 完成配置
 *
 * 【重要】将 setup.completedAt 持久化到配置文件，防止 setup 未完成时
 * 因 API Key + workspace 已保存而跳过 setup wizard。
 */
async function handleComplete(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const config = loadConfig();
    const nextConfig = {
      ...config,
      setup: {
        ...config.setup,
        completedAt: new Date().toISOString(),
      },
    };
    await writeConfigFile(nextConfig);

    updateSetupState({
      completed: true,
    });

    sendJson(res, 200, { ok: true, data: { completed: true } });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `保存失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * POST /api/setup/validate-license - 验证 ClawdbotCN 许可证
 *
 * 【重要修复】使用统一的新版 License API（/api/api/v1/license/verify）
 * 而不是老版 API（/api/api/verify-key），确保：
 * 1. 设备正确注册到授权系统
 * 2. Token 能够正常获取
 * 3. 后续 Gateway 启动时验证通过
 */
async function handleValidateLicense(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody<{ token: string }>(req);
  if (!body || !body.token) {
    sendJson(res, 400, { ok: false, error: "缺少许可证 Key" });
    return;
  }

  const key = body.token.trim();

  try {
    // 【修复核心】使用新版 License API 进行验证（包含设备注册）
    // 这样可以确保 Token 获取成功，因为设备已在验证过程中注册
    console.log("[setup-wizard] Validating license with unified API...");

    const result = await verifyLicenseWithRetry(key, {
      maxRetries: 3,
    });

    if (result.valid) {
      // 验证成功，保存许可证状态到配置
      const config = loadConfig();
      const nextConfig = {
        ...config,
        license: {
          key,
          status: result.license?.tier ?? "basic",
          expiresAt: result.license?.expiresAt ?? undefined,
          validatedAt: new Date().toISOString(),
        },
      };
      await writeConfigFile(nextConfig);

      // 同步更新 Gateway 全局 License 状态（使用真实的验证响应数据）
      updateGatewayLicenseState({
        checking: false,
        valid: true,
        offlineMode: false,
        error: null,
        errorCode: null,
        license: result.license,
        device: result.device,
        renewalReminder: result.renewalReminder,
        forceUpdate: result.forceUpdate,
        pendingNotifications: [],
        lastVerifiedAt: Date.now(),
        deviceSwitchInfo: result.deviceSwitchInfo ?? null,
        deviceSwitchCooldown: result.deviceSwitchCooldown ?? null,
      });

      // 【修复核心】先同步获取一次 Token，确保激活后立即可用
      console.log("[setup-wizard] Fetching initial token...");
      const tokenSuccess = await refreshToken(key);
      if (tokenSuccess) {
        console.log("[setup-wizard] Initial token fetch succeeded");
      } else {
        console.warn("[setup-wizard] Initial token fetch failed, will retry in background");
      }

      // 启动短期令牌自动刷新
      startTokenAutoRefresh(key, {
        intervalMs: 30 * 60 * 1000, // 30 分钟检查一次
        onInvalid: () => {
          console.warn("[setup-wizard] Token became invalid after activation");
        },
      });

      sendJson(res, 200, {
        ok: true,
        data: {
          valid: true,
          status: result.license?.tier,
          expiresAt: result.license?.expiresAt,
          message: "许可证验证成功",
        },
      });
    } else {
      // 验证失败，返回详细错误信息
      const errorMessage = result.errorMessage || getErrorMessageForCode(result.errorCode);

      // 处理设备切换场景（errorCode=1010）
      // 注意：服务器返回的设备切换信息在 device 字段中，需要映射到 deviceSwitchInfo
      if (result.errorCode === LicenseErrorCode.ERROR_DEVICE_SWITCH_REQUIRED) {
        // 从 device 字段提取设备切换信息（服务器返回的结构）
        const deviceSwitchInfo =
          result.deviceSwitchInfo ??
          (result.device
            ? {
                existingDeviceId: (result.device as unknown as Record<string, unknown>)
                  .existingDeviceId as string,
                existingDeviceName: (result.device as unknown as Record<string, unknown>)
                  .existingDeviceName as string,
                existingOsInfo: (result.device as unknown as Record<string, unknown>)
                  .existingOsInfo as string,
                deviceLimit: result.device.deviceLimit,
                boundDevices: result.device.boundDevices,
              }
            : undefined);

        sendJson(res, 200, {
          ok: true,
          data: {
            valid: false,
            errorCode: result.errorCode,
            error: errorMessage,
            deviceSwitchInfo,
          },
        });
        return;
      }

      // 处理设备切换冷却（errorCode=1011）
      // 注意：服务器返回的冷却信息可能在 device 字段中
      if (result.errorCode === LicenseErrorCode.ERROR_DEVICE_SWITCH_COOLDOWN) {
        // 从 device 字段提取冷却信息
        const deviceSwitchCooldown =
          result.deviceSwitchCooldown ??
          (result.device
            ? {
                cooldownRemainingHours: (result.device as unknown as Record<string, unknown>)
                  .cooldownRemainingHours as number | null,
                cooldownEndsAt: (result.device as unknown as Record<string, unknown>)
                  .cooldownEndsAt as string | null,
              }
            : undefined);

        sendJson(res, 200, {
          ok: true,
          data: {
            valid: false,
            errorCode: result.errorCode,
            error: errorMessage,
            deviceSwitchCooldown,
          },
        });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        data: {
          valid: false,
          errorCode: result.errorCode,
          error: errorMessage,
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

      // 同步更新 Gateway 全局 License 状态
      updateGatewayLicenseState({
        checking: false,
        valid: true,
        offlineMode: false,
        error: null,
        errorCode: null,
        license: {
          tier: "test",
          tierName: "开发版",
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          daysRemaining: 365,
          keyType: "test",
          features: [],
        },
        device: null,
        renewalReminder: null,
        forceUpdate: null,
        pendingNotifications: [],
        lastVerifiedAt: Date.now(),
        deviceSwitchInfo: null,
        deviceSwitchCooldown: null,
      });

      // 启动短期令牌自动刷新（开发模式也需要）
      startTokenAutoRefresh(key, {
        intervalMs: 30 * 60 * 1000,
        onInvalid: () => {
          console.warn("[setup-wizard] Token became invalid (dev mode)");
        },
      });

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
 * 根据错误码获取用户友好的错误消息
 */
function getErrorMessageForCode(errorCode: LicenseErrorCode | null): string {
  if (!errorCode) {
    return "授权验证失败，请稍后重试";
  }

  const messages: Record<LicenseErrorCode, string> = {
    [LicenseErrorCode.ERROR_KEY_NOT_FOUND]: "授权码不存在，请检查输入",
    [LicenseErrorCode.ERROR_KEY_EXPIRED]: "授权已过期，请续费后继续使用",
    [LicenseErrorCode.ERROR_KEY_REVOKED]: "授权码已被撤销，请联系客服",
    [LicenseErrorCode.ERROR_DEVICE_LIMIT]: "设备数已达上限，请先解绑其他设备",
    [LicenseErrorCode.ERROR_KEY_BINDBY_OTHER]: "授权码已被他人使用，请联系客服",
    [LicenseErrorCode.ERROR_INVALID_SIGN]: "请求签名验证失败，请检查客户端版本",
    [LicenseErrorCode.ERROR_TIMESTAMP_EXPIRED]: "请求时间戳过期，请检查系统时间",
    [LicenseErrorCode.ERROR_KEY_EXHAUSTED]: "授权码使用次数已用尽，请购买新授权",
    [LicenseErrorCode.ERROR_UNBIND_COOLDOWN]: "解绑冷却中，请稍后再试",
    [LicenseErrorCode.ERROR_DEVICE_SWITCH_REQUIRED]: "检测到已在其他设备使用此密钥，需要确认切换",
    [LicenseErrorCode.ERROR_DEVICE_SWITCH_COOLDOWN]: "设备切换冷却中，请稍后再试",
  };

  return messages[errorCode] || "授权验证失败，请稍后重试";
}

/**
 * POST /api/setup/switch-device - 确认设备切换（单设备模式）
 *
 * 当用户收到 errorCode=1010 (ERROR_DEVICE_SWITCH_REQUIRED) 后，
 * 通过此接口确认切换到当前设备。
 */
async function handleSwitchDevice(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody<{ token: string }>(req);
  if (!body || !body.token) {
    sendJson(res, 400, { ok: false, error: "缺少 token 参数" });
    return;
  }

  const key = body.token.trim();

  try {
    // 调用 license 模块的设备切换函数
    const result = await switchDevice(key);

    if (result.valid) {
      // 切换成功，更新配置
      const config = loadConfig();
      const nextConfig = {
        ...config,
        license: {
          key,
          status: result.license?.tier ?? "basic",
          expiresAt: result.license?.expiresAt,
          validatedAt: new Date().toISOString(),
        },
      };
      await writeConfigFile(nextConfig);

      // 更新 Gateway 全局 License 状态
      updateGatewayLicenseState({
        checking: false,
        valid: true,
        offlineMode: false,
        error: null,
        errorCode: null,
        license: result.license ?? null,
        device: null,
        renewalReminder: null,
        forceUpdate: null,
        pendingNotifications: [],
        lastVerifiedAt: Date.now(),
        deviceSwitchInfo: null,
        deviceSwitchCooldown: null,
      });

      // 启动短期令牌自动刷新
      startTokenAutoRefresh(key, {
        intervalMs: 30 * 60 * 1000,
        onInvalid: () => {
          console.warn("[setup-wizard] Token became invalid after device switch");
        },
      });

      sendJson(res, 200, {
        ok: true,
        data: {
          valid: true,
          status: result.license?.tier,
          expiresAt: result.license?.expiresAt,
          message: "设备切换成功",
        },
      });
    } else {
      // 切换失败（可能进入冷却期）
      const errorMessage = result.errorMessage || getErrorMessageForCode(result.errorCode ?? null);

      // 处理冷却期场景
      if (result.errorCode === LicenseErrorCode.ERROR_DEVICE_SWITCH_COOLDOWN) {
        sendJson(res, 200, {
          ok: true,
          data: {
            valid: false,
            errorCode: result.errorCode,
            error: errorMessage,
            deviceSwitchCooldown: {
              cooldownRemainingHours: result.cooldownRemainingHours,
              cooldownEndsAt: result.cooldownEndsAt,
            },
          },
        });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        data: {
          valid: false,
          errorCode: result.errorCode,
          error: errorMessage,
        },
      });
    }
  } catch (error) {
    // 处理 DeviceSwitchError
    if (error instanceof DeviceSwitchError) {
      const errorCode = error.errorCode ?? null;

      // 冷却期错误
      if (errorCode === LicenseErrorCode.ERROR_DEVICE_SWITCH_COOLDOWN) {
        sendJson(res, 200, {
          ok: true,
          data: {
            valid: false,
            errorCode,
            error: error.message,
            deviceSwitchCooldown: {
              cooldownRemainingHours: error.cooldownRemainingHours,
              cooldownEndsAt: error.cooldownEndsAt,
            },
          },
        });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        data: {
          valid: false,
          errorCode,
          error: error.message,
        },
      });
      return;
    }

    // 其他错误
    sendJson(res, 200, {
      ok: true,
      data: {
        valid: false,
        error: `设备切换失败: ${error instanceof Error ? error.message : String(error)}`,
      },
    });
  }
}

/**
 * POST /api/setup/restart - 重启 Gateway 以应用配置
 */
async function handleRestart(_req: IncomingMessage, res: ServerResponse): Promise<void> {
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
async function handleGetAffiliateLinks(_req: IncomingMessage, res: ServerResponse): Promise<void> {
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
async function handleFetchModels(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
// ClawdbotCN 独家福利：每日免费大模型
// ============================================================================

import { getAllFreeModelProviders, getFreeModelProvider } from "../config/free-model-providers.js";
import type { FreeModelsConfig, FreeModelAccount } from "../config/types.free-models.js";
import { DEFAULT_FREE_MODELS_CONFIG } from "../config/types.free-models.js";
import { FreeModelScheduler } from "../agents/free-model-scheduler.js";

/**
 * GET /api/setup/free-models/providers - 获取可用的免费模型提供商列表
 */
async function handleGetFreeModelProviders(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const providers = getAllFreeModelProviders().map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    freeQuota: p.freeQuota,
    registerUrl: p.registerUrl,
    docsUrl: p.docsUrl,
    features: p.features,
    recommended: p.recommended,
  }));

  sendJson(res, 200, {
    ok: true,
    data: { providers },
  });
}

interface ConfigureFreeModelRequest {
  providerId: string;
  apiKey: string;
}

/**
 * POST /api/setup/free-models/test - 测试免费模型 API 密钥
 */
async function handleTestFreeModelApiKey(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody<ConfigureFreeModelRequest>(req);
  if (!body || !body.providerId || !body.apiKey) {
    sendJson(res, 400, { ok: false, error: "缺少必要参数" });
    return;
  }

  const { providerId, apiKey } = body;

  // 检查 Provider 是否存在
  const provider = getFreeModelProvider(providerId);
  if (!provider) {
    sendJson(res, 400, { ok: false, error: "未知的模型提供商" });
    return;
  }

  try {
    // 发送测试请求
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider.defaultModel,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      sendJson(res, 200, { ok: true, data: { valid: true } });
      return;
    }

    // 401/403 是认证错误
    if (response.status === 401 || response.status === 403) {
      sendJson(res, 200, {
        ok: true,
        data: { valid: false, error: "API 密钥无效或已过期" },
      });
      return;
    }

    // 429/402 可能是额度问题，但密钥本身是有效的
    if (response.status === 429 || response.status === 402) {
      sendJson(res, 200, { ok: true, data: { valid: true } });
      return;
    }

    const errorBody = await response.text();
    sendJson(res, 200, {
      ok: true,
      data: { valid: false, error: `HTTP ${response.status}: ${errorBody.slice(0, 200)}` },
    });
  } catch (error) {
    sendJson(res, 200, {
      ok: true,
      data: {
        valid: false,
        error: error instanceof Error ? error.message : "网络错误",
      },
    });
  }
}

/**
 * POST /api/setup/free-models/configure - 配置免费模型
 */
async function handleConfigureFreeModels(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody<{ accounts: Array<{ providerId: string; apiKey: string }> }>(req);
  if (!body || !body.accounts || !Array.isArray(body.accounts)) {
    sendJson(res, 400, { ok: false, error: "缺少必要参数" });
    return;
  }

  try {
    const config = await loadConfig();

    // 构建免费模型配置
    const freeModelsConfig: FreeModelsConfig = {
      ...DEFAULT_FREE_MODELS_CONFIG,
      enabled: body.accounts.length > 0,
      accounts: body.accounts.map((a, i) => ({
        providerId: a.providerId,
        apiKey: a.apiKey,
        enabled: true,
        priority: i + 1,
        todayUsage: {
          tokens: 0,
          requests: 0,
          lastUpdated: new Date().toISOString(),
        },
        status: "active" as const,
      })),
    };

    // 保存到配置
    (config as { freeModels?: FreeModelsConfig }).freeModels = freeModelsConfig;
    await writeConfigFile(config);

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `配置失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * GET /api/setup/free-models/config - 获取当前免费模型配置
 */
async function handleGetFreeModelsConfig(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const config = await loadConfig();
    const freeModelsConfig = (config as { freeModels?: FreeModelsConfig }).freeModels;

    if (!freeModelsConfig) {
      sendJson(res, 200, {
        ok: true,
        data: { configured: false, config: DEFAULT_FREE_MODELS_CONFIG },
      });
      return;
    }

    // 掩码 API 密钥
    const safeConfig = {
      ...freeModelsConfig,
      accounts: freeModelsConfig.accounts.map((a) => ({
        ...a,
        apiKey: a.apiKey ? `${a.apiKey.slice(0, 4)}****${a.apiKey.slice(-4)}` : "",
      })),
    };

    sendJson(res, 200, {
      ok: true,
      data: { configured: true, config: safeConfig },
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `获取配置失败: ${error instanceof Error ? error.message : String(error)}`,
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
        case "/free-models/providers":
          await handleGetFreeModelProviders(req, res);
          return true;
        case "/free-models/config":
          await handleGetFreeModelsConfig(req, res);
          return true;
        case "/qrcode":
          await handleGetQrcode(req, res);
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
        case "/switch-device":
          await handleSwitchDevice(req, res);
          return true;
        case "/fetch-models":
          await handleFetchModels(req, res);
          return true;
        case "/free-models/test":
          await handleTestFreeModelApiKey(req, res);
          return true;
        case "/free-models/configure":
          await handleConfigureFreeModels(req, res);
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

  // 老用户保护：如果已激活过授权码，说明已完成初始配置，不再弹出 Setup Wizard。
  // 这避免了老用户因缺少 workspace 或使用环境变量配置 API Key 而被误重定向的问题。
  const hasLicense = Boolean(config.license?.key);
  if (hasLicense) return false;

  // 如果 setup wizard 已显式完成（handleComplete 写入的标记），不再弹出。
  // 这是防止老用户误弹的第二道保护（向后兼容：老配置无此字段不受影响）。
  const setupCompleted = Boolean(config.setup?.completedAt);
  if (setupCompleted) return false;

  // 检查是否已配置 API Key
  const hasApiKey = Boolean(config.auth?.profiles && Object.keys(config.auth.profiles).length > 0);

  // 检查是否已配置工作目录
  const hasWorkspace = Boolean(config.agents?.defaults?.workspace);

  // 如果缺少必要配置，显示 Setup Wizard
  if (!hasApiKey || !hasWorkspace) return true;

  // 【关键修复】API Key + workspace 都已配置，但没有 license 且没有 setup.completedAt
  // 说明 setup wizard 进行到了中途（Steps 1-2 已保存配置）但未完成 license 验证。
  // 必须继续显示 setup wizard，让用户完成激活流程。
  return true;
}

/**
 * 获取 Setup Wizard 的 URL
 */
export function getSetupWizardUrl(port: number): string {
  return `http://localhost:${port}/setup`;
}
