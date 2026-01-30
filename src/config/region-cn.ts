/**
 * 中国区配置模块
 * China Region Configuration Module
 *
 * 为中国用户提供本地化的默认配置和推荐选项
 */

// ============================================================================
// 类型定义 (Types)
// ============================================================================

export interface AffiliateLink {
  /** 平台唯一标识 */
  id: string;
  /** 平台名称 */
  name: string;
  /** 平台 Logo URL */
  logo?: string;
  /** 推广链接 (带 affiliate ID) */
  affiliateUrl: string;
  /** 控制台地址 */
  consoleUrl: string;
  /** API Key 获取地址 */
  apiKeyUrl: string;
  /** 新用户福利描述 */
  benefits: string[];
  /** 是否推荐 */
  recommended?: boolean;
  /** 排序优先级 (数字越小越靠前) */
  priority: number;
}

export interface CnProviderConfig {
  /** 提供商 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 简短描述 */
  description: string;
  /** API 端点 */
  apiEndpoint: string;
  /** 认证字段类型 (默认 apiKey) */
  authField?: "apiKey" | "secretId" | "accessToken";
  /** 认证输入提示 */
  authHint?: string;
  /** 特殊认证说明 */
  authNote?: string;
  /** 支持的模型 */
  models: {
    id: string;
    name: string;
    description?: string;
    recommended?: boolean;
    /** 价格说明 */
    pricing?: string;
  }[];
  /** 环境变量名 */
  envVar: string;
  /** 文档链接 */
  docsUrl: string;
}

export interface CnRegionConfig {
  /** 推荐的 AI 提供商顺序 */
  recommendedProviders: string[];
  /** 推荐的指挥渠道顺序 */
  recommendedChannels: string[];
  /** 隐藏的指挥渠道 (国内不可用) */
  hiddenChannels: string[];
  /** 隐藏的 AI 提供商 (国内不可用) */
  hiddenProviders: string[];
  /** Skills 镜像源 */
  skillsRegistry: string;
  /** 推广链接配置 */
  affiliateLinks: Record<string, AffiliateLink>;
  /** AI 提供商配置 */
  providers: Record<string, CnProviderConfig>;
}

// ============================================================================
// 推广链接配置 (Affiliate Links)
// 注意：实际推广 ID 需要替换为真实值
// ============================================================================

export const AFFILIATE_LINKS: Record<string, AffiliateLink> = {
  siliconflow: {
    id: "siliconflow",
    name: "硅基流动",
    logo: "/assets/logos/siliconflow.svg",
    affiliateUrl: "https://cloud.siliconflow.cn/",
    consoleUrl: "https://cloud.siliconflow.cn/",
    apiKeyUrl: "https://cloud.siliconflow.cn/account/ak",
    benefits: [
      "聚合多家顶尖大模型",
      "DeepSeek-R1/V3、Qwen2.5 等免费使用",
      "OpenAI 兼容 API",
      "国内访问速度快",
    ],
    recommended: true,
    priority: 1,
  },
  "aliyun-bailian": {
    id: "aliyun-bailian",
    name: "阿里云百炼",
    logo: "/assets/logos/aliyun.svg",
    // TODO: 替换为真实的推广链接
    affiliateUrl: "https://bailian.console.aliyun.com/?ref=AFFILIATE_ID",
    consoleUrl: "https://bailian.console.aliyun.com/",
    apiKeyUrl: "https://bailian.console.aliyun.com/#/api-key",
    benefits: [
      "新用户赠送 100万 免费 Token",
      "Qwen-Max 性能领先",
      "国内访问速度最快",
    ],
    recommended: false,
    priority: 2,
  },
  "volcengine-ark": {
    id: "volcengine-ark",
    name: "火山引擎 (豆包)",
    logo: "/assets/logos/volcengine.svg",
    // TODO: 替换为真实的推广链接
    affiliateUrl: "https://www.volcengine.com/product/doubao?ref=AFFILIATE_ID",
    consoleUrl: "https://console.volcengine.com/ark/",
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    benefits: [
      "新用户赠送 50万 免费 Token",
      "豆包 Pro 32K 大模型",
      "支持多模态",
    ],
    recommended: false,
    priority: 3,
  },
  "tencent-hunyuan": {
    id: "tencent-hunyuan",
    name: "腾讯混元",
    logo: "/assets/logos/tencent.svg",
    // TODO: 替换为真实的推广链接
    affiliateUrl: "https://cloud.tencent.com/product/hunyuan?ref=AFFILIATE_ID",
    consoleUrl: "https://console.cloud.tencent.com/hunyuan/",
    apiKeyUrl: "https://console.cloud.tencent.com/cam/capi",
    benefits: [
      "新用户赠送 30万 免费 Token",
      "混元大模型",
      "腾讯云生态集成",
    ],
    recommended: false,
    priority: 4,
  },
};

