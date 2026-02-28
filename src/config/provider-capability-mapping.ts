/**
 * Provider-Model-Capability 映射
 *
 * 定义了每个提供商的模型及其支持的能力
 * 用于模型配置页面的智能检测和能力展示
 */

import type { ModelCapabilityCard, CapabilityKey } from "../dispatch/capability-registry.js";

/** 能力类型
 *
 * v1 core: text, image-understanding, image-generation, video, embedding
 * v1 extended: video-generation (used in static model defs)
 * v2 storage keys: code, videoGen, audio, tts, toolCall (written by auto-assign via V2_KEY_TO_LEGACY)
 */
export type Capability =
  | "text" // 文字对话
  | "image-understanding" // 图片理解
  | "image-generation" // 图片生成
  | "image-editing" // 图像编辑（需提供原图）
  | "video" // 视频理解
  | "video-generation" // 视频生成 (v1 extended)
  | "embedding" // Embedding (向量化)
  // v2 storage keys — config 中保存的 v2 能力绑定
  | "code" // 代码生成
  | "videoGen" // 视频生成 (v2 alias, 与 video-generation 等价)
  | "audio" // 语音识别
  | "tts" // 语音合成
  | "toolCall"; // 工具调用

/** 模型定义 */
export interface ModelDef {
  /** 模型 ID (API 调用时使用) */
  modelId: string;
  /** 模型显示名称 */
  modelName: string;
  /** 支持的能力列表 */
  capabilities: Capability[];
  /** 定价类型 */
  pricing: {
    type: "free" | "paid";
    /** 定价详情 (可选) */
    details?: string;
  };
  /** 快速测试端点 (可选,用于验证 API Key) */
  testEndpoint?: string;
  /** 上下文窗口大小 (可选) */
  contextWindow?: number;
  /** 最大输出 tokens (可选) */
  maxTokens?: number;
}

/** Provider 分组 */
export type ProviderGroup =
  | "cn-codeplan" // 代码助手 (Coding Plan)
  | "cn-recommended" // 国内主流推荐
  | "cn-more" // 更多国内服务
  | "international" // 国际服务
  | "local-custom"; // 本地模型 & 自定义

/** Provider 分组元数据 */
export interface ProviderGroupMeta {
  id: ProviderGroup;
  name: string;
  description: string;
  icon: string;
  defaultExpanded: boolean;
  order: number;
}

/** 所有 Provider 分组定义 */
export const PROVIDER_GROUPS: ProviderGroupMeta[] = [
  {
    id: "cn-codeplan",
    name: "代码助手 (Coding Plan)",
    description: "代码专用模型，编程体验最佳",
    icon: "🔥",
    defaultExpanded: true,
    order: -1,
  },
  {
    id: "cn-recommended",
    name: "国内主流推荐",
    description: "推荐优先配置，速度快、稳定",
    icon: "⭐",
    defaultExpanded: true,
    order: 0,
  },
  {
    id: "cn-more",
    name: "更多国内服务",
    description: "更多国内大模型平台",
    icon: "🇨🇳",
    defaultExpanded: false,
    order: 1,
  },
  {
    id: "international",
    name: "国际服务",
    description: "需要科学上网",
    icon: "🌐",
    defaultExpanded: false,
    order: 2,
  },
  {
    id: "local-custom",
    name: "本地模型 & 自定义",
    description: "本地运行或自定义端点",
    icon: "🔧",
    defaultExpanded: false,
    order: 3,
  },
];

/** Provider-Model-Capability 映射 */
export interface ProviderCapabilityMapping {
  /** Provider ID */
  providerId: string;
  /** 显示名称 */
  name: string;
  /** 图标 (emoji) */
  icon: string;
  /** 所属分组 */
  group: ProviderGroup;
  /** 一句话标语 */
  tagline?: string;
  /** 获取 API Key 的链接 */
  apiKeyUrl?: string;
  /** 获取 API Key 的步骤指引 */
  apiKeyGuide?: string[];
  /** 该 Provider 的所有模型 */
  models: ModelDef[];
  /** 是否需要用户输入 Base URL（如 Ollama、OpenAI 兼容等本地/自定义服务） */
  needsBaseUrl?: boolean;
  /** 默认 Base URL（用于预填输入框） */
  defaultBaseUrl?: string;
  /** API Key 是否可选（如 Ollama 本地不需要 Key） */
  apiKeyOptional?: boolean;
}

/**
 * 所有提供商的 Capability 映射
 * 基于 setup-page-components.ts 的完整列表
 */
