/**
 * OEM Brand Configuration
 *
 * 所有 UI 层的品牌标识集中在此文件。
 * 构建时通过 VITE_EDITION 环境变量选择品牌配置：
 *   - "cn"       → CN 品牌（ClawbotCN）
 *   - "overseas"  → OEM 白牌（通用 AI 助手）
 *
 * OEM 客户可以直接修改 overseas 配置实现自定义品牌。
 */

export interface BrandConfig {
  /** 产品名称（显示在顶栏 logo 旁） */
  productName: string;
  /** 产品短名（激活码前缀等场景） */
  productShortName: string;
  /** 欢迎页标题 */
  welcomeTitle: string;
  /** 窗口标题 */
  windowTitle: string;
  /** meta description */
  metaDescription: string;
  /** 品牌标语（logo 旁副标题） */
  tagline: string;

  /** 激活码前缀校验（如 "claw"），空字符串表示不校验 */
  activationPrefix: string;
  /** 激活码占位符提示 */
  activationPlaceholder: string;
  /** 激活码前缀错误提示 */
  activationPrefixError: string;
  /** 激活对话框正文 */
  activationDialogText: string;
  /** 激活码示例 */
  activationExample: string;

  /** 品牌推广链接 URL（顶栏 & 侧栏底部），空字符串表示不显示 */
  promoUrl: string;
  /** 品牌推广名称 */
  promoName: string;
  /** 品牌推广描述 */
  promoDesc: string;

  /** 是否显示购买/续费入口（闲鱼等） */
  showPurchaseEntry: boolean;
  /** 是否显示技术支持二维码 */
  showSupportQrcode: boolean;
  /** 是否显示 adaptation notice（Windows 快速迭代提示） */
  showAdaptationNotice: boolean;

  /** logo 图片路径 */
  logoPath: string;
  /** logo alt 文本 */
  logoAlt: string;
  /**
   * 横版 banner 图路径（OEM用）
   * 有值时：顶栏 brand 区块直接渲染此图，忽略 logoPath + productName + tagline
   * 空字符串：走默认 logo+文字 布局
   */
  bannerPath: string;
  /**
   * 激活弹窗吉祥物/人物头图路径（OEM用）
   * 有值时：在激活弹窗顶部显示此图
   * 空字符串：不显示
   */
  activationMascotPath: string;

  /** CLI 命令名 */
  cliName: string;
  /** 配置文件名 */
  configFileName: string;

  /** 自定义事件前缀（如 "openclawcn:" → "app:"） */
  eventPrefix: string;
  /** localStorage key 前缀 */
  storagePrefix: string;

  /** 技能安装镜像提示 */
  skillMirrorHint: string;
  /** 技能安装专属功能标题 */
  skillExclusiveTitle: string;
  /** 免费模型标签 */
  freeModelsEyebrow: string;
  /** 批量安装加速标签 */
  batchMirrorBadge: string;
}

/** CN 品牌（自有品牌，默认） */
const cnBrand: BrandConfig = {
  productName: "ClawbotCN",
  productShortName: "Clawdbot",
  welcomeTitle: "Welcome to Clawdbot",
  windowTitle: "ClawbotCN",
  metaDescription: "ClawbotCN - 智能 AI 助手",
  tagline: "全栈国内运行",

  activationPrefix: "",
  activationPlaceholder: "请输入授权码、升级码或扩展包码",
  activationPrefixError: "",
  activationDialogText: "请输入您的授权码以激活 Clawdbot，或输入升级码/扩展包码进行升级",
  activationExample: "clawd-xxx / clpro-xxx / upg-bp-xxx / skill-s1-xxx",

  promoUrl: "",
  promoName: "",
  promoDesc: "",

  showPurchaseEntry: true,
  showSupportQrcode: true,
  showAdaptationNotice: true,

  logoPath: "/logo.png",
  logoAlt: "ClawbotCN",
  bannerPath: "",
  activationMascotPath: "",

  cliName: "openclawcn",
  configFileName: "openclawcn.json",

  eventPrefix: "openclawcn:",
  storagePrefix: "clawdbot.",

  skillMirrorHint: "🇨🇳 ClawdbotCN 专属：使用国内高速镜像，一键安装所有依赖",
  skillExclusiveTitle: "🇨🇳 ClawdbotCN 专属功能",
  freeModelsEyebrow: "ClawdbotCN 专属",
  batchMirrorBadge: "ClawdbotCN 加速",
};