// ============================================================================
// AI 提供商配置 (Provider Configurations)
// ============================================================================

export const CN_PROVIDERS: Record<string, CnProviderConfig> = {
  // ============================================================================
  // 硅基流动 - 聚合平台，有免费模型，入门首选
  // ============================================================================
  siliconflow: {
    id: "siliconflow",
    name: "硅基流动",
    description: "聚合多家顶尖大模型，有免费额度，新手推荐",
    apiEndpoint: "https://api.siliconflow.cn/v1",
    authField: "apiKey", // 标准 API Key
    authHint: "格式: sk-xxx (在控制台 API密钥 页面获取)",
    models: [
      {
        id: "Qwen/Qwen2-7B-Instruct",
        name: "🆓 Qwen2 7B (免费)",
        description: "免费模型，入门首选",
        recommended: true,
        pricing: "免费",
      },
      {
        id: "THUDM/glm-4-9b-chat",
        name: "🆓 GLM-4 9B (免费)",
        description: "智谱免费模型",
        pricing: "免费",
      },
      {
        id: "internlm/internlm2_5-7b-chat",
        name: "🆓 InternLM2.5 7B (免费)",
        description: "书生浦语免费模型",
        pricing: "免费",
      },
      {
        id: "deepseek-ai/DeepSeek-V3",
        name: "💰 DeepSeek V3 (推荐)",
        description: "性价比极高，强烈推荐",
        pricing: "¥1.33/百万tokens",
      },
      {
        id: "Pro/deepseek-ai/DeepSeek-R1",
        name: "DeepSeek R1 (Pro)",
        description: "推理增强，复杂问题首选",
        pricing: "¥4/百万tokens(输入)",
      },
      {
        id: "Qwen/Qwen2-72B-Instruct",
        name: "Qwen2 72B",
        description: "通义千问最强开源模型",
        pricing: "¥4.13/百万tokens",
      },
    ],
    envVar: "SILICONFLOW_API_KEY",
    docsUrl: "https://docs.siliconflow.cn/cn/userguide/quickstart",
  },

  // ============================================================================
  // 智谱 GLM - 有免费模型！
  // ============================================================================
  glm: {
    id: "glm",
    name: "智谱 GLM",
    description: "GLM-4 系列，有永久免费模型",
    apiEndpoint: "https://open.bigmodel.cn/api/paas/v4",
    authField: "apiKey", // 格式: xxx.xxx (两段式)
    authHint: "格式: xxxxxx.xxxxxx (在 open.bigmodel.cn 控制台获取)",
    models: [
      {
        id: "glm-4-flash-250414",
        name: "🆓 GLM-4 Flash (免费)",
        description: "永久免费！速度快，日常使用首选",
        recommended: true,
        pricing: "免费",
      },
      {
        id: "glm-4-air-250414",
        name: "💰 GLM-4 Air (超值)",
        description: "性价比最高，效果接近 Plus",
        pricing: "¥0.5/百万tokens",
      },
      {
        id: "glm-4-plus",
        name: "GLM-4 Plus",
        description: "最强性能，复杂任务",
        pricing: "¥5/百万tokens",
      },
      {
        id: "glm-4-flashx-250414",
        name: "GLM-4 FlashX",
        description: "极速推理，低延迟",
        pricing: "¥0.1/百万tokens",
      },
      {
        id: "glm-4v-plus",
        name: "GLM-4V Plus (视觉)",
        description: "支持图像理解",
        pricing: "¥5/百万tokens",
      },
      {
        id: "codegeex-4",
        name: "CodeGeeX-4",
        description: "代码生成专用",
        pricing: "¥0.5/百万tokens",
      },
    ],
    envVar: "ZHIPU_API_KEY",
    docsUrl: "https://open.bigmodel.cn/dev/api/",
  },

  // ============================================================================
  // 阿里云百炼 (通义千问)
  // ============================================================================
  "aliyun-bailian": {
    id: "aliyun-bailian",
    name: "通义千问",
    description: "阿里云 Qwen 系列，新用户有免费额度",
    apiEndpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    authField: "apiKey",
    authHint: "格式: sk-xxx (在 DashScope 控制台获取)",
    models: [
      {
        id: "qwen-plus-latest",
        name: "💰 Qwen-Plus (推荐)",
        description: "性价比最高！131K上下文，日常首选",
        recommended: true,
        pricing: "¥0.8/百万tokens(输入) ¥2/百万tokens(输出)",
      },
      {
        id: "qwen-turbo-latest",
        name: "Qwen-Turbo (最便宜)",
        description: "极速推理，1M超长上下文，简单任务",
        pricing: "¥0.3/百万tokens(输入) ¥0.6/百万tokens(输出)",
      },
      {
        id: "qwen-max-latest",
        name: "Qwen-Max (最强)",
        description: "超越 DeepSeek V3，复杂任务首选，但较贵",
        pricing: "¥11.2/百万tokens(输入) ¥44.8/百万tokens(输出)",
      },
      {
        id: "qwen-long",
        name: "Qwen-Long",
        description: "超长文档处理，10M上下文",
        pricing: "¥0.5/百万tokens",
      },
      {
        id: "qwen-vl-max-latest",
        name: "Qwen-VL-Max (视觉)",
        description: "支持图像理解",
        pricing: "¥20/百万tokens",
      },
    ],
    envVar: "DASHSCOPE_API_KEY",
    docsUrl: "https://help.aliyun.com/zh/model-studio/developer-reference/",
  },

  // ============================================================================
  // DeepSeek - 极致性价比
  // ============================================================================
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek 官方，性价比之王",
    apiEndpoint: "https://api.deepseek.com",
    authField: "apiKey",
    authHint: "格式: sk-xxx (在 platform.deepseek.com 获取)",
    models: [
      {
        id: "deepseek-chat",
        name: "💰 DeepSeek Chat (V3.2)",
        description: "性价比之王！日常使用首选，已合并 Coder",
        recommended: true,
        pricing: "¥2/百万tokens(输入) ¥8/百万tokens(输出)",
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1 (推理)",
        description: "深度思考，复杂推理问题",
        pricing: "¥4/百万tokens(输入) ¥16/百万tokens(输出)",
      },
    ],
    envVar: "DEEPSEEK_API_KEY",
    docsUrl: "https://platform.deepseek.com/api-docs/",
  },

  // ============================================================================
  // 火山引擎 (豆包) - 注意：需要创建推理接入点
  // ============================================================================
  "volcengine-ark": {
    id: "volcengine-ark",
    name: "豆包 (火山引擎)",
    description: "字节跳动豆包，需在控制台创建「推理接入点」",
    apiEndpoint: "https://ark.cn-beijing.volces.com/api/v3",
    authField: "apiKey",
    authHint: "格式: 在火山引擎控制台创建 API Key",
    authNote: "⚠️ 重要：模型 ID 是你创建的「推理接入点 ID」，不是固定值！请在控制台 console.volcengine.com/ark 创建接入点后填入。",
    models: [
      {
        id: "ep-xxxxxxxxxx",
        name: "💰 豆包 1.8 (推荐)",
        description: "最新版本，性价比高。⚠️ 请替换为你的接入点 ID",
        recommended: true,
        pricing: "¥0.8/百万tokens起",
      },
      {
        id: "ep-yyyyyyyyyy",
        name: "豆包 1.6 Flash (便宜)",
        description: "极速响应。⚠️ 请替换为你的接入点 ID",
        pricing: "¥0.075/百万tokens起",
      },
      {
        id: "ep-zzzzzzzzzz",
        name: "豆包 1.6 Lite",
        description: "轻量版本。⚠️ 请替换为你的接入点 ID",
        pricing: "¥0.15/百万tokens起",
      },
    ],
    envVar: "ARK_API_KEY",
    docsUrl: "https://www.volcengine.com/docs/82379/1263482",
  },

  // ============================================================================
  // MiniMax
  // ============================================================================
  minimax: {
    id: "minimax",
    name: "MiniMax",
    description: "MiniMax M2.1，只需 API Key（不需要 Group ID）",
    apiEndpoint: "https://api.minimaxi.com/anthropic",
    authField: "apiKey",
    authHint: "在 platform.minimaxi.com 获取 API Key（很长的字符串，不需要 Group ID）",
    models: [
      {
        id: "MiniMax-M2.1",
        name: "💰 MiniMax M2.1 (推荐)",
        description: "多语言编程 / Agent 工作流",
        recommended: true,
        pricing: "¥2.1/百万tokens(输入) ¥8.4/百万tokens(输出)",
      },
      {
        id: "MiniMax-M2.1-lightning",
        name: "MiniMax M2.1 Lightning",
        description: "极速版，延迟更低",
        pricing: "¥2.1/百万tokens(输入) ¥16.8/百万tokens(输出)",
      },
    ],
    envVar: "MINIMAX_API_KEY",
    docsUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
  },

  // ============================================================================
  // 腾讯混元
  // ============================================================================
  "tencent-hunyuan": {
    id: "tencent-hunyuan",
    name: "腾讯混元",
    description: "混元大模型系列",
    apiEndpoint: "https://hunyuan.tencentcloudapi.com",
    authField: "secretId", // 腾讯云使用 SecretId + SecretKey
    authHint: "需要 SecretId 和 SecretKey (在腾讯云控制台获取)",
    models: [
      {
        id: "hunyuan-pro",
        name: "混元 Pro",
        description: "最强性能",
        recommended: true,
      },
      {
        id: "hunyuan-standard",
        name: "💰 混元 Standard (推荐)",
        description: "均衡性价比，日常使用",
      },
      {
        id: "hunyuan-lite",
        name: "混元 Lite (便宜)",
        description: "轻量快速",
      },
    ],
    envVar: "HUNYUAN_SECRET_ID",
    docsUrl: "https://cloud.tencent.com/document/product/1729/",
  },
};