export const PROVIDER_CAPABILITY_MAPPINGS: Record<string, ProviderCapabilityMapping> = {
  /* ===========================================
     国内主流推荐 (优先展示)
     =========================================== */

  /* ===========================================
     代码助手 (Coding Plan) - 最优先展示
     =========================================== */

  "kimi-coding": {
    providerId: "kimi-coding",
    name: "Kimi Code",
    icon: "💻",
    group: "cn-codeplan",
    tagline: "聊天+编程+图片理解 · 262K 超长上下文 · 极速",
    apiKeyUrl: "https://www.kimi.com/code/docs/",
    apiKeyGuide: ["访问 Kimi Code 文档页面", "按指引注册并获取 API Key", "复制 API Key"],
    models: [
      {
        modelId: "kimi-for-coding",
        modelName: "Kimi for Coding",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid", details: "代码+文字+图片理解,262K 超长上下文" },
        contextWindow: 262144,
        maxTokens: 8192,
      },
    ],
  },

  "aliyun-codeplan": {
    providerId: "aliyun-codeplan",
    name: "Aliyun Code",
    icon: "☁️",
    group: "cn-codeplan",
    tagline: "模型聚合 · 一个 Key 调多款顶级代码模型",
    apiKeyUrl:
      "https://www.aliyun.com/benefit/ai/aistar?userCode=xsngby7y&clubBiz=subTask..12414078..10263..",
    apiKeyGuide: ["免费注册阿里云 AI Star", "开通 Coding Plan 服务", "创建 API Key 并复制"],
    models: [
      {
        modelId: "qwen3.5-plus",
        modelName: "Qwen3.5-Plus",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid", details: "推荐 · 图片理解" },
        contextWindow: 131072,
        maxTokens: 8192,
      },
      {
        modelId: "kimi-k2.5",
        modelName: "Kimi-K2.5",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid", details: "图片理解" },
        contextWindow: 131072,
        maxTokens: 8192,
      },
      {
        modelId: "glm-5",
        modelName: "GLM-5",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 128000,
        maxTokens: 8192,
      },
      {
        modelId: "MiniMax-M2.5",
        modelName: "MiniMax-M2.5",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        modelId: "qwen3-coder-plus",
        modelName: "Qwen3-Coder-Plus",
        capabilities: ["text"],
        pricing: { type: "paid", details: "Coding Plan 代码专用" },
        contextWindow: 131072,
        maxTokens: 8192,
      },
      {
        modelId: "qwen3-coder-next",
        modelName: "Qwen3-Coder-Next",
        capabilities: ["text"],
        pricing: { type: "paid", details: "下一代预览" },
        contextWindow: 131072,
        maxTokens: 8192,
      },
    ],
  },

  "glm-codeplan": {
    providerId: "glm-codeplan",
    name: "GLM Code",
    icon: "🧠",
    group: "cn-codeplan",
    tagline: "GLM-5 · 智谱 Coding Plan",
    apiKeyUrl: "https://www.bigmodel.cn/glm-coding?ic=ZPADWSX0SI",
    apiKeyGuide: [
      "访问 bigmodel.cn/glm-coding 注册",
      "开通 Coding Plan 服务",
      "创建 API Key 并复制",
    ],
    models: [
      {
        modelId: "glm-5",
        modelName: "GLM-5",
        capabilities: ["text"],
        pricing: { type: "paid", details: "Coding Plan 代码专用" },
        contextWindow: 128000,
        maxTokens: 8192,
      },
      {
        modelId: "glm-4.7",
        modelName: "GLM-4.7",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 128000,
        maxTokens: 4096,
      },
    ],
  },

  "minimax-codeplan": {
    providerId: "minimax-codeplan",
    name: "MiniMax Code",
    icon: "⚡",
    group: "cn-codeplan",
    tagline: "MiniMax-M2.5 · Coding Plan 订阅",
    apiKeyUrl: "https://platform.minimaxi.com/subscribe/coding-plan?code=I5REQrAnfL&source=link",
    apiKeyGuide: ["访问 MiniMax 订阅 Coding Plan", "获取专用 API Key", "复制 API Key"],
    models: [
      {
        modelId: "MiniMax-M2.5",
        modelName: "MiniMax-M2.5",
        capabilities: ["text"],
        pricing: { type: "paid", details: "Coding Plan 订阅专属" },
        contextWindow: 200000,
        maxTokens: 8192,
      },
    ],
  },

  /* ===========================================
     国内主流推荐 (优先展示)
     =========================================== */

  "aliyun-bailian": {
    providerId: "aliyun-bailian",
    name: "通义千问",
    icon: "☁️",
    group: "cn-recommended",
    tagline: "阿里出品 · 送100万Token · 多模态",
    apiKeyUrl:
      "https://www.aliyun.com/daily-act/ecs/activity_selection?source=5176.29345612&userCode=xsngby7y",
    apiKeyGuide: ["免费注册阿里云，领取额度", "进入百炼控制台开通服务", "创建 API Key 并复制"],
    models: [
      // 文字对话模型
      {
        modelId: "qwen-plus",
        modelName: "Qwen-Plus",
        capabilities: ["text"],
        pricing: { type: "paid", details: "送100万Token" },
        contextWindow: 32768,
        maxTokens: 8192,
      },
      {
        modelId: "qwen-max",
        modelName: "Qwen-Max",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 32768,
        maxTokens: 8192,
      },
      // 图片理解模型
      {
        modelId: "qwen-vl-plus",
        modelName: "Qwen-VL-Plus",
        capabilities: ["image-understanding"],
        pricing: { type: "paid" },
      },
      {
        modelId: "qwen-vl-max",
        modelName: "Qwen-VL-Max",
        capabilities: ["image-understanding"],
        pricing: { type: "paid" },
      },
      // Embedding 模型
      {
        modelId: "text-embedding-v3",
        modelName: "Text-Embedding-V3",
        capabilities: ["embedding"],
        pricing: { type: "paid" },
        testEndpoint: "/embeddings",
      },
    ],
  },

  "volcengine-ark": {
    providerId: "volcengine-ark",
    name: "豆包",
    icon: "🔥",
    group: "cn-recommended",
    tagline: "字节出品 · 响应极快 · 性价比高 · 支持语音",
    apiKeyUrl: "https://console.volcengine.com/ark/",
    apiKeyGuide: [
      "访问火山方舟控制台注册并登录",
      "开通 Ark 模型服务",
      "创建 API Key 并复制",
      "语音服务 (ASR/TTS) 请切换到「语音服务」Tab 单独配置",
    ],
    models: [
      // 文字对话 + 图片理解模型（豆包 1.8 支持 text/image/video）
      {
        modelId: "doubao-seed-1-8-251228",
        modelName: "豆包 1.8",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid", details: "最新旗舰 · 响应极快" },
        contextWindow: 256000,
        maxTokens: 32768,
      },
      {
        modelId: "doubao-seed-1-6-251015",
        modelName: "豆包 1.6",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid" },
        contextWindow: 256000,
        maxTokens: 32768,
      },
      {
        modelId: "doubao-seed-1-6-lite-251015",
        modelName: "豆包 1.6 Lite",
        capabilities: ["text"],
        pricing: { type: "paid" },
      },
      {
        modelId: "doubao-seed-1-6-flash-250828",
        modelName: "豆包 1.6 Flash",
        capabilities: ["text"],
        pricing: { type: "paid" },
      },
    ],
  },

  /* ===========================================
     更多国内服务
     =========================================== */

  siliconflow: {
    providerId: "siliconflow",
    name: "硅基流动",
    icon: "🔮",
    group: "cn-recommended",
    tagline: "向量记忆必需 · 免费模型多 · 需实名注册",
    apiKeyUrl: "https://cloud.siliconflow.cn/i/uXXX7IEi",
    apiKeyGuide: [
      "访问硅基流动注册，免费领取额度",
      "完成实名认证 (需身份证)",
      "进入控制台 → API 密钥",
      "创建新密钥并复制",
    ],
    models: [
      // 文字对话模型 (Kimi-K2.5 Pro 首选)
      {
        modelId: "Pro/moonshotai/Kimi-K2.5",
        modelName: "Kimi-K2.5 (Pro)",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 131072,
        maxTokens: 8192,
      },
      {
        modelId: "deepseek-ai/DeepSeek-V3",
        modelName: "DeepSeek-V3",
        capabilities: ["text"],
        pricing: { type: "paid", details: "性价比之王" },
        contextWindow: 65536,
        maxTokens: 8192,
      },
      {
        modelId: "Qwen/Qwen2.5-7B-Instruct",
        modelName: "Qwen2.5-7B-Instruct (免费)",
        capabilities: ["text"],
        pricing: { type: "free" },
        contextWindow: 32768,
        maxTokens: 8192,
      },
      // 图片理解模型
      {
        modelId: "Qwen/Qwen-VL-Plus",
        modelName: "Qwen-VL-Plus",
        capabilities: ["image-understanding"],
        pricing: { type: "paid" },
      },
      {
        modelId: "Qwen/Qwen2-VL-72B-Instruct",
        modelName: "Qwen2-VL-72B",
        capabilities: ["image-understanding"],
        pricing: { type: "paid" },
      },
      // 图片生成模型
      {
        modelId: "black-forest-labs/FLUX.1-schnell",
        modelName: "FLUX.1-schnell",
        capabilities: ["image-generation"],
        pricing: { type: "free" },
      },
      {
        modelId: "stabilityai/stable-diffusion-3-5-large",
        modelName: "SD 3.5 Large",
        capabilities: ["image-generation"],
        pricing: { type: "paid" },
      },
      {
        modelId: "Qwen/Qwen-Image",
        modelName: "Qwen-Image (通义生图)",
        capabilities: ["image-generation"],
        pricing: { type: "paid" },
      },
      {
        modelId: "Qwen/Qwen-Image-Edit",
        modelName: "Qwen-Image-Edit (图像编辑，需提供原图)",
        capabilities: ["image-editing"],
        pricing: { type: "paid" },
      },
      {
        modelId: "Kwai-Kolors/Kolors",
        modelName: "Kolors (可图)",
        capabilities: ["image-generation"],
        pricing: { type: "free" },
      },
      // 视频理解模型
      {
        modelId: "Qwen/Qwen2-VL-7B-Instruct",
        modelName: "Qwen2-VL-7B",
        capabilities: ["video"],
        pricing: { type: "free" },
      },
      // 视频生成模型
      {
        modelId: "Wan-AI/Wan2.2-T2V-A14B",
        modelName: "Wan2.2 文生视频 14B",
        capabilities: ["video-generation"],
        pricing: { type: "paid" },
      },
      {
        modelId: "Wan-AI/Wan2.2-I2V-A14B",
        modelName: "Wan2.2 图生视频 14B",
        capabilities: ["video-generation"],
        pricing: { type: "paid" },
      },
      {
        modelId: "Pro/THUDM/CogVideoX-5B",
        modelName: "CogVideoX-5B (视频)",
        capabilities: ["video-generation"],
        pricing: { type: "paid" },
      },
      // Embedding 模型 (必需!)
      {
        modelId: "BAAI/bge-m3",
        modelName: "BGE-M3",
        capabilities: ["embedding"],
        pricing: { type: "free", details: "智能推荐必需" },
        testEndpoint: "/embeddings",
      },
    ],
  },

  deepseek: {
    providerId: "deepseek",
    name: "DeepSeek",
    icon: "🚀",
    group: "cn-more",
    tagline: "性价比之王 · 代码能力强",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    apiKeyGuide: ["访问 platform.deepseek.com 注册", "进入 API Keys 页面", "创建密钥并复制"],
    models: [
      {
        modelId: "deepseek-chat",
        modelName: "DeepSeek-Chat",
        capabilities: ["text"],
        pricing: { type: "paid", details: "性价比极高" },
        contextWindow: 64000,
        maxTokens: 4096,
      },
      {
        modelId: "deepseek-coder",
        modelName: "DeepSeek-Coder",
        capabilities: ["text"],
        pricing: { type: "paid", details: "代码专用" },
        contextWindow: 16000,
        maxTokens: 4096,
      },
    ],
  },

  glm: {
    providerId: "glm",
    name: "智谱GLM",
    icon: "🧠",
    group: "cn-more",
    tagline: "GLM-4 系列 · 永久免费额度",
    apiKeyUrl: "https://www.bigmodel.cn/glm-coding?ic=ZPADWSX0SI",
    apiKeyGuide: [
      "访问 bigmodel.cn/glm-coding 注册，免费送2000万Token",
      "进入用户中心 → API Keys",
      "创建密钥并复制",
    ],
    models: [
      // 文字对话模型
      {
        modelId: "glm-5",
        modelName: "GLM-5",
        capabilities: ["text"],
        pricing: { type: "paid" },
      },
      {
        modelId: "glm-5-code",
        modelName: "GLM-5-Code",
        capabilities: ["text"],
        pricing: { type: "paid" },
      },
      {
        modelId: "glm-4.7-flash",
        modelName: "GLM-4.7-Flash",
        capabilities: ["text"],
        pricing: { type: "free", details: "完全免费" },
      },
      {
        modelId: "glm-4.7",
        modelName: "GLM-4.7",
        capabilities: ["text"],
        pricing: { type: "paid" },
      },
      {
        modelId: "glm-4.6",
        modelName: "GLM-4.6",
        capabilities: ["text"],
        pricing: { type: "paid" },
      },
      {
        modelId: "glm-4.5",
        modelName: "GLM-4.5",
        capabilities: ["text"],
        pricing: { type: "paid" },
      },
      {
        modelId: "glm-4.5-flash",
        modelName: "GLM-4.5-Flash",
        capabilities: ["text"],
        pricing: { type: "free", details: "免费" },
      },
      {
        modelId: "glm-4.5-air",
        modelName: "GLM-4.5-Air",
        capabilities: ["text"],
        pricing: { type: "paid" },
      },
      {
        modelId: "glm-4-plus",
        modelName: "GLM-4-Plus",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 128000,
        maxTokens: 4096,
      },
      {
        modelId: "glm-4-flash",
        modelName: "GLM-4-Flash",
        capabilities: ["text"],
        pricing: { type: "free", details: "免费" },
        contextWindow: 128000,
        maxTokens: 4096,
      },
      // 图片理解模型
      {
        modelId: "glm-4.6v",
        modelName: "GLM-4.6V",
        capabilities: ["image-understanding"],
        pricing: { type: "paid" },
      },
      {
        modelId: "glm-4.5v",
        modelName: "GLM-4.5V",
        capabilities: ["image-understanding"],
        pricing: { type: "paid" },
      },
      {
        modelId: "glm-4v-plus",
        modelName: "GLM-4V-Plus",
        capabilities: ["image-understanding"],
        pricing: { type: "paid" },
      },
      // Embedding 模型
      {
        modelId: "embedding-3",
        modelName: "Embedding-3",
        capabilities: ["embedding"],
        pricing: { type: "paid" },
        testEndpoint: "/embeddings",
      },
    ],
  },

  moonshot: {
    providerId: "moonshot",
    name: "Kimi (月之暗面)",
    icon: "🌙",
    group: "cn-more",
    tagline: "长上下文之王 · 最高 128K",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    apiKeyGuide: ["访问 platform.moonshot.cn 注册", "进入控制台 → API 密钥", "创建密钥并复制"],
    models: [
      {
        modelId: "moonshot-v1-8k",
        modelName: "Moonshot-v1-8K",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 8000,
        maxTokens: 4096,
      },
      {
        modelId: "moonshot-v1-32k",
        modelName: "Moonshot-v1-32K",
        capabilities: ["text"],
        pricing: { type: "paid", details: "长上下文" },
        contextWindow: 32000,
        maxTokens: 4096,
      },
      {
        modelId: "moonshot-v1-128k",
        modelName: "Moonshot-v1-128K",
        capabilities: ["text"],
        pricing: { type: "paid", details: "超长上下文" },
        contextWindow: 128000,
        maxTokens: 4096,
      },
    ],
  },

  minimax: {
    providerId: "minimax",
    name: "MiniMax",
    icon: "⚡",
    group: "cn-more",
    tagline: "多模态 · 文字+图片+视频",
    apiKeyUrl: "https://platform.minimaxi.com/subscribe/coding-plan?code=I5REQrAnfL&source=link",
    apiKeyGuide: [
      "访问 MiniMax 开放平台注册，领取免费额度",
      "进入用户中心 → 接口密钥",
      "创建密钥并复制",
    ],
    models: [
      // 文字对话模型
      {
        modelId: "MiniMax-M2.5",
        modelName: "MiniMax-M2.5",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        modelId: "MiniMax-M2.5-highspeed",
        modelName: "MiniMax-M2.5-Highspeed",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        modelId: "MiniMax-M2.1",
        modelName: "MiniMax-M2.1",
        capabilities: ["text"],
        pricing: { type: "paid", details: "Agent/代码专家" },
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        modelId: "MiniMax-M2.1-highspeed",
        modelName: "MiniMax-M2.1-Highspeed",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        modelId: "MiniMax-M2",
        modelName: "MiniMax-M2",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 200000,
        maxTokens: 8192,
      },
      // 图片理解模型
      {
        modelId: "MiniMax-VL-01",
        modelName: "MiniMax-VL-01",
        capabilities: ["image-understanding"],
        pricing: { type: "paid" },
      },
      // 视频理解模型
      {
        modelId: "MiniMax-M2.1-Video",
        modelName: "MiniMax-M2.1-Video",
        capabilities: ["video"],
        pricing: { type: "paid" },
      },
      // Embedding 模型
      {
        modelId: "MiniMax-Text-Embedding-v1",
        modelName: "Text-Embedding-v1",
        capabilities: ["embedding"],
        pricing: { type: "paid" },
        testEndpoint: "/embeddings",
      },
    ],
  },

  "tencent-hunyuan": {
    providerId: "tencent-hunyuan",
    name: "腾讯混元",
    icon: "💫",
    group: "cn-more",
    tagline: "腾讯大模型 · 多模态能力",
    apiKeyUrl: "https://cloud.tencent.com/product/hunyuan",
    apiKeyGuide: ["访问腾讯云控制台注册", "开通混元大模型服务", "创建 API Key 并复制"],
    models: [
      // 文字对话模型
      {
        modelId: "hunyuan-lite",
        modelName: "Hunyuan-Lite",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 256000,
        maxTokens: 6000,
      },
      {
        modelId: "hunyuan-pro",
        modelName: "Hunyuan-Pro",
        capabilities: ["text"],
        pricing: { type: "paid" },
        contextWindow: 32000,
        maxTokens: 4000,
      },
      // 图片理解模型
      {
        modelId: "hunyuan-vision",
        modelName: "Hunyuan-Vision",
        capabilities: ["image-understanding"],
        pricing: { type: "paid" },
      },
    ],
  },

  "ant-ling": {
    providerId: "ant-ling",
    name: "蚂蚁百灵",
    icon: "🐜",
    group: "cn-recommended",
    tagline: "记忆提取必需 · 每日免费50万Token · 注册即用",
    apiKeyUrl: "https://ling.tbox.cn/open",
    apiKeyGuide: [
      "访问 ling.tbox.cn/open 注册账号",
      "进入开放平台获取 API Key",
      "每日免费 50 万 tokens，记忆提取自动使用",
    ],
    models: [
      {
        modelId: "ling-1t",
        modelName: "Ling-1T",
        capabilities: ["text"],
        pricing: { type: "free", details: "每日免费50万Token" },
      },
      {
        modelId: "ring-1t",
        modelName: "Ring-1T",
        capabilities: ["text"],
        pricing: { type: "free", details: "每日免费50万Token" },
      },
      {
        modelId: "ming-flash-omni",
        modelName: "Ming-Flash-Omni",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "free", details: "多模态 · 每日免费50万Token" },
      },
    ],
  },

  "meituan-longcat": {
    providerId: "meituan-longcat",
    name: "美团LongCat",
    icon: "🐱",
    group: "cn-recommended",
    tagline: "记忆提取必需 · 每日免费50万Token · 128K上下文",
    apiKeyUrl:
      "https://longcat.chat/login?countrycode=86&countryname=China&callback=https%3A%2F%2Flongcat.chat%2Fplatform",
    apiKeyGuide: [
      "访问 longcat.chat 注册账号",
      "进入平台获取 API Key",
      "每日免费 50 万 tokens，记忆提取自动使用",
    ],
    models: [
      {
        modelId: "longcat-flash-chat",
        modelName: "LongCat Flash",
        capabilities: ["text"],
        pricing: { type: "free", details: "每日免费50万Token" },
        contextWindow: 131072,
        maxTokens: 8192,
      },
    ],
  },

  /* ===========================================
     国际服务 (需科学上网)
     =========================================== */

  openai: {
    providerId: "openai",
    name: "OpenAI",
    icon: "🤖",
    group: "international",
    tagline: "GPT-4o · DALL-E 3 · 全能",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    apiKeyGuide: ["访问 platform.openai.com 注册", "进入 API Keys 页面", "创建密钥并复制"],
    models: [
      // 文字对话模型
      {
        modelId: "gpt-4o",
        modelName: "GPT-4o",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid" },
        contextWindow: 128000,
        maxTokens: 16384,
      },
      {
        modelId: "gpt-4o-mini",
        modelName: "GPT-4o-Mini",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid", details: "便宜" },
        contextWindow: 128000,
        maxTokens: 16384,
      },
      {
        modelId: "gpt-4-turbo",
        modelName: "GPT-4-Turbo",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid" },
        contextWindow: 128000,
        maxTokens: 4096,
      },
      // 图片生成模型
      {
        modelId: "dall-e-3",
        modelName: "DALL-E 3",
        capabilities: ["image-generation"],
        pricing: { type: "paid" },
      },
      // Embedding 模型
      {
        modelId: "text-embedding-3-large",
        modelName: "Text-Embedding-3-Large",
        capabilities: ["embedding"],
        pricing: { type: "paid" },
        testEndpoint: "/embeddings",
      },
    ],
  },

  anthropic: {
    providerId: "anthropic",
    name: "Anthropic Claude",
    icon: "🧬",
    group: "international",
    tagline: "Claude 4 系列 · 编程最强",
    apiKeyUrl: "https://console.anthropic.com/account/keys",
    apiKeyGuide: ["访问 console.anthropic.com 注册", "进入 API Keys 页面", "创建密钥并复制"],
    models: [
      {
        modelId: "claude-sonnet-4-20250514",
        modelName: "Claude Sonnet 4",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid" },
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        modelId: "claude-opus-4-20250514",
        modelName: "Claude Opus 4",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid", details: "最强" },
        contextWindow: 200000,
        maxTokens: 8192,
      },
    ],
  },

  google: {
    providerId: "google",
    name: "Google Gemini",
    icon: "🔷",
    group: "international",
    tagline: "Gemini 2.5 / 3 · 免费额度充足",
    apiKeyUrl: "https://aistudio.google.com/apikey",
    apiKeyGuide: ["访问 Google AI Studio", "登录 Google 账号", "创建 API Key 并复制"],
    models: [
      // 文字对话模型
      {
        modelId: "gemini-2.5-flash",
        modelName: "Gemini 2.5 Flash",
        capabilities: ["text"],
        pricing: { type: "free", details: "免费额度充足" },
        contextWindow: 1000000,
        maxTokens: 8192,
      },
      {
        modelId: "gemini-2.5-pro",
        modelName: "Gemini 2.5 Pro",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid" },
        contextWindow: 2000000,
        maxTokens: 8192,
      },
      // Embedding 模型
      {
        modelId: "text-embedding-004",
        modelName: "Text-Embedding-004",
        capabilities: ["embedding"],
        pricing: { type: "paid" },
        testEndpoint: "/embeddings",
      },
    ],
  },

  nvidia: {
    providerId: "nvidia",
    name: "NVIDIA NIM",
    icon: "💚",
    group: "international",
    tagline: "高性能推理 · 有免费额度",
    apiKeyUrl: "https://build.nvidia.com/explore/discover",
    apiKeyGuide: ["访问 build.nvidia.com 注册", "获取 API Key"],
    models: [
      {
        modelId: "nvidia/llama-3.1-nemotron-70b-instruct",
        modelName: "Llama 3.1 Nemotron 70B",
        capabilities: ["text"],
        pricing: { type: "paid", details: "有免费额度" },
        contextWindow: 128000,
        maxTokens: 4096,
      },
    ],
  },

  openrouter: {
    providerId: "openrouter",
    name: "OpenRouter",
    icon: "🔀",
    group: "international",
    tagline: "聚合路由 · 数百模型 · 按量计费",
    apiKeyUrl: "https://openrouter.ai/keys",
    apiKeyGuide: ["访问 openrouter.ai 注册账号", "进入 Keys 页面创建 API Key"],
    models: [
      {
        modelId: "openrouter/auto",
        modelName: "Auto (智能路由)",
        capabilities: ["text"],
        pricing: { type: "paid", details: "按量计费" },
        contextWindow: 128000,
        maxTokens: 4096,
      },
      {
        modelId: "anthropic/claude-sonnet-4",
        modelName: "Claude Sonnet 4",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid", details: "$3/$15 per 1M" },
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        modelId: "google/gemini-2.5-flash-preview",
        modelName: "Gemini 2.5 Flash",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid", details: "低价" },
        contextWindow: 1000000,
        maxTokens: 8192,
      },
      {
        modelId: "openai/gpt-4o",
        modelName: "GPT-4o",
        capabilities: ["text", "image-understanding"],
        pricing: { type: "paid", details: "$2.5/$10 per 1M" },
        contextWindow: 128000,
        maxTokens: 4096,
      },
      {
        modelId: "deepseek/deepseek-chat-v3-0324",
        modelName: "DeepSeek V3",
        capabilities: ["text"],
        pricing: { type: "paid", details: "低价" },
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ],
  },

  /* ===========================================
     本地模型 & 自定义
     =========================================== */

  ollama: {
    providerId: "ollama",
    name: "Ollama",
    icon: "🦙",
    group: "local-custom",
    tagline: "本地运行 · 完全免费 · 隐私安全",
    apiKeyUrl: "https://ollama.com/download",
    apiKeyGuide: ["下载并安装 Ollama", "运行 ollama serve 启动服务", "API Key 留空即可"],
    needsBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434/v1",
    apiKeyOptional: true,
    models: [
      // 注意: Ollama 的模型列表需要动态检测
      // 这里只列出常见模型作为示例
      {
        modelId: "llama3.3:latest",
        modelName: "Llama 3.3",
        capabilities: ["text"],
        pricing: { type: "free", details: "本地运行" },
      },
      {
        modelId: "qwen2.5:latest",
        modelName: "Qwen 2.5",
        capabilities: ["text"],
        pricing: { type: "free", details: "本地运行" },
      },
      {
        modelId: "llava:latest",
        modelName: "LLaVA",
        capabilities: ["image-understanding"],
        pricing: { type: "free", details: "本地运行" },
      },
      {
        modelId: "nomic-embed-text:latest",
        modelName: "Nomic Embed Text",
        capabilities: ["embedding"],
        pricing: { type: "free", details: "本地运行" },
        testEndpoint: "/embeddings",
      },
    ],
  },

  "openai-compatible": {
    providerId: "openai-compatible",
    name: "OpenAI 兼容",
    icon: "🔌",
    group: "local-custom",
    tagline: "兼容 OpenAI 格式的任意端点",
    apiKeyUrl: undefined,
    apiKeyGuide: [
      "获取目标服务的 API 地址和密钥",
      "填入 Base URL 和 API Key",
      "模型列表将自动检测",
    ],
    needsBaseUrl: true,
    defaultBaseUrl: "",
    models: [
      // OpenAI 兼容服务的模型列表需要动态检测
      // 这里不提供预定义模型
    ],
  },
};