// ─── OEM define constants (injected by vite.config.ts for VITE_EDITION=overseas) ──────────
// These are replaced at build time. Fallback values are used in dev / cn builds.
declare const __OEM_BRAND_PRODUCTNAME__: string | undefined;
declare const __OEM_BRAND_PRODUCTSHORTNAME__: string | undefined;
declare const __OEM_BRAND_WELCOMETITLE__: string | undefined;
declare const __OEM_BRAND_WINDOWTITLE__: string | undefined;
declare const __OEM_BRAND_METADESCRIPTION__: string | undefined;
declare const __OEM_BRAND_TAGLINE__: string | undefined;
declare const __OEM_BRAND_ACTIVATIONPREFIX__: string | undefined;
declare const __OEM_BRAND_ACTIVATIONPLACEHOLDER__: string | undefined;
declare const __OEM_BRAND_ACTIVATIONPREFIXERROR__: string | undefined;
declare const __OEM_BRAND_ACTIVATIONDIALOGTEXT__: string | undefined;
declare const __OEM_BRAND_ACTIVATIONEXAMPLE__: string | undefined;
declare const __OEM_BRAND_PROMOURL__: string | undefined;
declare const __OEM_BRAND_PROMONAME__: string | undefined;
declare const __OEM_BRAND_PROMODESC__: string | undefined;
declare const __OEM_BRAND_SHOWPURCHASEENTRY__: boolean | undefined;
declare const __OEM_BRAND_SHOWSUPPORTQRCODE__: boolean | undefined;
declare const __OEM_BRAND_SHOWADAPTATIONNOTICE__: boolean | undefined;
declare const __OEM_BRAND_LOGOPATH__: string | undefined;
declare const __OEM_BRAND_BANNERPATH__: string | undefined;
declare const __OEM_BRAND_ACTIVATIONMASCOTPATH__: string | undefined;
declare const __OEM_BRAND_SKILLMIRRORHINT__: string | undefined;
declare const __OEM_BRAND_SKILLEXCLUSIVETITLE__: string | undefined;
declare const __OEM_BRAND_FREEMODELSEYEBROW__: string | undefined;
declare const __OEM_BRAND_BATCHMIRRORBADGE__: string | undefined;

function oemStr(val: string | undefined, fallback: string): string {
  return typeof val !== "undefined" ? val : fallback;
}
function oemBool(val: boolean | undefined, fallback: boolean): boolean {
  return typeof val !== "undefined" ? val : fallback;
}

/** OEM 白牌（字段值由 config/oem/<OEM_ID>.json 注入，通过 Vite define 在构建时替换） */
const overseasBrand: BrandConfig = {
  productName:           oemStr(__OEM_BRAND_PRODUCTNAME__,           "ClawbotCN"),
  productShortName:      oemStr(__OEM_BRAND_PRODUCTSHORTNAME__,      "ClawbotCN"),
  welcomeTitle:          oemStr(__OEM_BRAND_WELCOMETITLE__,          "Welcome to ClawbotCN"),
  windowTitle:           oemStr(__OEM_BRAND_WINDOWTITLE__,           "ClawbotCN"),
  metaDescription:       oemStr(__OEM_BRAND_METADESCRIPTION__,       "ClawbotCN - AI Assistant"),
  tagline:               oemStr(__OEM_BRAND_TAGLINE__,               ""),

  activationPrefix:      oemStr(__OEM_BRAND_ACTIVATIONPREFIX__,      ""),
  activationPlaceholder: oemStr(__OEM_BRAND_ACTIVATIONPLACEHOLDER__,  "请输入授权码"),
  activationPrefixError: oemStr(__OEM_BRAND_ACTIVATIONPREFIXERROR__, ""),
  activationDialogText:  oemStr(__OEM_BRAND_ACTIVATIONDIALOGTEXT__,  "请输入您的授权码以激活"),
  activationExample:     oemStr(__OEM_BRAND_ACTIVATIONEXAMPLE__,     "XXXX-XXXX-XXXX"),

  promoUrl:              oemStr(__OEM_BRAND_PROMOURL__,              ""),
  promoName:             oemStr(__OEM_BRAND_PROMONAME__,             ""),
  promoDesc:             oemStr(__OEM_BRAND_PROMODESC__,             ""),

  showPurchaseEntry:     oemBool(__OEM_BRAND_SHOWPURCHASEENTRY__,    false),
  showSupportQrcode:     oemBool(__OEM_BRAND_SHOWSUPPORTQRCODE__,    false),
  showAdaptationNotice:  oemBool(__OEM_BRAND_SHOWADAPTATIONNOTICE__, false),

  logoPath:              oemStr(__OEM_BRAND_LOGOPATH__,              "/logo.png"),
  logoAlt:               "ClawbotCN",
  bannerPath:            oemStr(__OEM_BRAND_BANNERPATH__,            "/oem-banner.png"),
  activationMascotPath:  oemStr(__OEM_BRAND_ACTIVATIONMASCOTPATH__,  "/oem-mascot.png"),

  cliName:       "openclawcn",
  configFileName: "openclawcn.json",
  eventPrefix:   "openclawcn:",
  storagePrefix: "clawdbot.",

  skillMirrorHint:     oemStr(__OEM_BRAND_SKILLMIRRORHINT__,     ""),
  skillExclusiveTitle: oemStr(__OEM_BRAND_SKILLEXCLUSIVETITLE__,  ""),
  freeModelsEyebrow:   oemStr(__OEM_BRAND_FREEMODELSEYEBROW__,    ""),
  batchMirrorBadge:    oemStr(__OEM_BRAND_BATCHMIRRORBADGE__,     ""),
};

// ─── Runtime selection ────────────────────────────────────────────────────────

import { EDITION, isOverseas } from "./edition";

/** 当前构建使用的品牌配置 */
export const brand: BrandConfig =
  EDITION === "overseas" ? overseasBrand : cnBrand;

// OEM 模式：初始化时设置 HTML 文档标题和 meta
if (isOverseas && typeof document !== "undefined") {
  document.title = brand.windowTitle;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", brand.metaDescription);
}