// ============================================================================
// 中国区默认配置 (China Region Defaults)
// ============================================================================

export const CN_REGION_CONFIG: CnRegionConfig = {
  // AI 提供商推荐顺序（必须与 CN_PROVIDERS 中的 key 一致）
  recommendedProviders: [
    "siliconflow",
    "glm",
    "aliyun-bailian",
    "deepseek",
    "volcengine-ark",
    "minimax",
    "tencent-hunyuan",
  ],

  // 指挥渠道推荐顺序（企业微信暂不支持）
  recommendedChannels: ["dingtalk", "feishu"],

  // 隐藏不可用的指挥渠道
  hiddenChannels: [
    "telegram",
    "discord",
    "whatsapp",
    "slack",
    "signal",
    "imessage",
  ],

  // 隐藏不可用的 AI 提供商
  hiddenProviders: [
    "openai",
    "anthropic",
    "google",
    "openrouter",
    "ai-gateway",
  ],

  // Skills 镜像源 (ClawdSkillsProxy 服务)
  skillsRegistry: "http://121.43.61.90/api",

  // 推广链接
  affiliateLinks: AFFILIATE_LINKS,

  // 提供商配置
  providers: CN_PROVIDERS,
};

// ============================================================================
// 工具函数 (Utility Functions)
// ============================================================================