/**
 * 获取某个提供商的 Capability 映射
 */
export function getProviderCapabilityMapping(
  providerId: string,
): ProviderCapabilityMapping | undefined {
  return PROVIDER_CAPABILITY_MAPPINGS[providerId];
}

// ============================================================================
// v2 Registry Bridge — connects v2 CapabilityRegistry to v1 static data
// ============================================================================

/** v2 (CapabilityKey) → v1 (Capability) mapping for the 5 core + video-generation keys.
 *  Keys with no v1 equivalent (audio, tts, toolCall) return undefined. */
const REGISTRY_KEY_TO_LEGACY: Record<string, Capability | undefined> = {
  text: "text",
  code: "text", // merged into text for v1
  vision: "image-understanding",
  imageGen: "image-generation",
  imageEdit: "image-editing",
  video: "video",
  videoGen: "video-generation",
  embedding: "embedding",
  audio: undefined,
  tts: undefined,
  toolCall: undefined,
};

/** v1 (Capability) → v2 (CapabilityKey[]) reverse mapping.
 *  Includes both original v1 keys and v2 storage keys that are now valid Capability values. */
const LEGACY_KEY_TO_REGISTRY: Record<string, CapabilityKey[]> = {
  // Original v1 keys
  text: ["text", "code"],
  "image-understanding": ["vision"],
  "image-generation": ["imageGen"],
  "image-editing": ["imageEdit"],
  video: ["video"],
  "video-generation": ["videoGen"],
  embedding: ["embedding"],
  // v2 storage keys (used as Capability values in config)
  code: ["code"],
  videoGen: ["videoGen"],
  audio: ["audio"],
  tts: ["tts"],
  toolCall: ["toolCall"],
};

