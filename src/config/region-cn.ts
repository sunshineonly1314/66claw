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
  /** 隐藏的技能 (国内不可用或已废弃) */
  hiddenSkills: string[];
  /** CN上下文降级技能：已安装但不自动注入LLM上下文（依赖海外服务） */
  cnDeprioritizedSkills: string[];
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
    affiliateUrl: "https://cloud.siliconflow.cn/i/uXXX7IEi",
    consoleUrl: "https://cloud.siliconflow.cn/i/uXXX7IEi",
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
    benefits: ["新用户赠送 100万 免费 Token", "Qwen-Max 性能领先", "国内访问速度最快"],
    recommended: false,
    priority: 2,
  },
  "volcengine-ark": {
    id: "volcengine-ark",
    name: "火山引擎 (豆包)",
    logo: "/assets/logos/volcengine.svg",
    affiliateUrl:
      "https://partner.volcengine.com/partners/auth/confirm?inviteToken=HNOCB9ZQY0R8BA3BEK685Z4OKDIYSYZX2UNQZ7IMCYQL7DL0DMPJII6RN9PS063F&partnerType=101&partnerName=%E4%B8%8A%E6%B5%B7%E6%9D%AD%E8%8A%82%E4%BA%91%E7%A7%91%E6%8A%80%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8&identityType=11&PartnerEmployeeId=72406401",
    consoleUrl: "https://console.volcengine.com/ark/",
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    benefits: ["新用户赠送 50万 免费 Token", "豆包 Pro 32K 大模型", "支持多模态"],
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
    benefits: ["新用户赠送 30万 免费 Token", "混元大模型", "腾讯云生态集成"],
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
      // ⭐ 性价比推荐放最前
      {
        id: "deepseek-ai/DeepSeek-V3",
        name: "⭐ DeepSeek V3 (性价比之王)",
        description: "日常首选！671B参数，效果好价格低",
        recommended: true,
        pricing: "按量计费",
      },
      // 🧠 最强模型
      {
        id: "Pro/deepseek-ai/DeepSeek-R1",
        name: "🧠 DeepSeek R1 Pro (最强推理)",
        description: "复杂数学/代码/逻辑问题",
        pricing: "¥4/百万tokens",
      },
      // 💰 免费模型
      {
        id: "Qwen/Qwen3-8B",
        name: "💰 Qwen3 8B (免费)",
        description: "最新Qwen3，中文能力强",
        pricing: "免费",
      },
      {
        id: "THUDM/glm-4-9b-chat",
        name: "💰 GLM-4 9B (免费)",
        description: "智谱免费模型",
        pricing: "免费",
      },
      {
        id: "internlm/internlm2_5-7b-chat",
        name: "💰 InternLM2.5 7B (免费)",
        description: "书生浦语免费模型",
        pricing: "免费",
      },
      // 其他模型
      {
        id: "Qwen/Qwen2.5-72B-Instruct",
        name: "Qwen2.5 72B",
        description: "通义千问最强开源模型",
        pricing: "按量计费",
      },
      {
        id: "Qwen/Qwen2.5-Coder-32B-Instruct",
        name: "Qwen2.5 Coder 32B",
        description: "代码生成专用",
        pricing: "按量计费",
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
      // ⭐ 性价比推荐
      {
        id: "glm-4-air-250414",
        name: "⭐ GLM-4.5 Air (性价比之王)",
        description: "日常首选！效果好价格低",
        recommended: true,
        pricing: "¥0.5/百万tokens",
      },
      // 🧠 最强模型
      {
        id: "glm-5",
        name: "🧠 GLM-5 (最强)",
        description: "最新旗舰模型",
      },
      {
        id: "glm-5-code",
        name: "GLM-5-Code",
        description: "GLM-5 代码专用版",
      },
      {
        id: "glm-4.7",
        name: "GLM-4.7",
        description: "Agent/代码增强",
      },
      {
        id: "glm-4.7-flash",
        name: "💰 GLM-4.7-Flash (免费)",
        description: "4.7系列免费版，速度快",
      },
      {
        id: "glm-4.6",
        name: "GLM-4.6",
        description: "稳定版本",
      },
      {
        id: "glm-4.6v",
        name: "GLM-4.6V (视觉)",
        description: "支持图像理解",
      },
      {
        id: "glm-4.5",
        name: "GLM-4.5",
        description: "均衡性能",
      },
      {
        id: "glm-4.5-flash",
        name: "💰 GLM-4.5-Flash (免费)",
        description: "免费！速度快",
      },
      {
        id: "glm-4.5-air",
        name: "GLM-4.5-Air",
        description: "轻量快速",
      },
      {
        id: "glm-4.5v",
        name: "GLM-4.5V (视觉)",
        description: "支持图像理解",
      },
      // 其他模型
      {
        id: "glm-4-plus",
        name: "GLM-4 Plus",
        description: "复杂任务",
      },
      {
        id: "glm-4-flash-250414",
        name: "💰 GLM-4 Flash (免费)",
        description: "免费！速度快",
      },
      {
        id: "glm-4v-plus",
        name: "GLM-4V Plus (视觉)",
        description: "支持图像理解",
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
        id: "qwen-plus",
        name: "💰 Qwen-Plus (推荐)",
        description: "性价比最高！131K上下文，日常首选",
        recommended: true,
        pricing: "¥0.8/百万tokens(输入) ¥2/百万tokens(输出)",
      },
      {
        id: "qwen-turbo",
        name: "Qwen-Turbo (最便宜)",
        description: "极速推理，1M超长上下文，简单任务",
        pricing: "¥0.3/百万tokens(输入) ¥0.6/百万tokens(输出)",
      },
      {
        id: "qwen-max",
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
        id: "qwen-vl-max",
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
  // 火山引擎 (豆包) - 需要先在控制台开通模型
  // ============================================================================
  "volcengine-ark": {
    id: "volcengine-ark",
    name: "豆包 (火山引擎)",
    description: "字节跳动豆包，需先在控制台开通模型",
    apiEndpoint: "https://ark.cn-beijing.volces.com/api/v3",
    authField: "apiKey",
    authHint: "格式: 在火山引擎控制台创建 API Key",
    authNote:
      "⚠️ 重要：使用前必须在火山方舟控制台「开通管理」页面开通对应模型！开通地址: https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement",
    models: [
      {
        id: "doubao-seed-1-8-251228",
        name: "💰 豆包 1.8 (推荐)",
        description: "最新版本，性能强大，性价比高",
        recommended: true,
        pricing: "¥0.4/百万tokens(输入) ¥1.6/百万tokens(输出)",
      },
      {
        id: "doubao-seed-1-6-251015",
        name: "豆包 1.6",
        description: "稳定版本",
      },
      {
        id: "doubao-seed-1-6-lite-251015",
        name: "豆包 1.6 Lite",
        description: "轻量版本",
      },
      {
        id: "doubao-seed-1-6-flash-250828",
        name: "豆包 1.6 Flash",
        description: "极速版本",
      },
    ],
    envVar: "ARK_API_KEY",
    docsUrl: "https://www.volcengine.com/docs/82379/1330310",
  },

  // ============================================================================
  // 月之暗面 Kimi (Moonshot)
  // 官方文档: https://platform.moonshot.cn/docs/pricing/chat
  // ============================================================================
  moonshot: {
    id: "moonshot",
    name: "Kimi (月之暗面)",
    description: "长上下文之王，K2代码/Agent能力超强",
    apiEndpoint: "https://api.moonshot.cn/v1",
    authField: "apiKey",
    authHint: "格式: sk-xxx (在 platform.moonshot.cn 获取)",
    models: [
      // ⭐ 推荐 - kimi-latest 系列
      {
        id: "kimi-latest",
        name: "⭐ Kimi Latest (推荐)",
        description: "日常首选！自动选择最新版本，支持图片",
        recommended: true,
        pricing: "¥2/百万tokens(输入) ¥10/百万tokens(输出)",
      },
      // 🧠 K2 系列 - 超强代码和 Agent 能力
      {
        id: "kimi-k2-turbo-preview",
        name: "🧠 Kimi K2 Turbo (官方推荐)",
        description: "1T参数MoE，262K上下文，代码/Agent超强",
        pricing: "¥8/百万tokens(输入) ¥58/百万tokens(输出)",
      },
      {
        id: "kimi-k2-0905-preview",
        name: "Kimi K2 0905",
        description: "K2基础版，262K上下文",
        pricing: "¥4/百万tokens(输入) ¥16/百万tokens(输出)",
      },
      {
        id: "kimi-k2-0711-preview",
        name: "Kimi K2 0711",
        description: "K2早期版本，131K上下文",
        pricing: "¥4/百万tokens(输入) ¥16/百万tokens(输出)",
      },
      {
        id: "kimi-k2-thinking",
        name: "🧠 Kimi K2 Thinking (深度推理)",
        description: "K2推理版，复杂逻辑问题",
        pricing: "¥4/百万tokens(输入) ¥16/百万tokens(输出)",
      },
      {
        id: "kimi-k2-thinking-turbo",
        name: "Kimi K2 Thinking Turbo",
        description: "K2推理加速版",
        pricing: "¥8/百万tokens(输入) ¥58/百万tokens(输出)",
      },
      // 💰 便宜 - moonshot-v1 系列
      {
        id: "moonshot-v1-8k",
        name: "💰 Kimi 8K (便宜快速)",
        description: "快速响应，简单对话",
        pricing: "¥2/百万tokens(输入) ¥10/百万tokens(输出)",
      },
      {
        id: "moonshot-v1-32k",
        name: "Kimi 32K",
        description: "中等长度文档",
        pricing: "¥5/百万tokens(输入) ¥20/百万tokens(输出)",
      },
      {
        id: "moonshot-v1-128k",
        name: "Kimi 128K",
        description: "长文档处理",
        pricing: "¥10/百万tokens(输入) ¥30/百万tokens(输出)",
      },
    ],
    envVar: "MOONSHOT_API_KEY",
    docsUrl: "https://platform.moonshot.cn/docs/pricing/chat",
  },

  // ============================================================================
  // Kimi Code - 代码专用模型（与 Moonshot 是不同的产品线和 API）
  // 官方文档: https://www.kimi.com/code/docs/
  // ============================================================================
  "kimi-code": {
    id: "kimi-code",
    name: "Kimi Code",
    description: "代码专用模型，262K上下文，性价比极高",
    apiEndpoint: "https://api.kimi.com/coding/v1",
    authField: "apiKey",
    authHint: "格式: sk-kimi-xxx (在 kimi.com/code 获取)",
    authNote: "💡 Kimi Code 专为编程优化，100 Tokens/s 极速输出",
    models: [
      {
        id: "kimi-for-coding",
        name: "⭐ Kimi For Coding (推荐)",
        description: "代码专用，262K上下文，推理增强",
        recommended: true,
        pricing: "按量计费",
      },
    ],
    envVar: "KIMICODE_API_KEY",
    docsUrl: "https://www.kimi.com/code/docs/",
  },

  // ============================================================================
  // Aliyun Coding Plan - 阿里云代码助手
  // ============================================================================
  "aliyun-codeplan": {
    id: "aliyun-codeplan",
    name: "Aliyun Code",
    description: "模型聚合平台，一个 Key 调多款顶级代码模型",
    apiEndpoint: "https://coding.dashscope.aliyuncs.com/v1",
    authField: "apiKey",
    authHint: "格式: sk-xxx (在阿里云 AI Star 获取)",
    authNote: "Coding Plan 代码专用密钥，与百炼 API Key 不同",
    models: [
      {
        id: "qwen3.5-plus",
        name: "Qwen3.5-Plus (推荐)",
        description: "图片理解 · 131K 上下文",
        recommended: true,
        pricing: "按量计费",
      },
      {
        id: "kimi-k2.5",
        name: "Kimi-K2.5",
        description: "图片理解 · 131K 上下文",
        pricing: "按量计费",
      },
      {
        id: "glm-5",
        name: "GLM-5",
        description: "智谱旗舰 · 128K 上下文",
        pricing: "按量计费",
      },
      {
        id: "MiniMax-M2.5",
        name: "MiniMax-M2.5",
        description: "200K 上下文",
        pricing: "按量计费",
      },
      {
        id: "qwen3-coder-plus",
        name: "Qwen3-Coder-Plus",
        description: "代码专用 · 131K 上下文",
        pricing: "按量计费",
      },
      {
        id: "qwen3-coder-next",
        name: "Qwen3-Coder-Next (预览)",
        description: "下一代预览版",
        pricing: "按量计费",
      },
    ],
    envVar: "ALIYUN_CODEPLAN_API_KEY",
    docsUrl: "https://www.aliyun.com/benefit/ai/aistar?userCode=xsngby7y",
  },

  // ============================================================================
  // GLM Coding Plan - 智谱代码助手
  // ============================================================================
  "glm-codeplan": {
    id: "glm-codeplan",
    name: "GLM Code",
    description: "GLM-5 代码专用模型，智谱 Coding Plan",
    apiEndpoint: "https://open.bigmodel.cn/api/coding/paas/v4",
    authField: "apiKey",
    authHint: "在 open.bigmodel.cn 获取 Coding Plan 专用 API Key",
    authNote: "Coding Plan 代码专用密钥，与通用 GLM API Key 不同",
    models: [
      {
        id: "glm-5",
        name: "GLM-5 (推荐)",
        description: "Coding Plan 代码专用，128K 上下文",
        recommended: true,
        pricing: "按量计费",
      },
      {
        id: "glm-4.7",
        name: "GLM-4.7",
        description: "Coding Plan 代码模型",
        pricing: "按量计费",
      },
    ],
    envVar: "GLM_CODEPLAN_API_KEY",
    docsUrl: "https://open.bigmodel.cn",
  },

  // ============================================================================
  // MiniMax Coding Plan - MiniMax 代码助手
  // ============================================================================
  "minimax-codeplan": {
    id: "minimax-codeplan",
    name: "MiniMax Code",
    description: "MiniMax-M2.5 代码专用，Coding Plan 订阅",
    apiEndpoint: "https://api.minimaxi.com/anthropic",
    authField: "apiKey",
    authHint: "在 MiniMax 平台获取 Coding Plan 专用 API Key",
    authNote: "Coding Plan 订阅专属密钥",
    models: [
      {
        id: "MiniMax-M2.5",
        name: "MiniMax-M2.5 (推荐)",
        description: "Coding Plan 订阅专属，200K 上下文",
        recommended: true,
        pricing: "订阅制",
      },
    ],
    envVar: "MINIMAX_CODEPLAN_API_KEY",
    docsUrl: "https://platform.minimaxi.com/subscribe/coding-plan?code=I5REQrAnfL&source=link",
  },

  // ============================================================================
  // MiniMax
  // ============================================================================
  minimax: {
    id: "minimax",
    name: "MiniMax",
    description: "MiniMax M2.1，Agent/代码专家",
    apiEndpoint: "https://api.minimaxi.com/anthropic",
    authField: "apiKey",
    authHint: "在 platform.minimaxi.com 获取 API Key（很长的字符串，不需要 Group ID）",
    models: [
      // ⭐ 性价比推荐
      {
        id: "MiniMax-M2.1",
        name: "⭐ MiniMax M2.1 (Agent专家)",
        description: "日常首选！多语言编程 / Agent 工作流",
        recommended: true,
        pricing: "¥2.1/百万tokens(输入) ¥8.4/百万tokens(输出)",
      },
      {
        id: "MiniMax-M2.5",
        name: "🧠 MiniMax M2.5 (最新)",
        description: "最新旗舰模型",
      },
      {
        id: "MiniMax-M2.5-highspeed",
        name: "MiniMax M2.5 Highspeed",
        description: "M2.5 高速版",
      },
      {
        id: "MiniMax-M2",
        name: "MiniMax M2",
        description: "稳定版本",
      },
      // 💰 低延迟
      {
        id: "MiniMax-M2.1-lightning",
        name: "💰 M2.1 Lightning (低延迟)",
        description: "极速版，响应更快",
      },
      {
        id: "MiniMax-M2.1-highspeed",
        name: "M2.1 Highspeed",
        description: "M2.1 高速版",
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

  // ============================================================================
  // 国际服务 - Google Gemini
  // ============================================================================
  google: {
    id: "google",
    name: "Google Gemini",
    description: "Gemini 3/2 系列（需要科学上网）",
    apiEndpoint: "https://generativelanguage.googleapis.com/v1beta",
    authField: "apiKey",
    authHint: "格式: AIzaSy... (在 aistudio.google.com 获取)",
    authNote: "⚠️ 需要科学上网",
    models: [
      {
        id: "gemini-3-flash-preview",
        name: "💰 Gemini 3 Flash (推荐)",
        description: "最新版本，速度与智能平衡",
        recommended: true,
        pricing: "免费",
      },
      {
        id: "gemini-3-pro-preview",
        name: "🧠 Gemini 3 Pro",
        description: "最强智能，多模态理解",
        pricing: "免费",
      },
      {
        id: "gemini-3-pro-image-preview",
        name: "🎨 Gemini 3 Pro Image",
        description: "图像生成与理解",
        pricing: "免费",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "稳定版本，速度快",
        pricing: "免费",
      },
    ],
    envVar: "GOOGLE_API_KEY",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
  },

  // ============================================================================
  // 国际服务 - OpenAI
  // ============================================================================
  openai: {
    id: "openai",
    name: "OpenAI GPT",
    description: "GPT-5/4/o3/o4 系列（需要科学上网）",
    apiEndpoint: "https://api.openai.com/v1",
    authField: "apiKey",
    authHint: "格式: sk-... (在 platform.openai.com 获取)",
    authNote: "⚠️ 需要科学上网",
    models: [
      {
        id: "gpt-5.2-pro",
        name: "🧠 GPT-5.2 Pro (最强)",
        description: "最新最强智能",
        pricing: "付费",
      },
      {
        id: "gpt-5.2",
        name: "GPT-5.2",
        description: "GPT-5 最新版本",
        pricing: "付费",
      },
      {
        id: "o4-mini",
        name: "💰 o4-mini (推荐)",
        description: "推理模型，性价比高",
        recommended: true,
        pricing: "付费",
      },
      {
        id: "o3-mini",
        name: "o3-mini",
        description: "推理模型",
        pricing: "付费",
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "多模态，快速",
        pricing: "付费",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "轻量快速",
        pricing: "付费",
      },
    ],
    envVar: "OPENAI_API_KEY",
    docsUrl: "https://platform.openai.com/docs/api-reference",
  },

  // ============================================================================
  // 国际服务 - Anthropic Claude
  // ============================================================================
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Claude 4/3.5 系列（需要科学上网）",
    apiEndpoint: "https://api.anthropic.com/v1",
    authField: "apiKey",
    authHint: "格式: sk-ant-... (在 console.anthropic.com 获取)",
    authNote: "⚠️ 需要科学上网",
    models: [
      {
        id: "claude-sonnet-4-20250514",
        name: "💰 Claude Sonnet 4 (推荐)",
        description: "最新版本，智能与速度平衡",
        recommended: true,
        pricing: "付费",
      },
      {
        id: "claude-opus-4-20250514",
        name: "🧠 Claude Opus 4 (最强)",
        description: "最强智能",
        pricing: "付费",
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "稳定版本",
        pricing: "付费",
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku",
        description: "轻量快速",
        pricing: "付费",
      },
    ],
    envVar: "ANTHROPIC_API_KEY",
    docsUrl: "https://docs.anthropic.com/en/api",
  },

  // ============================================================================
  // 魔搭社区 ModelScope - 免费推理API
  // ============================================================================
  modelscope: {
    id: "modelscope",
    name: "魔搭社区",
    description: "阿里开源平台，免费推理API，每日2000次调用",
    apiEndpoint: "https://api-inference.modelscope.cn/v1",
    authField: "apiKey",
    authHint: "在 modelscope.cn/my/myaccesstoken 获取 Token",
    authNote: "💡 完全免费！每日2000次调用",
    models: [
      // ⭐ 性价比推荐
      {
        id: "Qwen/Qwen3-72B-Instruct",
        name: "⭐ Qwen3 72B (免费推荐)",
        description: "免费！最新最强Qwen3",
        recommended: true,
        pricing: "免费(2000次/天)",
      },
      // 🧠 代码专用
      {
        id: "Qwen/Qwen2.5-Coder-32B-Instruct",
        name: "🧠 Qwen2.5 Coder 32B",
        description: "代码生成专用",
        pricing: "免费(2000次/天)",
      },
      // 💰 免费模型
      {
        id: "deepseek-ai/DeepSeek-V3",
        name: "💰 DeepSeek V3 (免费)",
        description: "性价比之王",
        pricing: "免费(2000次/天)",
      },
      // 其他模型
      {
        id: "Qwen/Qwen3-32B-Instruct",
        name: "Qwen3 32B",
        description: "Qwen3中规格",
        pricing: "免费(2000次/天)",
      },
      {
        id: "THUDM/glm-4-9b-chat",
        name: "GLM-4 9B",
        description: "智谱开源",
        pricing: "免费(2000次/天)",
      },
    ],
    envVar: "MODELSCOPE_API_KEY",
    docsUrl: "https://modelscope.cn/docs",
  },

  // ============================================================================
  // 本地模型 - Ollama
  // ============================================================================
  ollama: {
    id: "ollama",
    name: "Ollama 本地模型",
    description: "本地运行的开源模型（无需联网）",
    apiEndpoint: "http://localhost:11434/v1",
    authField: "apiKey",
    authHint: "默认填 ollama 即可（本地无需验证）",
    authNote: "💡 需要先安装并启动 Ollama",
    models: [
      // ⭐ 性价比推荐
      {
        id: "qwen3:8b",
        name: "⭐ Qwen3 8B (推荐)",
        description: "最新Qwen3，中文能力强",
        recommended: true,
        pricing: "免费",
      },
      // 💰 轻量模型
      {
        id: "llama3.2:3b",
        name: "💰 Llama 3.2 3B (轻量)",
        description: "内存小也能跑",
        pricing: "免费",
      },
      {
        id: "phi3:latest",
        name: "💰 Phi-3 (轻量)",
        description: "微软小模型，2G内存可用",
        pricing: "免费",
      },
      // 其他模型
      {
        id: "qwen3:14b",
        name: "Qwen3 14B",
        description: "更强性能",
        pricing: "免费",
      },
      {
        id: "deepseek-r1:7b",
        name: "DeepSeek R1 7B",
        description: "深度思考推理模型",
        pricing: "免费",
      },
      {
        id: "gemma2:9b",
        name: "Gemma 2 9B",
        description: "Google 开源模型",
        pricing: "免费",
      },
      {
        id: "mistral:latest",
        name: "Mistral",
        description: "高效开源模型",
        pricing: "免费",
      },
    ],
    envVar: "OLLAMA_API_KEY",
    docsUrl: "https://ollama.com/library",
  },

  // ============================================================================
  // 国际服务 - NVIDIA NIM
  // ============================================================================
  nvidia: {
    id: "nvidia",
    name: "NVIDIA NIM",
    description: "NVIDIA NIM API（需要科学上网）",
    apiEndpoint: "https://integrate.api.nvidia.com/v1",
    authField: "apiKey",
    authHint: "格式: nvapi-... (在 build.nvidia.com 获取)",
    authNote: "⚠️ 需要科学上网",
    models: [
      {
        id: "nvidia/llama-3.3-nemotron-super-49b-v1",
        name: "💰 Nemotron Super 49B (推荐)",
        description: "高性能推理模型",
        recommended: true,
        pricing: "免费额度",
      },
      {
        id: "deepseek-ai/deepseek-r1",
        name: "🧠 DeepSeek R1",
        description: "深度推理模型",
        pricing: "免费额度",
      },
      {
        id: "nvidia/nemotron-3-nano-30b",
        name: "Nemotron 3 Nano 30B",
        description: "100万上下文 MoE 模型",
        pricing: "免费额度",
      },
      {
        id: "meta/llama-3.1-405b-instruct",
        name: "Llama 3.1 405B",
        description: "Meta 最大模型",
        pricing: "免费额度",
      },
      {
        id: "google/gemma-2-27b-it",
        name: "Gemma 2 27B",
        description: "Google 开源模型",
        pricing: "免费额度",
      },
      {
        id: "minimaxai/minimax-m2.1",
        name: "🧠 MiniMax M2.1",
        description: "MiniMax 大语言模型，200K 上下文",
        pricing: "按量计费",
      },
    ],
    envVar: "NVIDIA_API_KEY",
    docsUrl: "https://build.nvidia.com/docs",
  },

  // ============================================================================
  // 国际服务 - OpenRouter (聚合路由)
  // ============================================================================
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    description: "聚合数百个 AI 模型的统一 API（需要科学上网）",
    apiEndpoint: "https://openrouter.ai/api/v1",
    authField: "apiKey",
    authHint: "格式: sk-or-v1-... (在 openrouter.ai/keys 获取)",
    authNote: "⚠️ 需要科学上网",
    models: [
      {
        id: "openrouter/auto",
        name: "🔀 Auto 智能路由 (推荐)",
        description: "自动选择最优模型",
        recommended: true,
        pricing: "按量计费",
      },
      {
        id: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4",
        description: "Anthropic 编程最强",
        pricing: "$3/$15 per 1M",
      },
      {
        id: "google/gemini-2.5-flash-preview",
        name: "Gemini 2.5 Flash",
        description: "Google 最新 百万上下文",
        pricing: "低价",
      },
      {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        description: "OpenAI 旗舰多模态",
        pricing: "$2.5/$10 per 1M",
      },
      {
        id: "deepseek/deepseek-chat-v3-0324",
        name: "DeepSeek V3",
        description: "高性价比国产模型",
        pricing: "低价",
      },
    ],
    envVar: "OPENROUTER_API_KEY",
    docsUrl: "https://openrouter.ai/docs",
  },

  // ============================================================================
  // 蚂蚁百灵 - 每日免费 50 万 tokens
  // ============================================================================
  "ant-ling": {
    id: "ant-ling",
    name: "蚂蚁百灵",
    description: "蚂蚁集团旗下大模型，每日免费 50 万 tokens",
    apiEndpoint: "https://api.tbox.cn/api/llm/v1",
    authField: "apiKey",
    authHint: "格式: sk-studio-... (在 ling.tbox.cn/open 获取)",
    models: [
      {
        id: "ling-1t",
        name: "🐜 Ling-1T (推荐)",
        description: "多模态 · 联网搜索 · 复杂推理",
        recommended: true,
        pricing: "每日免费50万Token",
      },
      {
        id: "ring-1t",
        name: "Ring-1T",
        description: "通用对话模型",
        pricing: "每日免费50万Token",
      },
      {
        id: "ming-flash-omni",
        name: "Ming-Flash-Omni",
        description: "多模态快速模型",
        pricing: "每日免费50万Token",
      },
    ],
    envVar: "ANT_LING_API_KEY",
    docsUrl: "https://alipaytbox.yuque.com/sxs0ba/ling/intro",
  },

  // ============================================================================
  // 美团 LongCat - 每日免费 50 万 tokens
  // ============================================================================
  "meituan-longcat": {
    id: "meituan-longcat",
    name: "美团LongCat",
    description: "美团旗下大模型，128K 上下文，每日免费 50 万 tokens",
    apiEndpoint: "https://api.longcat.chat/openai/v1",
    authField: "apiKey",
    authHint: "格式: ak_... (在 longcat.chat 获取)",
    models: [
      {
        id: "longcat-flash-chat",
        name: "🐱 LongCat Flash (推荐)",
        description: "128K 上下文 · OpenAI 兼容",
        recommended: true,
        pricing: "每日免费50万Token",
      },
    ],
    envVar: "LONGCAT_API_KEY",
    docsUrl: "https://longcat.chat/platform/docs/zh/",
  },
};

// ============================================================================
// 中国区默认配置 (China Region Defaults)
// ============================================================================

export const CN_REGION_CONFIG: CnRegionConfig = {
  // AI 提供商推荐顺序（必须与 CN_PROVIDERS 中的 key 一致）
  recommendedProviders: [
    // 代码助手 Coding Plan（大卡片展示）
    "kimi-code",
    "aliyun-codeplan",
    "glm-codeplan",
    "minimax-codeplan",
    // 更多国产服务（折叠）— 硅基流动、MiniMax 优先
    "aliyun-bailian",
    "siliconflow",
    "minimax",
    "glm",
    "deepseek",
    "volcengine-ark",
    "moonshot",
    "tencent-hunyuan",
    "ant-ling",
    "meituan-longcat",
    // 国际服务（折叠，需要科学上网）
    "google",
    "openai",
    "anthropic",
    "nvidia",
    // 本地模型 & 自定义（折叠）
    "modelscope",
    "ollama",
  ],

  // 指挥渠道推荐顺序（企业微信暂不支持）
  recommendedChannels: ["dingtalk", "feishu"],

  // 隐藏不可用的指挥渠道
  hiddenChannels: ["telegram", "discord", "whatsapp", "slack", "signal", "imessage"],

  // 隐藏不可用的 AI 提供商
  hiddenProviders: [
    // "openai", // 已启用
    // "anthropic", // 已启用
    // "google", // 已启用
    // "openrouter", // 已启用
    "ai-gateway",
  ],

  // 隐藏的技能 (国内不可用或已废弃)
  // clawdhub: 国际版技能市场CLI工具，OpenClawCN 已内置国内技能市场，无需此工具
  hiddenSkills: ["clawdhub"],

  // CN上下文降级技能：这些技能已打包安装（万一要用），但不自动注入LLM上下文
  // 原因：依赖被GFW封锁的海外服务，大多数中国用户无法直接使用
  //
  // ⚠️ openai-whisper 名字有误导性，实际是本地离线推理，不调API，中国可用！不要加到这里！
  // ⚠️ macOS专属技能（apple-notes等）是平台限制，不是地域限制，中国Mac用户可正常使用
  cnDeprioritizedSkills: [
    // ⚠️ 注意: openai-whisper 是本地CLI推理，不调API，不在此列！
    // ⚠️ macOS技能(apple-notes等)是平台限制非地域限制，不在此列！
    //
    // ── 依赖 Google API（被墙） ──
    "gemini", // Google Gemini CLI → Gemini API
    "nano-banana-pro", // 图像生成 → Google Gemini 3 Pro API
    "gog", // Google Workspace CLI (Gmail/Calendar/Drive) — 不是本地搜索！
    "goplaces", // Google Places API
    "local-places", // Google Places API (本地代理但仍调Google)
    "ga4", // Google Analytics Data API → 替代：百度统计
    "google-ads", // Google Ads → 替代：百度推广/巨量引擎
    "google-chat", // Google Chat API → 替代：飞书/钉钉
    "google-home", // Google Nest SDM API → 替代：米家/天猫精灵
    "google-maps-grounding-lite-mcp", // Google Maps API → 替代：高德/百度地图
    "gemini-deep-research", // Gemini API → 替代：DeepSeek/通义千问
    "gemini-yt-video-transcript", // YouTube + Gemini → 替代：B站字幕+国内大模型
    "gkeep", // Google Keep → 替代：滴答清单
    "meeting-prep", // Google Calendar API → 替代：飞书日历
    "nest-devices", // Google Nest Device Access → 替代：米家
    "notebooklm-skill", // Google NotebookLM → 替代：通义听悟
    "whatdo", // Google Calendar + Places → 替代：飞书日历+高德
    // ── 依赖 YouTube（被墙） ──
    "youtube-analytics", // YouTube Data API → 替代：B站数据
    "youtube-instant-article", // youtube.com → 替代：B站视频总结
    "youtube-summarizer", // youtube.com 字幕 → 替代：B站字幕提取
    "youtube-transcript", // youtube.com 字幕 → 替代：B站字幕API
    "youtube-watcher", // youtube.com → 替代：B站
    "yt-dlp-downloader-skill", // YouTube+Twitter下载 → 替代：you-get（B站/抖音）
    "yt-api-cli", // YouTube Data API → 替代：B站API
    "ytmusic", // YouTube Music → 替代：网易云/QQ音乐
    "pocket-casts-yt", // YouTube + Pocket Casts → 替代：小宇宙播客
    "chromecast-control", // YouTube 投屏 → 替代：DLNA/小米投屏
    // ── 依赖 OpenAI API（被墙） ──
    "oracle", // 默认 ChatGPT browser / OpenAI API
    "openai-image-gen", // OpenAI DALL-E API
    "openai-whisper-api", // OpenAI Whisper API（≠openai-whisper本地版！）
    "summarize", // 默认 Google Gemini / OpenAI
    "coding-agent", // 需要 Codex/Claude/OpenCode 外部AI API
    "openai-docs", // developers.openai.com MCP → 无需替代（文档类）
    "openai-tts", // OpenAI TTS API → 替代：火山引擎TTS/讯飞
    "openai-tts-python", // OpenAI TTS Python → 替代：火山引擎TTS
    "gpt", // api.openai.com → 替代：国内大模型API
    "relay-to-agent", // OpenAI API → 替代：国内大模型
    "swarm", // OpenAI/Gemini API → 替代：国内大模型
    "codex-sub-agents", // OpenAI Codex CLI → 无直接替代
    // ── 依赖 Spotify（中国不可用） ──
    "spotify-player", // Spotify API → 替代：网易云音乐
    "spotify", // Spotify web → 替代：网易云/QQ音乐
    "spotify-cli", // Spotify API → 替代：网易云CLI
    "spotify-history", // Spotify API → 替代：网易云听歌记录
    "spotify-applescript", // Spotify macOS → 替代：Apple Music/网易云
    "home-music", // Spotify desktop → 替代：网易云桌面版
    "ahmed", // Spotify → 替代：网易云音乐
    // ── 依赖 X/Twitter（被墙） ──
    "bird", // X/Twitter GraphQL API
    "x-articles", // x.com 浏览器 → 替代：微博长文
    "x-kindle", // fxtwitter API → 替代：微博正文提取
    "tweet-writer", // X/Twitter → 替代：微博发布
    "typefully", // X 自动化 → 替代：微博自动化
    // "content-draft-generator", // 已修复：去掉 fxtwitter 依赖
    // "swipe-file-generator", // 已修复：去掉 fxtwitter 依赖
    "daily-review", // Bird CLI (X/Twitter) → 替代：微博日报
    // ── 依赖 Reddit（被墙） ──
    "reddit", // reddit.com API → 替代：V2EX/知乎API
    "reddit-cli", // reddit.com cookies → 替代：V2EX/知乎
    "reddit-scraper", // old.reddit.com → 替代：V2EX/知乎爬虫
    "search-reddit", // reddit.com → 替代：知乎搜索
    "last30days", // reddit.com + x.com → 替代：知乎/V2EX热帖
    "last30days-lite", // reddit.com → 替代：知乎/V2EX
    // ── 依赖其他被墙海外服务 ──
    "sag", // ElevenLabs TTS API — 不是本地TTS！
    "voice-call", // Twilio/Telnyx/Plivo VoIP
    "gifgrep", // Tenor/Giphy GIF搜索
    "food-order", // Foodora 欧洲外卖
    "ordercli", // Foodora 封装
    "eightctl", // Eight Sleep 美国智能床垫IoT
    "dropbox", // Dropbox API → 替代：坚果云/阿里云盘
    "notion-skill", // Notion API（国内不稳定） → 替代：FlowUs/Wolai
    "better-notion", // Notion API → 替代：FlowUs/Wolai
    "blog-writer", // Notion → 替代：FlowUs
    // "heurist-mesh", // 经测试国内可直连 (HTTP 200)，已移除
    // "web-researcher", // 已修复：默认搜索引擎改为百度
    // ── 海外平台，国内极少使用 ──
    "slack",
    "discord",
    "wacli",
    "bluebubbles",
    "trello",
    "linear",
    "notion",
    // ── 专业小众工具（海外） ──
    "comfy",
    "homekit",
  ],

  // Skills 镜像源 (ClawdSkillsProxy 服务)
  skillsRegistry: "https://www.obplugins.cn",

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
 * 通过时区、语言、Intl locale 等信息判断
 *
 * 检测策略（按优先级）：
 * 1. 环境变量 OPENCLAWCN_REGION 强制设置
 * 2. Intl 时区检测（Asia/Shanghai, Asia/Chongqing）
 * 3. Intl locale 检测（zh-CN, zh-Hans — Windows 上比 LANG 更可靠）
 * 4. TZ 环境变量（Docker 容器内常用）
 * 5. LANG / LC_ALL 环境变量（Linux/macOS）
 */
let _cachedChinaRegion: boolean | undefined;

export function detectChinaRegion(): boolean {
  if (_cachedChinaRegion !== undefined) return _cachedChinaRegion;
  _cachedChinaRegion = _detectChinaRegionImpl();
  return _cachedChinaRegion;
}

/** @internal Reset cache — only for unit tests. */
export function _resetChinaRegionCache(): void {
  _cachedChinaRegion = undefined;
}

function _detectChinaRegionImpl(): boolean {
  // 检查环境变量强制设置
  if (process.env.OPENCLAWCN_REGION === "cn") return true;
  if (process.env.OPENCLAWCN_REGION === "global") return false;

  // 检查时区
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    const timezone = resolved.timeZone;
    if (
      timezone.startsWith("Asia/Shanghai") ||
      timezone.startsWith("Asia/Chongqing") ||
      timezone === "Asia/Urumqi"
    ) {
      return true;
    }
    // Windows 上 Intl locale 比 LANG 更可靠（Windows 通常没有 LANG 环境变量）
    const locale = resolved.locale;
    if (locale.startsWith("zh-CN") || locale.startsWith("zh-Hans")) {
      return true;
    }
  } catch {
    // ignore
  }

  // 检查 TZ 环境变量（Docker 容器内常用，宿主机是中国时区但容器默认 UTC 时需要手动设置）
  const tz = process.env.TZ || "";
  if (tz === "Asia/Shanghai" || tz === "Asia/Chongqing" || tz === "Asia/Urumqi" || tz === "CST-8") {
    return true;
  }

  // 检查语言环境（Linux/macOS）
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

/**
 * 检查技能是否应该在中国区隐藏
 * 用于过滤国内不可用或已废弃的技能（如 clawdhub）
 */
export function isSkillHiddenInCn(skillId: string): boolean {
  return CN_REGION_CONFIG.hiddenSkills.includes(skillId.toLowerCase());
}

/**
 * 检查技能是否在中国区降级（已安装但不自动注入LLM上下文）
 * 这些技能依赖海外服务（OpenAI、Google等），大多数中国用户无法直接使用。
 * 注意：macOS专属技能不在此列——中国Mac用户可正常使用。
 */
export function isSkillDeprioritizedInCn(skillId: string): boolean {
  return CN_REGION_CONFIG.cnDeprioritizedSkills.includes(skillId.toLowerCase());
}

// ============================================================================
// 默认安全配置 (Default Security Config for CN)
// ============================================================================

export const CN_DEFAULT_SECURITY_CONFIG = {
  sandbox: {
    mode: "off" as const, // 不使用沙箱，最大能力释放
    scope: "agent" as const, // 按 agent 隔离（用户手动开启沙箱时生效）
    workspaceAccess: "rw" as const,
  },
  tools: {
    write: {
      allowDelete: true, // 最大权限：允许删除文件（配合 exec security:"full" 全放开）
    },
    exec: {
      security: "full" as const, // 全权限模式，所有命令可执行
      ask: "off" as const, // 不询问，直接执行
      allowlist: [
        // Windows 常用
        "notepad",
        "explorer",
        "calc",
        "mspaint",
        "code",
        // Windows shell（最大权限模式：用户要求全放开）
        "cmd",
        "powershell",
        "pwsh",
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
      profile: "openclawcn",
      allowHostBrowser: true, // 允许 AI 使用宿主浏览器（最大能力释放）
    },
  },
};