/**
 * 检测是否为中国区用户
 * 通过时区、语言等信息判断
 */
export function detectChinaRegion(): boolean {
  // 检查环境变量强制设置
  if (process.env.CLAWDBOT_REGION === "cn") return true;
  if (process.env.CLAWDBOT_REGION === "global") return false;

  // 检查时区
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone.startsWith("Asia/Shanghai") || timezone.startsWith("Asia/Chongqing")) {
      return true;
    }
  } catch {
    // ignore
  }

  // 检查语言环境
  const lang = process.env.LANG || process.env.LC_ALL || "";
  if (lang.toLowerCase().includes("zh_cn") || lang.toLowerCase().includes("zh-cn")) {
    return true;
  }

  return false;
}

/**
 * 获取中国区配置
 */
export function getCnRegionConfig(): CnRegionConfig {
  return CN_REGION_CONFIG;
}

/**
 * 获取推荐的 AI 提供商列表
 */
export function getRecommendedProviders(): CnProviderConfig[] {
  return CN_REGION_CONFIG.recommendedProviders
    .map((id) => CN_PROVIDERS[id])
    .filter((p): p is CnProviderConfig => p !== undefined);
}

/**
 * 获取推广链接
 */
export function getAffiliateLinks(): AffiliateLink[] {
  return Object.values(AFFILIATE_LINKS).sort((a, b) => a.priority - b.priority);
}

/**
 * 获取指定提供商的推广链接
 */
export function getAffiliateLink(providerId: string): AffiliateLink | null {
  return AFFILIATE_LINKS[providerId] ?? null;
}

/**
 * 检查指挥渠道是否应该在中国区隐藏
 */
export function isChannelHiddenInCn(channelId: string): boolean {
  return CN_REGION_CONFIG.hiddenChannels.includes(channelId);
}

/**
 * 检查 AI 提供商是否应该在中国区隐藏
 */
export function isProviderHiddenInCn(providerId: string): boolean {
  return CN_REGION_CONFIG.hiddenProviders.includes(providerId);
}

// ============================================================================
// 默认安全配置 (Default Security Config for CN)
// ============================================================================

export const CN_DEFAULT_SECURITY_CONFIG = {
  sandbox: {
    mode: "non-main" as const,
    scope: "session" as const,
    workspaceAccess: "rw" as const,
  },
  tools: {
    write: {
      allowDelete: false, // 禁止删除文件
    },
    exec: {
      security: "allowlist" as const,
      allowlist: [
        // Windows 常用
        "notepad",
        "explorer",
        "calc",
        "mspaint",
        "code",
        "cmd",
        "powershell",
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
        // 网络工具（安全）
        "curl",
        "wget",
        // 办公软件
        "wps",
      ],
    },
    browser: {
      profile: "clawdbot",
      allowHostBrowser: false,
    },
  },
};