/**
 * Map a v2 CapabilityKey to the v1 Capability string.
 * Returns undefined for keys with no v1 equivalent (audio, tts, toolCall).
 */
export function registryKeyToLegacy(key: string): Capability | undefined {
  return REGISTRY_KEY_TO_LEGACY[key];
}

/**
 * Map a v1 Capability string to one or more v2 CapabilityKey(s).
 * E.g. "text" → ["text", "code"] because both v2 keys share the v1 "text" slot.
 */
export function legacyKeyToRegistry(key: string): CapabilityKey[] {
  return LEGACY_KEY_TO_REGISTRY[key] ?? [];
}

/**
 * Convert a v2 ModelCapabilityCard to a v1 ModelDef.
 * Used when dynamically bridging registry data into the static model list.
 */
export function cardToModelDef(card: ModelCapabilityCard): ModelDef {
  const capabilities: Capability[] = [];
  const seen = new Set<Capability>();
  for (const v2Key of Object.keys(card.capabilities)) {
    const v1Key = REGISTRY_KEY_TO_LEGACY[v2Key];
    if (v1Key && !seen.has(v1Key)) {
      seen.add(v1Key);
      capabilities.push(v1Key);
    }
  }
  return {
    modelId: card.modelId,
    modelName: card.displayName,
    capabilities,
    pricing: {
      type: card.costTier === "free" ? "free" : "paid",
      details: card.tags?.join(", "),
    },
    contextWindow: card.maxContextTokens,
  };
}

// ── Registry link for dynamic delegation ──

type CardAccessor = () => readonly ModelCapabilityCard[];
let _getAllCards: CardAccessor | null = null;

/**
 * Link the capability registry so that getModelsByCapability / getProviderCapabilities
 * can delegate to live v2 data.
 *
 * Call with `null` or a no-op accessor to unlink (e.g. in tests).
 */
export function linkCapabilityRegistry(accessor: CardAccessor): void {
  _getAllCards = accessor;
}

// ── Provider ID: registry → static mapping key resolution ──

// Alias groups: matches PROVIDER_ALIAS_GROUPS in model-selection.ts
// First element is the canonical/static-mapping key.
const _STATIC_ALIAS_GROUPS: readonly string[][] = [
  ["glm", "zhipu"],
  ["aliyun-bailian", "qwen", "dashscope", "qwen-dashscope"],
  ["volcengine-ark", "doubao", "ark"],
  ["kimi-coding", "kimi-code"],
  ["zai", "z.ai", "z-ai"],
  ["opencode", "opencode-zen"],
];

// Build reverse map: alias → canonical (static mapping key)
const _aliasToStaticKey = new Map<string, string>();
for (const group of _STATIC_ALIAS_GROUPS) {
  const canonical = group[0];
  for (const alias of group) {
    _aliasToStaticKey.set(alias, canonical);
  }
}

function findStaticMappingKey(registryProviderId: string): string | undefined {
  if (PROVIDER_CAPABILITY_MAPPINGS[registryProviderId]) return registryProviderId;
  const canonical = _aliasToStaticKey.get(registryProviderId);
  if (canonical && PROVIDER_CAPABILITY_MAPPINGS[canonical]) return canonical;
  return undefined;
}

/**
 * 获取所有支持某个能力的模型
 */
export function getModelsByCapability(capability: Capability): Array<{
  providerId: string;
  providerName: string;
  providerIcon: string;
  model: ModelDef;
}> {
  type Result = { providerId: string; providerName: string; providerIcon: string; model: ModelDef };
  const results: Result[] = [];
  const seenModels = new Set<string>(); // "providerId/modelId"

  // ── Phase 1: Delegate to v2 registry if linked ──
  if (_getAllCards) {
    const cards = _getAllCards();
    // Map v1 capability to v2 keys for matching
    const v2Keys = LEGACY_KEY_TO_REGISTRY[capability] ?? [];

    for (const card of cards) {
      // Check if card has any of the matching v2 capabilities
      const hasCapability = v2Keys.some((k) => (card.capabilities[k] ?? 0) > 0);
      if (!hasCapability) continue;

      // Resolve registry provider ID to static mapping key
      const staticKey = findStaticMappingKey(card.provider);
      const mapping = staticKey ? PROVIDER_CAPABILITY_MAPPINGS[staticKey] : undefined;
      const usePid = staticKey ?? card.provider;
      const provName = mapping?.name ?? card.displayName;
      const provIcon = mapping?.icon ?? "";

      const key = `${usePid}/${card.modelId}`;
      if (seenModels.has(key)) continue;
      seenModels.add(key);

      results.push({
        providerId: usePid,
        providerName: provName,
        providerIcon: provIcon,
        model: cardToModelDef(card),
      });
    }
  }

  // ── Phase 2: Fill in from static PROVIDER_CAPABILITY_MAPPINGS ──
  for (const [providerId, mapping] of Object.entries(PROVIDER_CAPABILITY_MAPPINGS)) {
    for (const model of mapping.models) {
      if (model.capabilities.includes(capability)) {
        const key = `${providerId}/${model.modelId}`;
        if (seenModels.has(key)) continue;
        seenModels.add(key);
        results.push({
          providerId,
          providerName: mapping.name,
          providerIcon: mapping.icon,
          model,
        });
      }
    }
  }

  return results;
}

/**
 * 获取某个提供商支持的所有能力
 */
export function getProviderCapabilities(providerId: string): Capability[] {
  const capabilitiesSet = new Set<Capability>();

  // ── Phase 1: Check v2 registry if linked ──
  if (_getAllCards) {
    const cards = _getAllCards();
    for (const card of cards) {
      // Check if this card belongs to the requested provider (including alias resolution)
      const staticKey = findStaticMappingKey(card.provider);
      if (staticKey !== providerId && card.provider !== providerId) continue;

      for (const v2Key of Object.keys(card.capabilities)) {
        if ((card.capabilities[v2Key as CapabilityKey] ?? 0) <= 0) continue;
        const v1Key = REGISTRY_KEY_TO_LEGACY[v2Key];
        if (v1Key) capabilitiesSet.add(v1Key);
      }
    }
  }

  // ── Phase 2: Fill in from static mapping ──
  const mapping = PROVIDER_CAPABILITY_MAPPINGS[providerId];
  if (mapping) {
    for (const model of mapping.models) {
      for (const capability of model.capabilities) {
        capabilitiesSet.add(capability);
      }
    }
  }

  return Array.from(capabilitiesSet);
}

/**
 * 能力的人性化名称 (中文)
 */
export const CAPABILITY_NAMES: Partial<Record<Capability, string>> = {
  text: "聊天",
  "image-understanding": "看图",
  "image-generation": "画图",
  video: "看视频",
  "video-generation": "生视频",
  embedding: "智能推荐",
  code: "写代码",
  videoGen: "生视频",
  audio: "听语音",
  tts: "语音合成",
  toolCall: "工具调用",
};

/**
 * 能力的详细说明 (中文)
 */
export const CAPABILITY_DESCRIPTIONS: Partial<Record<Capability, string>> = {
  text: "和 AI 聊天对话",
  "image-understanding": "上传图片让 AI 识别和理解",
  "image-generation": "用文字描述让 AI 画图",
  video: "上传视频让 AI 总结内容",
  "video-generation": "用文字描述让 AI 生成视频",
  embedding: "智能推荐工具和技能 (必需)",
  code: "编写和理解代码",
  videoGen: "用文字描述让 AI 生成视频",
  audio: "语音识别和转写",
  tts: "文字转语音",
  toolCall: "工具/函数调用",
};

/**
 * 能力的图标 (emoji)
 */
export const CAPABILITY_ICONS: Partial<Record<Capability, string>> = {
  text: "💬",
  "image-understanding": "👁️",
  "image-generation": "🎨",
  video: "📹",
  "video-generation": "🎬",
  embedding: "🧩",
  code: "💻",
  videoGen: "🎬",
  audio: "🎤",
  tts: "🔊",
  toolCall: "🔧",
};
