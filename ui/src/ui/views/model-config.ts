/**
 * 模型设置页面 View — v2 重写
 *
 * 信息架构:
 * 1. 新手引导横幅（全空时显示）
 * 2. 6 张能力卡（聊天/图片/视频/语音/编程/推荐）
 * 3. 本地模型设备概览条（硬件摘要 + 快捷操作）
 * 4. 已配置的服务商（可管理）
 * 5. 添加更多服务商（按分组折叠）
 */

import { html, css, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { formatGeneralError } from "../chat/error-hints";
import {
  createInitialModelConfigState,
  loadCapabilities,
  loadProviders,
  loadProviderGroups,
  loadProviderHealth,
  loadProviderPriority,
  saveProviderPriority,
  testProviderConnection,
  getHealthStatusText,
  getHealthStatusColor,
  openModelSelector,
  closeModelSelector,
  openProviderConfig,
  closeProviderConfig,
  updateProviderApiKey,
  updateProviderBaseUrl,
  updateProviderCustomModel,
  updateProviderVolcAppId,
  updateProviderVolcAccessToken,
  switchProviderVolcTab,
  detectAndConfigureProvider,
  handleDetectProgressEvent,
  handleDetectCompleteEvent,
  cancelDetection,
  providerConfigNextStep,
  providerConfigPrevStep,
  navigateToProviderConfig,
  toggleProviderGroup,
  openProviderManage,
  closeProviderManage,
  deleteProviderConfig,
  type ModelConfigState,
  type Capability,
  type ModelInfo,
  type ProviderInfo,
} from "../controllers/model-config.js";
import {
  createInitialLocalEngineState,
  fetchLocalEngineStatus,
  redetectHardware,
  installModel,
  installRecommended,
  uninstallModel,
  startSidecar,
  stopSidecar,
  isLocalEngineProgressEvent,
  parseLocalEngineProgress,
  type LocalEngineUIState,
  type LocalEngineInstallProgress,
} from "../controllers/local-engine.js";
import {
  renderDeviceBar,
  renderLocalModelTab,
  renderLocalManageModal,
  type LocalModelAction,
} from "./local-model-tab.js";

/** 能力名映射（v1 + v2 keys） */
const CAPABILITY_NAME_MAP: Record<string, string> = {
  text: "聊天",
  code: "编程",
  "image-understanding": "看图",
  "image-generation": "画图",
  vision: "看图",
  imageGen: "画图",
  video: "视频",
  videoGen: "视频生成",
  audio: "语音识别",
  tts: "语音合成",
  embedding: "向量嵌入",
  toolCall: "工具调用",
};

/** 渲染 tagline，将"每日免费50万Token"等免费额度文字高亮为红色 */
const FREE_TOKEN_RE = /每日免费\d+万Token/;
function renderTagline(tagline: string) {
  const m = FREE_TOKEN_RE.exec(tagline);
  if (!m) return tagline;
  const before = tagline.slice(0, m.index);
  const match = m[0];
  const after = tagline.slice(m.index + match.length);
  return html`${before}<span class="tagline-free">${match}</span>${after}`;
}

/** 子能力定义：每个子能力包含可匹配的 v2/v1 keys 和显示标签 */
interface SubCapDef {
  /** 显示标签，如 "看图" "画图" */
  label: string;
  /** 匹配的 capability keys（v2 优先，v1 兼容） */
  keys: string[];
}

/** 面向用户的 6 大能力分组，每个卡片可包含多个子能力 */
interface UserCapDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** 子能力列表；单能力卡片只有 1 项，多能力卡片有 2+ 项 */
  subs: SubCapDef[];
  /** 所有匹配的 capability keys（用于快速判断） */
  caps: string[];
}

const USER_CAPABILITIES: UserCapDef[] = [
  { id: "text", name: "聊天", desc: "和 AI 对话", icon: "💬",
    subs: [{ label: "聊天", keys: ["text"] }],
    caps: ["text"] },
  { id: "image", name: "图片", desc: "看图 & 画图", icon: "🎨",
    subs: [
      { label: "图片理解", keys: ["vision", "image-understanding"] },
      { label: "图片生成", keys: ["imageGen", "image-generation"] },
    ],
    caps: ["vision", "imageGen", "image-understanding", "image-generation"] },
  { id: "video", name: "视频", desc: "视频理解 & 生成", icon: "📹",
    subs: [
      { label: "视频理解", keys: ["video"] },
      { label: "视频生成", keys: ["videoGen"] },
    ],
    caps: ["video", "videoGen"] },
  { id: "voice", name: "语音", desc: "语音识别 & 合成", icon: "🎙️",
    subs: [
      { label: "语音识别", keys: ["audio"] },
      { label: "语音合成", keys: ["tts"] },
    ],
    caps: ["audio", "tts"] },
  { id: "code", name: "编程", desc: "代码生成 & 调试", icon: "💻",
    subs: [{ label: "编程", keys: ["code"] }],
    caps: ["code"] },
  { id: "embedding", name: "记忆", desc: "向量嵌入 & 记忆提取", icon: "🧠",
    subs: [
      { label: "向量嵌入", keys: ["embedding"] },
      { label: "记忆提取", keys: ["memoryExtraction"] },
    ],
    caps: ["embedding"] },
];

/** 快速上手推荐的 provider */
const QUICK_SETUP_PROVIDER = "kimi-code";
/**
 * 推荐配置的 provider（记忆系统核心依赖）
 * - siliconflow: 向量嵌入（embedding 能力，无替代）
 * - meituan-longcat: 记忆提取首选（免费额度，优先于主模型）
 * - ant-ling: 记忆提取备选（免费额度，优先于主模型）
 * 不配置这些时，记忆提取会自动 fallback 到用户的主聊天模型。
 */
const ESSENTIAL_PROVIDERS: readonly string[] = ["siliconflow", "meituan-longcat", "ant-ling"];

@customElement("model-config-view")
export class ModelConfigView extends LitElement {
  @property({ type: Object })
  client: { request: (method: string, params?: unknown) => Promise<unknown> } | null = null;

  @property({ type: Boolean })
  connected: boolean = false;

  @state() private _s: ModelConfigState = createInitialModelConfigState();
  private _dataLoaded = false;
  @state() private _switchingModelId: string | null = null;
  @state() private _deleteConfirm = false;

  /* ── 本地引擎状态 ── */
  @state() private _le: LocalEngineUIState = createInitialLocalEngineState();
  @state() private _leManageOpen = false;

  /** 快速切换：当前展开的能力卡 ID（如 "text"），null 表示关闭 */
  @state() private _quickSwitchCap: string | null = null;
  /** 快速切换：已加载的可用模型列表（单能力卡） */
  @state() private _quickSwitchModels: ModelInfo[] = [];
  /** 快速切换：多子能力卡片的 per-sub 模型列表（key = sub.label） */
  @state() private _quickSwitchSubModels: Map<string, { cap: Capability | undefined; models: ModelInfo[] }> = new Map();
  /** 快速切换：加载中 */
  @state() private _quickSwitchLoading = false;
  /** 快速切换：加载错误 */
  @state() private _quickSwitchError: string | null = null;
  /** 向量库 embedding 绑定状态 */
  @state() private _embeddingBinding: {
    bound: boolean; vecModel: string | null; vecDims: number | null; vecCount: number;
  } | null = null;
  /** 记忆提取 LLM 状态 */
  @state() private _extractionStatus: {
    provider: string | null; model: string | null; status: "active" | "inactive";
  } | null = null;
  /** 手动添加模型：输入的模型 ID */
  @state() private _addModelId = "";
  /** 手动添加模型：提交中 */
  @state() private _addModelLoading = false;
  /** 手动添加模型：结果信息 */
  @state() private _addModelMsg: { type: "ok" | "warn" | "err"; text: string } | null = null;
  /** 模型切换成功提示 */
  @state() private _switchToast: { model: string; provider: string } | null = null;
  private _switchToastTimer: ReturnType<typeof setTimeout> | null = null;
  /** 指针拖拽排序状态 */
  private _dragFromIndex: number | null = null;

  /* ── 模型选择器 redesign 状态 ── */
  /** 模型选择器搜索关键词 */
  @state() private _modelSelectorSearch = "";
  /** 模型选择器：按服务商筛选 */
  @state() private _modelSelectorProviderFilter: string | null = null;
  /** 模型选择器：按上下文窗口筛选（最低 token 数） */
  @state() private _modelSelectorContextFilter: number | null = null;
  /** 模型选择器：按能力等级筛选 */
  @state() private _modelSelectorStrengthFilter: string | null = null;
  /** 模型选择器：多子能力卡片的当前 tab 索引 */
  @state() private _modelSelectorActiveSubIndex = 0;
  /** 模型选择器：当前打开的 UserCapDef（用于 tab 切换） */
  private _modelSelectorUserCap: UserCapDef | null = null;
  /** 模型选择器：服务商筛选下拉是否展开 */
  @state() private _msProviderDropdownOpen = false;
  /** 模型选择器：未配置区域是否展开 */
  @state() private _msUnconfiguredExpanded = false;

  /* ── broadcast event handlers (bound for add/removeEventListener) ── */
  private _boundDetectProgress = (e: Event) => {
    const payload = (e as CustomEvent).detail;
    if (!payload) return;
    const h = this._host();
    handleDetectProgressEvent(h, payload);
    this._sync(h);
  };
  private _boundDetectComplete = (e: Event) => {
    const payload = (e as CustomEvent).detail;
    if (!payload) return;
    const h = this._host();
    handleDetectCompleteEvent(h, payload);
    this._sync(h);
  };
  /** 从聊天页话筒按钮触发：自动打开豆包语音配置 */
  private _boundVoiceSetup = async () => {
    // 确保数据已加载
    if (!this._dataLoaded) {
      await this._loadData();
    }
    const provider = this._s.providers.find(p => p.providerId === "volcengine-ark");
    if (!provider) return;
    const h = this._host();
    openProviderConfig(h, provider);
    // 跳过 guide 直接到 apikey，并切到语音 Tab
    h.providerConfigStep = "apikey";
    h.providerConfigVolcTab = "voice";
    this._sync(h);
    this._loadVolcCredsStatus();
  };

  private _boundLeProgress = (e: Event) => {
    const payload = (e as CustomEvent).detail;
    if (!payload) return;
    const progress = payload as LocalEngineInstallProgress;
    if (progress.modelId) {
      this._le = {
        ...this._le,
        installProgress: { ...this._le.installProgress, [progress.modelId]: progress },
      };
    }
  };
  @state() private _dragOverIndex: number | null = null;
  private _dragClone: HTMLElement | null = null;
  private _dragOffsetY = 0;
  private _dragRows: HTMLElement[] = [];

  /* ═══════════════════════════════════════════════════════════════
     STYLES
     ═══════════════════════════════════════════════════════════════ */
  static styles = css`
    :host {
      display: flex; flex-direction: column; height: 100%; padding: 0; overflow: hidden;
      font-family: var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      color: var(--text, #e8ecf1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .mc-scroll {
      flex: 1; min-height: 0; overflow-y: auto;
      padding: 20px 24px 32px;
    }
    .mc-scroll::-webkit-scrollbar { width: 5px; }
    .mc-scroll::-webkit-scrollbar-track { background: transparent; }
    .mc-scroll::-webkit-scrollbar-thumb { background: var(--border, #2d3a4d); border-radius: 3px; }

    /* ═══════ SECTION LABELS ═══════ */
    .section-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--muted, #8b9caf); margin-bottom: 12px;
    }
    .section-divider {
      border: none; border-top: 1px solid var(--border, #2d3a4d); margin: 24px 0 20px;
    }

    /* ═══════ ONBOARDING BANNER ═══════ */
    .onboarding {
      padding: 24px; margin-bottom: 24px;
      background: linear-gradient(135deg, rgba(108,140,255,.1) 0%, rgba(52,211,153,.08) 100%);
      border: 1px solid rgba(108,140,255,.2);
      border-radius: var(--radius-lg, 12px);
      animation: fade-in 0.3s ease-out;
    }
    .onboarding__title {
      font-size: 18px; font-weight: 700; color: var(--text-strong, #fff); margin-bottom: 8px;
    }
    .onboarding__desc {
      font-size: 14px; color: var(--text, #e8ecf1); margin-bottom: 20px; line-height: 1.6;
    }
    .onboarding__actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .onboarding__essential-list { display: flex; gap: 8px; flex-wrap: wrap; }
    .onboarding__step {
      padding: 16px; margin-bottom: 12px;
      background: rgba(255,255,255,.04); border: 1px solid rgba(108,140,255,.12);
      border-radius: var(--radius-md, 8px);
    }
    .onboarding__step-label {
      font-size: 13px; font-weight: 600; color: var(--accent, #6c8cff); margin-bottom: 4px;
    }
    .onboarding__step-desc {
      font-size: 13px; color: var(--text, #e8ecf1); margin-bottom: 12px; line-height: 1.5;
    }
    @keyframes fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    /* ═══════ ESSENTIAL PROVIDER BANNER ═══════ */
    .sf-banner {
      display: flex; align-items: center; gap: 14px;
      padding: 16px 20px; margin-bottom: 8px;
      background: linear-gradient(135deg, rgba(168,85,247,.1) 0%, rgba(108,140,255,.08) 100%);
      border: 1px solid rgba(168,85,247,.3);
      border-radius: var(--radius-md, 8px);
      animation: fade-in 0.3s ease-out;
    }
    .sf-banner:last-child { margin-bottom: 20px; }
    .sf-banner__icon { font-size: 28px; flex-shrink: 0; }
    .sf-banner__body { flex: 1; min-width: 0; }
    .sf-banner__title {
      font-size: 14px; font-weight: 600; color: var(--text-strong, #fff); margin-bottom: 2px;
    }
    .sf-banner__desc {
      font-size: 12px; color: var(--muted, #8b9caf); line-height: 1.4;
    }

    /* ═══════ ERROR TOAST ═══════ */
    .error-toast {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; margin-bottom: 16px;
      background: var(--danger-subtle, rgba(248,113,113,.15));
      border: 1px solid rgba(248,113,113,.3);
      border-radius: var(--radius-md, 8px);
      font-size: 13px; color: var(--danger, #f87171);
    }
    .error-toast__msg { flex: 1; }
    .error-toast__close {
      background: none; border: none; cursor: pointer;
      color: var(--danger, #f87171); font-size: 16px; padding: 2px 6px;
      border-radius: var(--radius-sm, 6px);
    }
    .error-toast__close:hover { background: rgba(248,113,113,.15); }

    /* ═══════ INFO TOAST (model switch hint) ═══════ */
    .info-toast {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; margin-bottom: 16px;
      background: rgba(108,140,255,.12);
      border: 1px solid rgba(108,140,255,.25);
      border-radius: var(--radius-md, 8px);
      font-size: 13px; color: var(--accent, #6c8cff);
      animation: fade-in 0.3s ease-out;
    }
    .info-toast__icon { flex-shrink: 0; font-size: 15px; }
    .info-toast__msg { flex: 1; line-height: 1.4; }
    .info-toast__model { font-weight: 600; color: var(--text-strong, #fff); }
    .info-toast__close {
      background: none; border: none; cursor: pointer;
      color: var(--accent, #6c8cff); font-size: 16px; padding: 2px 6px;
      border-radius: var(--radius-sm, 6px);
    }
    .info-toast__close:hover { background: rgba(108,140,255,.15); }

    /* ═══════ CAPABILITY CARDS (3 columns x 2 rows) ═══════ */
    .cap-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 0;
    }
    @media (max-width: 900px) { .cap-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 500px) { .cap-grid { grid-template-columns: 1fr; } }

    .cap-card {
      background: var(--card, #1a2332);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-lg, 12px);
      padding: 16px; cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
      animation: card-in 0.3s var(--ease-out, cubic-bezier(0.16,1,0.3,1)) both;
    }
    .cap-card:nth-child(1) { animation-delay: 0ms; }
    .cap-card:nth-child(2) { animation-delay: 50ms; }
    .cap-card:nth-child(3) { animation-delay: 100ms; }
    .cap-card:nth-child(4) { animation-delay: 150ms; }
    .cap-card:nth-child(5) { animation-delay: 200ms; }
    .cap-card:nth-child(6) { animation-delay: 250ms; }
    @keyframes card-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    .cap-card:hover { border-color: var(--border-strong, #4a5a70); box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,.15)); transform: translateY(-1px); }
    .cap-card:focus-visible { outline: 2px solid var(--accent, #6c8cff); outline-offset: 2px; }
    .cap-card.active { border-color: rgba(52, 211, 153, 0.3); }
    .cap-card.inactive { border-style: dashed; opacity: 0.75; }
    .cap-card.inactive:hover { opacity: 1; border-style: solid; border-color: var(--accent, #6c8cff); }

    .cap-card__head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .cap-card__icon {
      width: 36px; height: 36px; border-radius: var(--radius-md, 8px);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; background: var(--bg-elevated, #1c242e);
      border: 1px solid var(--border, #2d3a4d); flex-shrink: 0;
    }
    .cap-card__name { font-size: 14px; font-weight: 600; color: var(--text-strong, #fff); flex: 1; }
    .cap-card__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .cap-card__dot.on { background: var(--ok, #34d399); box-shadow: 0 0 6px rgba(52,211,153,0.5); }
    .cap-card__dot.off { background: var(--muted-strong, #6b7d91); opacity: 0.4; }

    .cap-card__model {
      font-size: 12px; font-family: var(--mono, "JetBrains Mono", monospace);
      color: var(--text, #e8ecf1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .cap-card__provider { font-size: 11px; color: var(--muted, #8b9caf); margin-top: 2px; }
    .cap-card__action {
      margin-top: 8px; font-size: 12px; font-weight: 500;
      color: var(--accent, #6c8cff);
    }
    .cap-card__empty {
      font-size: 12px; color: var(--muted, #8b9caf); line-height: 1.5;
    }
    .cap-card__empty-cta {
      margin-top: 6px; font-size: 12px; color: var(--accent, #6c8cff); font-weight: 500;
    }
    .cap-card__clickable { cursor: pointer; }

    /* ═══════ SUB-CAPABILITY ROWS (inside cap-card) ═══════ */
    .cap-card__subs { display: flex; flex-direction: column; gap: 4px; margin-top: 2px; }
    .cap-card__sub {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; line-height: 1.4;
    }
    .cap-card__sub-dot {
      width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
    }
    .cap-card__sub-dot.on { background: var(--ok, #34d399); box-shadow: 0 0 4px rgba(52,211,153,0.4); }
    .cap-card__sub-dot.off { background: var(--muted-strong, #6b7d91); opacity: 0.4; }
    .cap-card__sub-label {
      color: var(--muted, #8b9caf); flex-shrink: 0; min-width: 48px;
    }
    .cap-card__sub-model {
      color: var(--text, #e8ecf1); font-family: var(--mono, monospace);
      font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .cap-card__sub-model--off { color: var(--muted, #8b9caf); opacity: 0.5; font-family: inherit; }
    .cap-card.expanded {
      border-color: var(--accent, #6c8cff);
      box-shadow: 0 0 0 1px var(--accent, #6c8cff), var(--shadow-sm, 0 2px 8px rgba(0,0,0,.15));
    }

    /* ═══════ QUICK SWITCH PANEL ═══════ */
    .qs-panel {
      margin-top: 10px; padding-top: 10px;
      border-top: 1px solid var(--border, #2d3a4d);
    }
    .qs-scroll {
      max-height: 280px; overflow-y: auto;
    }
    .qs-scroll::-webkit-scrollbar { width: 4px; }
    .qs-scroll::-webkit-scrollbar-track { background: transparent; }
    .qs-scroll::-webkit-scrollbar-thumb { background: var(--border, #2d3a4d); border-radius: 2px; }
    .qs-loading, .qs-empty {
      font-size: 11px; color: var(--muted, #8b9caf); padding: 8px 0; text-align: center;
    }
    .qs-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 10px; border-radius: var(--radius-md, 8px);
      cursor: pointer; transition: background 0.12s;
      gap: 8px;
    }
    .qs-item:hover { background: var(--bg-elevated, #1c242e); }
    .qs-item.current {
      background: rgba(52, 211, 153, 0.08);
      cursor: default;
    }
    .qs-item.switching { opacity: 0.6; pointer-events: none; }
    .qs-item__info { flex: 1; min-width: 0; }
    .qs-item__name {
      font-size: 12px; font-weight: 500; color: var(--text, #e8ecf1);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .qs-item__provider {
      font-size: 10px; color: var(--muted, #8b9caf); margin-top: 1px;
    }
    .qs-item__end { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .qs-check { color: var(--ok, #34d399); font-size: 13px; font-weight: 700; }
    .qs-spinner {
      width: 12px; height: 12px; border: 2px solid var(--border, #2d3a4d);
      border-top-color: var(--accent, #6c8cff); border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    .qs-more {
      display: block; text-align: center; padding: 6px 0; margin-top: 4px;
      font-size: 11px; color: var(--accent, #6c8cff); cursor: pointer;
      border-radius: var(--radius-md, 8px); transition: background 0.12s;
    }
    .qs-more:hover { background: var(--bg-elevated, #1c242e); }

    /* ═══════ QUICK SWITCH SUB-GROUP ═══════ */
    .qs-sub-group { margin-bottom: 6px; }
    .qs-sub-group:last-child { margin-bottom: 0; }
    .qs-sub-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--muted, #8b9caf);
      padding: 6px 0 2px; border-bottom: 1px solid var(--border, #2d3a4d);
      margin-bottom: 2px;
    }

    /* ═══════ PROVIDER SECTIONS ═══════ */
    .prov-section { margin-bottom: 8px; }
    .prov-list { display: flex; flex-direction: column; gap: 6px; }

    .prov-row {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; background: var(--card, #1a2332);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-md, 8px);
      transition: border-color 0.12s, box-shadow 0.12s;
    }
    .prov-row:hover { border-color: var(--border-strong, #4a5a70); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.12)); }
    .prov-row:focus-visible { outline: 2px solid var(--accent, #6c8cff); outline-offset: 2px; }
    .prov-row.configured { border-left: 3px solid var(--ok, #34d399); cursor: grab; touch-action: none; }
    .prov-row.configured:active { cursor: grabbing; }

    .prov-row__icon {
      font-size: 20px; width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      background: var(--bg-elevated, #1c242e);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-sm, 6px); flex-shrink: 0;
    }
    .prov-row.configured .prov-row__icon { background: var(--ok-subtle, rgba(52,211,153,.1)); border-color: rgba(52,211,153,.2); }

    .prov-row__info { flex: 1; min-width: 0; }
    .prov-row__name { font-size: 13px; font-weight: 600; color: var(--text-strong, #fff); }
    .prov-row__essential { display: inline-block; font-size: 11px; font-weight: 600; color: #ef4444; margin-left: 6px; vertical-align: middle; }
    .prov-row__tagline { font-size: 11px; color: var(--muted, #8b9caf); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tagline-free { color: #ef4444; font-weight: 600; }

    .prov-row__caps { display: flex; gap: 4px; flex-shrink: 0; flex-wrap: wrap; }
    .cap-tag {
      font-size: 10px; padding: 1px 6px; border-radius: 4px;
      background: var(--bg-elevated, #1c242e); color: var(--muted, #8b9caf);
      border: 1px solid var(--border, #2d3a4d);
    }

    .prov-row__btn {
      padding: 5px 12px; font-size: 12px; font-weight: 500; border: none;
      border-radius: var(--radius-sm, 6px); cursor: pointer;
      transition: all 0.12s; flex-shrink: 0;
    }
    .prov-row__btn--manage {
      background: var(--bg-elevated, #1c242e); color: var(--text, #e8ecf1);
      border: 1px solid var(--border, #2d3a4d);
    }
    .prov-row__btn--manage:hover { border-color: var(--accent, #6c8cff); color: var(--accent, #6c8cff); }
    .prov-row__btn--add {
      background: var(--accent-subtle, rgba(108,140,255,.1)); color: var(--accent, #6c8cff);
      border: 1px solid rgba(108,140,255,.2);
    }
    .prov-row__btn--add:hover { background: rgba(108,140,255,.15); border-color: var(--accent, #6c8cff); }

    /* ═══════ PROVIDER GROUPS ═══════ */
    .prov-group-header {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 4px; cursor: pointer; user-select: none;
    }
    .prov-group-header:hover { color: var(--text-strong, #fff); }
    .prov-group-header:focus-visible { outline: 2px solid var(--accent, #6c8cff); outline-offset: 2px; border-radius: var(--radius-sm, 6px); }
    .prov-group-icon { font-size: 14px; }
    .prov-group-name { font-size: 12px; font-weight: 600; color: var(--text, #e8ecf1); flex: 1; }
    .prov-group-count { font-size: 11px; color: var(--muted, #8b9caf); }
    .prov-group-arrow { font-size: 11px; color: var(--muted, #8b9caf); transition: transform 0.2s; }
    .prov-group-arrow.expanded { transform: rotate(90deg); }
    .prov-group-items { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }

    /* ═══════ MODAL (shared) ═══════ */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; animation: fade-in 0.15s ease-out;
    }
    .modal {
      background: var(--surface, #1a2332);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-lg, 12px);
      max-width: 520px; width: 94%; max-height: 80vh; overflow-y: auto;
      box-shadow: var(--shadow-xl, 0 24px 48px rgba(0,0,0,.4));
      animation: modal-in 0.2s var(--ease-out) both;
    }
    @keyframes modal-in { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 24px 24px 0; }
    .modal-title { font-size: 16px; font-weight: 600; color: var(--text-strong, #fff); }
    .modal-close {
      width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
      background: none; border: 1px solid transparent;
      border-radius: var(--radius-sm, 6px); font-size: 16px; cursor: pointer;
      color: var(--muted, #8b9caf); transition: all 0.12s;
    }
    .modal-close:hover { background: var(--bg-hover, #2a3544); border-color: var(--border, #2d3a4d); color: var(--text, #e8ecf1); }
    .modal-body { padding: 20px 24px 24px; }

    .modal::-webkit-scrollbar { width: 6px; }
    .modal::-webkit-scrollbar-track { background: transparent; }
    .modal::-webkit-scrollbar-thumb { background: var(--border, #2d3a4d); border-radius: 3px; }

    /* ═══════ MODEL SELECTOR ═══════ */
    .model-group { margin-bottom: 20px; }
    .model-group:last-child { margin-bottom: 0; }
    .model-group__header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border, #2d3a4d); }
    .model-group__icon { font-size: 14px; }
    .model-group__name { font-size: 12px; font-weight: 600; color: var(--text, #e8ecf1); flex: 1; }
    .model-group__badge { font-size: 10px; padding: 1px 6px; border-radius: var(--radius-sm, 6px); font-weight: 500; }
    .model-group__badge.current { background: var(--accent-subtle, rgba(108,140,255,.12)); color: var(--accent, #6c8cff); }
    .model-group__badge.configured { background: var(--ok-subtle, rgba(52,211,153,.1)); color: var(--ok, #34d399); }
    .model-group__badge.unconfigured { background: var(--bg-muted, #2a3544); color: var(--muted, #8b9caf); }

    .m-item {
      padding: 10px 12px; border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-md, 8px); cursor: pointer; transition: all 0.12s;
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;
    }
    .m-item:last-child { margin-bottom: 0; }
    .m-item:hover { border-color: var(--border-strong, #4a5a70); background: var(--bg-elevated, #1c242e); }
    .m-item:focus-visible { outline: 2px solid var(--accent, #6c8cff); outline-offset: 2px; }
    .m-item.current { border-color: var(--accent, #6c8cff); background: var(--accent-subtle, rgba(108,140,255,.06)); }
    .m-item.locked { opacity: 0.35; cursor: not-allowed; }
    .m-item.switching { opacity: 0.6; pointer-events: none; }
    .m-item__info { flex: 1; min-width: 0; }
    .m-item__name { font-size: 13px; font-weight: 500; color: var(--text, #e8ecf1); font-family: var(--mono, monospace); }
    .m-item__end { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .checkmark { color: var(--accent, #6c8cff); font-weight: 700; font-size: 14px; }

    .badge { display: inline-flex; align-items: center; padding: 1px 7px; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; line-height: 1.6; }
    .badge--strong { background: rgba(52,211,153,.12); color: #34d399; }
    .badge--moderate { background: rgba(251,191,36,.12); color: #fbbf24; }
    .badge--weak { background: rgba(248,113,113,.12); color: #f87171; }

    /* ═══════ STRENGTH TIER WARNING ═══════ */
    .strength-warn {
      display: flex; align-items: flex-start; gap: 8px;
      margin-top: 6px; padding: 6px 8px;
      border-radius: var(--radius-md, 8px);
      font-size: 10px; line-height: 1.4;
    }
    .strength-warn--weak {
      background: rgba(248,113,113,.08);
      color: var(--danger, #f87171);
      border: 1px solid rgba(248,113,113,.2);
    }
    .strength-warn--moderate {
      background: rgba(251,191,36,.06);
      color: var(--warn, #fbbf24);
      border: 1px solid rgba(251,191,36,.15);
    }
    .strength-warn__icon { flex-shrink: 0; font-size: 12px; line-height: 1.2; }
    .strength-warn__text { flex: 1; }
    .strength-warn__recommend {
      color: var(--text, #e8ecf1); font-weight: 500;
    }
    .cap-card.active.tier-weak { border-color: rgba(248,113,113,.3); }
    .cap-card.active.tier-moderate { border-color: rgba(251,191,36,.25); }

    .add-provider-link {
      display: flex; align-items: center; gap: 6px; padding: 8px 12px;
      border: 1px dashed var(--border, #2d3a4d); border-radius: var(--radius-md, 8px);
      font-size: 12px; color: var(--accent, #6c8cff);
      cursor: pointer; transition: all 0.15s; margin-top: 6px;
    }
    .add-provider-link:hover { border-color: var(--accent, #6c8cff); background: var(--accent-subtle, rgba(108,140,255,.06)); }
    .add-provider-link:focus-visible { outline: 2px solid var(--accent, #6c8cff); outline-offset: 2px; }

    .m-item__spinner {
      width: 14px; height: 14px; border: 2px solid var(--border, #2d3a4d);
      border-top-color: var(--accent, #6c8cff); border-radius: 50%;
      animation: spin 0.7s linear infinite; flex-shrink: 0;
    }

    /* ═══════ MODEL SELECTOR MODAL (redesigned) ═══════ */
    .ms-modal {
      max-width: 720px !important;
      width: 96% !important;
      max-height: 85vh !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
    }
    .ms-current {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 20px;
      background: rgba(108,140,255,.06);
      font-size: 13px; color: var(--text, #e8ecf1);
      border-bottom: 1px solid var(--border, #2d3a4d);
    }
    .ms-current__label { color: var(--muted, #8b9caf); font-size: 12px; }
    .ms-current__model { font-weight: 600; }
    .ms-current__provider { color: var(--muted, #8b9caf); font-size: 12px; }
    .ms-current__lock {
      font-size: 11px; padding: 2px 8px; border-radius: 4px;
      margin-left: auto; white-space: nowrap;
    }
    .ms-current__lock--manual {
      background: rgba(251,191,36,.15); color: var(--warning, #fbbf24);
    }
    .ms-current__lock--auto {
      background: var(--bg-muted, #2a3544); color: var(--muted, #8b9caf);
    }
    .ms-tabs {
      display: flex; gap: 0; padding: 0 20px;
      border-bottom: 1px solid var(--border, #2d3a4d);
    }
    .ms-tab {
      padding: 10px 16px; font-size: 13px;
      background: none; border: none;
      border-bottom: 2px solid transparent;
      color: var(--muted, #8b9caf); cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .ms-tab:hover { color: var(--text, #e8ecf1); }
    .ms-tab.active {
      color: var(--accent, #6c8cff);
      border-bottom-color: var(--accent, #6c8cff);
    }
    .ms-toolbar {
      padding: 12px 20px;
      display: flex; flex-direction: column; gap: 8px;
      border-bottom: 1px solid var(--border, #2d3a4d);
      flex-shrink: 0;
    }
    .ms-search {
      width: 100%; padding: 8px 12px; border-radius: 8px;
      border: 1px solid var(--border, #2d3a4d);
      background: var(--bg-muted, #2a3544); color: var(--text, #e8ecf1);
      font-size: 13px; outline: none;
      font-family: inherit;
    }
    .ms-search:focus { border-color: var(--accent, #6c8cff); }
    .ms-search::placeholder { color: var(--muted, #8b9caf); }
    .ms-filters {
      display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
    }
    .ms-filter-chip {
      padding: 4px 10px; border-radius: 20px; font-size: 11px;
      border: 1px solid var(--border, #2d3a4d);
      background: transparent; color: var(--muted, #8b9caf);
      cursor: pointer; transition: all 0.12s;
      font-family: inherit; line-height: 1.4;
    }
    .ms-filter-chip:hover { border-color: var(--border-strong, #4a5a70); color: var(--text, #e8ecf1); }
    .ms-filter-chip.active {
      background: var(--accent-subtle, rgba(108,140,255,.12));
      color: var(--accent, #6c8cff);
      border-color: var(--accent, #6c8cff);
    }
    .ms-dropdown {
      position: absolute; top: 100%; left: 0; margin-top: 4px; min-width: 140px;
      background: var(--surface, #1a2332); border: 1px solid var(--border, #2d3a4d);
      border-radius: 8px; padding: 4px; z-index: 10;
      box-shadow: 0 8px 24px rgba(0,0,0,.3);
    }
    .ms-dropdown__item {
      padding: 6px 12px; border-radius: 6px; font-size: 12px;
      cursor: pointer; color: var(--text, #e8ecf1);
      transition: background 0.1s;
    }
    .ms-dropdown__item:hover { background: rgba(255,255,255,.06); }
    .ms-dropdown__item.active {
      background: var(--accent-subtle, rgba(108,140,255,.12));
      color: var(--accent, #6c8cff);
    }
    .ms-body {
      flex: 1; min-height: 0; overflow-y: auto;
      padding: 12px 20px;
    }
    .ms-body::-webkit-scrollbar { width: 6px; }
    .ms-body::-webkit-scrollbar-track { background: transparent; }
    .ms-body::-webkit-scrollbar-thumb { background: var(--border, #2d3a4d); border-radius: 3px; }
    .ms-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; border-radius: 8px; cursor: pointer;
      transition: background 0.12s; margin-bottom: 4px;
    }
    .ms-item:hover { background: rgba(255,255,255,.04); }
    .ms-item.current { background: rgba(108,140,255,.08); }
    .ms-item.unconfigured { opacity: 0.45; cursor: default; }
    .ms-item.switching { opacity: 0.6; pointer-events: none; }
    .ms-item__main { flex: 1; min-width: 0; }
    .ms-item__name { font-size: 13px; font-weight: 500; color: var(--text, #e8ecf1); }
    .ms-item__meta {
      font-size: 11px; color: var(--muted, #8b9caf);
      display: flex; gap: 8px; margin-top: 2px;
    }
    .ms-item__provider { }
    .ms-item__ctx { }
    .ms-item__end { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .ms-item__spinner {
      width: 14px; height: 14px;
      border: 2px solid var(--border, #2d3a4d);
      border-top-color: var(--accent, #6c8cff);
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    .ms-empty {
      text-align: center; padding: 40px 0;
      color: var(--muted, #8b9caf); font-size: 13px;
    }
    .ms-unconfigured-section {
      margin-top: 16px;
      border-top: 1px solid var(--border, #2d3a4d);
      padding-top: 12px;
    }
    .ms-unconfigured-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 4px; font-size: 12px; color: var(--muted, #8b9caf);
      cursor: pointer; user-select: none;
    }
    .ms-unconfigured-header:hover { color: var(--text, #e8ecf1); }
    .ms-unconfigured-arrow {
      transition: transform 0.2s; font-size: 10px;
    }
    .ms-unconfigured-arrow.expanded { transform: rotate(90deg); }
    .ms-unconfigured-list { padding-top: 8px; }
    .ms-provider-group { margin-bottom: 16px; }
    .ms-provider-group__header {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 6px; padding-bottom: 4px;
      border-bottom: 1px solid var(--border, #2d3a4d);
    }
    .ms-provider-group__badge {
      font-size: 10px; padding: 1px 6px; border-radius: 6px;
      background: var(--bg-muted, #2a3544); color: var(--muted, #8b9caf);
    }

    /* ═══════ PROVIDER CONFIG MODAL ═══════ */
    .step-indicator { display: flex; gap: 6px; padding: 16px 24px 0; }
    .step-bar { flex: 1; height: 3px; border-radius: 2px; background: var(--border, #2d3a4d); transition: background 0.2s; }
    .step-bar.done { background: var(--ok, #34d399); }
    .step-bar.active { background: var(--accent, #6c8cff); }

    .guide-caps { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
    .guide-cap-tag { font-size: 11px; padding: 3px 10px; border-radius: var(--radius-sm, 6px); background: var(--accent-subtle, rgba(108,140,255,.1)); color: var(--accent, #6c8cff); border: 1px solid rgba(108,140,255, 0.15); }

    .guide-steps { list-style: none; counter-reset: guide-step; }
    .guide-step { position: relative; padding: 10px 0 10px 36px; font-size: 13px; color: var(--text, #e8ecf1); counter-increment: guide-step; border-left: 1px solid var(--border, #2d3a4d); margin-left: 12px; }
    .guide-step:last-child { border-left-color: transparent; }
    .guide-step::before { content: counter(guide-step); position: absolute; left: -10px; top: 8px; width: 20px; height: 20px; border-radius: 50%; background: var(--bg-elevated, #1c242e); border: 1px solid var(--border-strong, #4a5a70); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--muted, #8b9caf); }

    .guide-link { display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; padding: 14px 28px; background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%); border: none; border-radius: var(--radius-md, 8px); font-size: 15px; font-weight: 700; color: #1a1a1a; cursor: pointer; text-decoration: none; transition: all 0.2s ease; box-shadow: 0 3px 12px rgba(255, 165, 0, 0.35); width: 100%; }
    .guide-link:hover { background: linear-gradient(135deg, #FFE44D 0%, #FFB833 50%, #FFA000 100%); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255, 165, 0, 0.5); color: #1a1a1a; }

    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--text, #e8ecf1); }
    .form-input { width: 100%; padding: 10px 12px; background: var(--bg-elevated, #1c242e); border: 1px solid var(--border, #2d3a4d); border-radius: var(--radius-md, 8px); font-size: 13px; font-family: var(--mono, monospace); color: var(--text, #e8ecf1); box-sizing: border-box; transition: border-color 0.12s; }
    .form-input:focus { outline: none; border-color: var(--accent, #6c8cff); box-shadow: 0 0 0 3px rgba(108,140,255, 0.12); }
    .form-hint { font-size: 11px; color: var(--muted, #8b9caf); margin-top: 4px; }

    .detecting-state { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 40px 0; }
    .spinner { width: 32px; height: 32px; border: 2px solid var(--border, #2d3a4d); border-top-color: var(--accent, #6c8cff); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .detecting-text { font-size: 14px; color: var(--muted, #8b9caf); }

    .result-state { text-align: center; padding: 24px 0; }
    .result-icon { font-size: 40px; margin-bottom: 16px; }
    .result-title { font-size: 16px; font-weight: 600; color: var(--text-strong, #fff); margin-bottom: 8px; }
    .result-desc { font-size: 13px; color: var(--muted, #8b9caf); margin-bottom: 20px; }
    .result-caps { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
    .result-cap { display: flex; align-items: center; gap: 4px; padding: 4px 12px; background: var(--ok-subtle, rgba(52,211,153,.1)); border: 1px solid rgba(52,211,153,.2); border-radius: var(--radius-sm, 6px); font-size: 12px; color: var(--ok, #34d399); }

    .btn-row { display: flex; gap: 8px; margin-top: 20px; }
    .btn { flex: 1; padding: 9px 16px; border: none; border-radius: var(--radius-md, 8px); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.12s; }
    .btn--primary { background: var(--text-strong, #fff); color: var(--bg, #0f1419); }
    .btn--primary:hover { opacity: 0.9; }
    .btn--primary:disabled { opacity: 0.3; cursor: not-allowed; }
    .btn--ghost { background: transparent; color: var(--text, #e8ecf1); border: 1px solid var(--border, #2d3a4d); }
    .btn--ghost:hover { border-color: var(--border-strong, #4a5a70); }
    .btn--danger { background: var(--danger-subtle, rgba(248,113,113,.15)); color: var(--danger, #f87171); border: 1px solid rgba(248,113,113,.3); }
    .btn--danger:hover { background: rgba(248,113,113,.25); }
    .btn--danger:disabled { opacity: 0.3; cursor: not-allowed; }

    .alert { padding: 10px 14px; border-radius: var(--radius-md, 8px); margin-top: 12px; font-size: 13px; font-weight: 500; }
    .alert--err { background: var(--danger-subtle, rgba(248,113,113,.15)); color: var(--danger, #f87171); }

    .loading-state, .error-state { text-align: center; padding: 80px 24px; }
    .loading-state { color: var(--muted, #8b9caf); font-size: 14px; }
    .error-state { color: var(--danger, #f87171); font-size: 14px; }

    /* ═══════ MANAGE MODAL ═══════ */
    .manage-row { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .manage-label { font-size: 12px; font-weight: 600; color: var(--muted, #8b9caf); width: 70px; flex-shrink: 0; }
    .manage-value { font-size: 13px; font-family: var(--mono, monospace); color: var(--text, #e8ecf1); flex: 1; word-break: break-all; }
    .manage-caps { display: flex; gap: 4px; flex-wrap: wrap; }
    .manage-divider { border: none; border-top: 1px solid var(--border, #2d3a4d); margin: 20px 0; }
    .manage-danger-zone { padding: 16px; background: rgba(248,113,113,.05); border: 1px solid rgba(248,113,113,.15); border-radius: var(--radius-md, 8px); }
    .manage-danger-title { font-size: 13px; font-weight: 600; color: var(--danger, #f87171); margin-bottom: 8px; }
    .manage-danger-desc { font-size: 12px; color: var(--muted, #8b9caf); margin-bottom: 12px; }

    /* ═══════ ADD CUSTOM MODEL ═══════ */
    .add-model-section { padding: 16px; background: var(--surface-elevated, #1a2233); border: 1px solid var(--border, #2d3a4d); border-radius: var(--radius-md, 8px); }
    .add-model-title { font-size: 13px; font-weight: 600; color: var(--text, #e8ecf1); margin-bottom: 4px; }
    .add-model-desc { font-size: 12px; color: var(--muted, #8b9caf); margin-bottom: 12px; }
    .add-model-row { display: flex; gap: 8px; align-items: center; }
    .add-model-input {
      flex: 1; padding: 7px 12px; font-size: 13px; font-family: var(--mono, monospace);
      background: var(--bg, #0f1724); color: var(--text, #e8ecf1);
      border: 1px solid var(--border, #2d3a4d); border-radius: var(--radius-sm, 6px);
      outline: none; transition: border-color 0.15s;
    }
    .add-model-input::selection { background: var(--accent, #6c8cff); color: #fff; }
    .add-model-input:focus { border-color: var(--accent, #6c8cff); }
    .add-model-input:disabled { opacity: 0.5; cursor: not-allowed; }
    .add-model-input::placeholder { color: var(--muted, #8b9caf); opacity: 0.6; }
    .add-model-btn { flex-shrink: 0; min-width: 60px; }
    .add-model-msg { font-size: 12px; margin-top: 8px; padding: 6px 10px; border-radius: var(--radius-sm, 6px); }
    .add-model-msg--ok { background: rgba(74,222,128,.12); color: var(--ok, #4ade80); }
    .add-model-msg--warn { background: rgba(251,191,36,.12); color: #fbbf24; }
    .add-model-msg--err { background: var(--danger-subtle, rgba(248,113,113,.15)); color: var(--danger, #f87171); }

    /* ═══════ VOLCENGINE TABS ═══════ */
    .volc-tabs {
      display: flex; gap: 0; margin-bottom: 20px;
      border-bottom: 2px solid var(--border, #2d3a4d);
    }
    .volc-tab {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px 16px; border: none; background: none;
      font-size: 13px; font-weight: 600; cursor: pointer;
      color: var(--muted, #8b9caf);
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.15s ease;
    }
    .volc-tab:hover { color: var(--text, #e8ecf1); }
    .volc-tab.active {
      color: var(--accent, #6c8cff);
      border-bottom-color: var(--accent, #6c8cff);
    }
    .volc-tab__icon { font-size: 15px; }

    /* ═══════ VOLCENGINE VOICE GUIDE ═══════ */
    .volc-voice-guide {
      margin-bottom: 20px; padding: 16px;
      background: var(--bg-elevated, #1c242e);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-md, 8px);
    }
    .volc-voice-guide__title {
      font-size: 14px; font-weight: 700;
      color: var(--text-strong, #fff);
      margin-bottom: 12px;
    }
    .volc-voice-guide__steps {
      list-style: none; counter-reset: vg-step;
      margin: 0; padding: 0;
    }
    .volc-voice-guide__steps li {
      counter-increment: vg-step;
      position: relative; padding-left: 30px;
      margin-bottom: 10px; font-size: 13px; line-height: 1.6;
      color: var(--text, #e8ecf1);
    }
    .volc-voice-guide__steps li::before {
      content: counter(vg-step);
      position: absolute; left: 0; top: 1px;
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--accent-subtle, rgba(108,140,255,.15));
      color: var(--accent, #6c8cff);
      font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .volc-voice-guide__steps a {
      color: var(--accent, #6c8cff); text-decoration: none;
    }
    .volc-voice-guide__steps a:hover { text-decoration: underline; }
    .volc-voice-guide__links {
      display: flex; gap: 16px; margin-top: 14px;
    }
    .volc-voice-guide__links a {
      font-size: 12px; font-weight: 600;
      color: var(--accent, #6c8cff); text-decoration: none;
    }
    .volc-voice-guide__links a:hover { text-decoration: underline; }

    .volc-voice-note {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 10px 14px; margin-top: 12px;
      background: var(--accent-subtle, rgba(108,140,255,.08));
      border: 1px solid rgba(108,140,255,.15);
      border-radius: var(--radius-md, 8px);
      font-size: 12px; color: var(--text, #e8ecf1); line-height: 1.5;
    }
    .volc-voice-note__icon { flex-shrink: 0; font-size: 14px; }

    .alert--ok {
      background: rgba(74,222,128,.12); color: var(--ok, #4ade80);
      padding: 10px 14px; border-radius: var(--radius-md, 8px);
      margin-top: 12px; font-size: 13px; font-weight: 500;
    }

    /* ═══════ FOCUS-VISIBLE ═══════ */
    .btn:focus-visible, .modal-close:focus-visible, .guide-link:focus-visible,
    .prov-group-header:focus-visible, .prov-row__btn:focus-visible,
    .add-model-input:focus-visible, .qs-more:focus-visible, .qs-item:focus-visible {
      outline: 2px solid var(--accent, #6c8cff); outline-offset: 2px;
    }

    /* ═══════ EMPTY PROVIDER ═══════ */
    .prov-empty {
      text-align: center; padding: 24px;
      font-size: 13px; color: var(--muted, #8b9caf);
      border: 1px dashed var(--border, #2d3a4d);
      border-radius: var(--radius-md, 8px);
    }

    /* ═══════ HEALTH BADGE ═══════ */
    .health-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; font-weight: 600; padding: 2px 8px;
      border-radius: 4px; flex-shrink: 0;
      border: 1px solid transparent;
    }
    .health-badge__dot {
      width: 6px; height: 6px; border-radius: 50%;
    }

    /* ═══════ DRAG HANDLE ═══════ */
    .drag-handle {
      cursor: grab; font-size: 14px; color: var(--muted, #8b9caf);
      padding: 4px; user-select: none; flex-shrink: 0;
      transition: color 0.12s; touch-action: none;
    }
    .drag-handle:hover { color: var(--text, #e8ecf1); }
    .drag-handle:active { cursor: grabbing; }

    .prov-row__rank {
      width: 22px; height: 22px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; flex-shrink: 0;
      background: var(--bg-elevated, #1c242e);
      border: 1px solid var(--border, #2d3a4d);
      color: var(--muted, #8b9caf);
    }

    /* Drag states */
    .prov-row.dragging { opacity: 0.4; }
    .prov-row.drag-over {
      border-color: var(--accent, #6c8cff);
      box-shadow: 0 0 0 1px var(--accent, #6c8cff);
    }

    /* ═══════ TEST CONNECTION ═══════ */
    .test-conn-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .test-conn-result {
      font-size: 12px; padding: 6px 10px; border-radius: var(--radius-sm, 6px); margin-top: 8px;
    }
    .test-conn-result--ok { background: rgba(74,222,128,.12); color: var(--ok, #4ade80); }
    .test-conn-result--err { background: var(--danger-subtle, rgba(248,113,113,.15)); color: var(--danger, #f87171); }

    /* ═══════ LOCAL ENGINE: DEVICE BAR ═══════ */
    .le-device-bar {
      margin: 20px 0 16px;
      padding: 14px 18px;
      background: var(--card, #1a2332);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-lg, 12px);
      animation: fade-in 0.3s ease-out;
    }
    .le-device-bar__header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .le-device-bar__title { font-size: 13px; font-weight: 600; color: var(--text-strong, #fff); }
    .le-device-bar__hw { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .le-device-bar__chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px; border-radius: 6px;
      font-size: 11px; background: var(--bg-elevated, #1c242e);
      border: 1px solid var(--border, #2d3a4d); color: var(--text, #e8ecf1);
    }
    .le-device-bar__chip.has-gpu { border-color: rgba(52,211,153,.3); background: rgba(52,211,153,.06); }
    .le-chip-icon { font-size: 13px; }
    .le-device-bar__stats { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .le-stat { font-size: 11px; color: var(--muted, #8b9caf); }
    .le-stat--running { color: var(--ok, #34d399); font-weight: 600; }
    .le-device-bar__btn {
      padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border, #2d3a4d);
      background: transparent; color: var(--text, #e8ecf1); font-size: 11px; cursor: pointer;
      transition: all 0.12s;
    }
    .le-device-bar__btn:hover { border-color: var(--accent, #6c8cff); color: var(--accent, #6c8cff); }
    .le-device-bar__btn--rec {
      background: var(--accent-subtle, rgba(108,140,255,.1));
      color: var(--accent, #6c8cff); border-color: rgba(108,140,255,.2);
    }
    .le-device-bar__btn--rec:hover { background: rgba(108,140,255,.18); }

    /* ═══════ LOCAL ENGINE: MODEL ROWS ═══════ */
    .le-tab-content { display: flex; flex-direction: column; gap: 6px; }
    .le-tab-empty { font-size: 11px; color: var(--muted, #8b9caf); padding: 10px 0; text-align: center; }
    .le-subcap-group { margin-bottom: 6px; }
    .le-subcap-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--muted, #8b9caf); padding: 6px 0 2px;
      border-bottom: 1px solid var(--border, #2d3a4d); margin-bottom: 2px;
    }
    .le-model-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: var(--radius-md, 8px);
      border: 1px solid var(--border, #2d3a4d); transition: border-color 0.12s;
    }
    .le-model-row:hover { border-color: var(--border-strong, #4a5a70); }
    .le-model-row--recommended { border-color: rgba(108,140,255,.2); }
    .le-model-row--running { border-color: rgba(52,211,153,.3); background: rgba(52,211,153,.04); }
    .le-model-row--unavailable { opacity: 0.5; }
    .le-model-row__main { flex: 1; min-width: 0; }
    .le-model-row__header { display: flex; align-items: center; gap: 6px; }
    .le-model-row__name { font-size: 12px; font-weight: 500; color: var(--text, #e8ecf1); }
    .le-model-row__desc { font-size: 11px; color: var(--muted, #8b9caf); margin-top: 2px; }
    .le-model-row__meta { display: flex; gap: 8px; font-size: 10px; color: var(--muted, #8b9caf); margin-top: 2px; }
    .le-model-row__action { flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
    .le-run-mode {
      font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .le-run-mode--gpu { background: rgba(52,211,153,.12); color: var(--ok, #34d399); }
    .le-run-mode--cpu { background: rgba(251,191,36,.12); color: #fbbf24; }
    .le-run-mode--online { background: rgba(108,140,255,.12); color: var(--accent, #6c8cff); }
    .le-badge-rec {
      font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
      background: var(--accent-subtle, rgba(108,140,255,.12)); color: var(--accent, #6c8cff);
    }
    .le-btn {
      padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border, #2d3a4d);
      background: transparent; color: var(--text, #e8ecf1); font-size: 11px; cursor: pointer;
      transition: all 0.12s;
    }
    .le-btn:hover { border-color: var(--border-strong, #4a5a70); }
    .le-btn--install { background: var(--accent-subtle, rgba(108,140,255,.1)); color: var(--accent, #6c8cff); border-color: rgba(108,140,255,.2); }
    .le-btn--install:hover { background: rgba(108,140,255,.18); }
    .le-btn--uninstall { color: var(--danger, #f87171); border-color: rgba(248,113,113,.2); }
    .le-btn--uninstall:hover { background: rgba(248,113,113,.08); }
    .le-btn--start { background: rgba(52,211,153,.08); color: var(--ok, #34d399); border-color: rgba(52,211,153,.2); }
    .le-btn--stop { color: var(--muted, #8b9caf); }
    .le-btn--rec { background: var(--accent-subtle, rgba(108,140,255,.1)); color: var(--accent, #6c8cff); border-color: rgba(108,140,255,.2); }
    .le-btn--lg { padding: 6px 16px; font-size: 12px; }
    .le-status-dot { width: 6px; height: 6px; border-radius: 50%; }
    .le-status-dot--running { background: var(--ok, #34d399); box-shadow: 0 0 4px rgba(52,211,153,.5); }
    .le-status-text { font-size: 11px; color: var(--muted, #8b9caf); }
    .le-status-text--running { color: var(--ok, #34d399); }
    .le-status-text--unavailable { color: var(--muted-strong, #6b7d91); }
    .le-installed-actions, .le-running-actions { display: flex; align-items: center; gap: 6px; }
    .le-install-progress { display: flex; flex-direction: column; gap: 4px; min-width: 100px; }
    .le-progress-bar { height: 4px; background: var(--border, #2d3a4d); border-radius: 2px; overflow: hidden; }
    .le-progress-bar__fill { height: 100%; background: var(--accent, #6c8cff); border-radius: 2px; transition: width 0.3s ease; }
    .le-progress-text { font-size: 10px; color: var(--muted, #8b9caf); }
    .le-rec-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 12px; margin-top: 8px;
      background: rgba(108,140,255,.06); border: 1px solid rgba(108,140,255,.15);
      border-radius: var(--radius-md, 8px);
    }
    .le-rec-banner__text { font-size: 12px; color: var(--text, #e8ecf1); }

    /* ═══════ LOCAL ENGINE: MANAGE MODAL ═══════ */
    .le-manage-modal { max-width: 640px; }
    .le-manage-body { display: flex; flex-direction: column; gap: 16px; }
    .le-manage-hw { padding: 12px; background: var(--bg-elevated, #1c242e); border-radius: var(--radius-md, 8px); }
    .le-manage-hw__title { font-size: 13px; font-weight: 600; color: var(--text-strong, #fff); margin-bottom: 8px; }
    .le-manage-hw__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
    .le-manage-hw__item { display: flex; gap: 6px; font-size: 12px; }
    .le-manage-hw__label { color: var(--muted, #8b9caf); min-width: 40px; }
    .le-manage-hw__value { color: var(--text, #e8ecf1); }
    .le-manage-hw__value--muted { color: var(--muted, #8b9caf); }
    .le-manage-hw__tiers { display: flex; gap: 8px; margin-top: 8px; }
    .le-tier-badge {
      font-size: 11px; padding: 2px 8px; border-radius: 4px;
      background: var(--bg, #0f1419); border: 1px solid var(--border, #2d3a4d);
      color: var(--muted, #8b9caf);
    }
    .le-manage-group { }
    .le-manage-group__title {
      font-size: 12px; font-weight: 600; color: var(--text, #e8ecf1);
      padding: 8px 0 4px; border-bottom: 1px solid var(--border, #2d3a4d); margin-bottom: 6px;
    }
    .le-global-rec {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 14px;
      background: linear-gradient(135deg, rgba(108,140,255,.08) 0%, rgba(52,211,153,.06) 100%);
      border: 1px solid rgba(108,140,255,.2);
      border-radius: var(--radius-md, 8px);
    }
    .le-global-rec__info { flex: 1; }
    .le-global-rec__title { font-size: 13px; font-weight: 600; color: var(--text-strong, #fff); }
    .le-global-rec__desc { font-size: 11px; color: var(--muted, #8b9caf); margin-top: 2px; }
  `;

  /* ═══════ LIFECYCLE ═══════ */
  connectedCallback() {
    super.connectedCallback();
    globalThis.addEventListener("openclawcn:detect-progress", this._boundDetectProgress);
    globalThis.addEventListener("openclawcn:detect-complete", this._boundDetectComplete);
    globalThis.addEventListener("openclawcn:local-engine-progress", this._boundLeProgress);
    globalThis.addEventListener("openclawcn:voice-setup", this._boundVoiceSetup);
    if (this.client && this.connected) this._loadData();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    globalThis.removeEventListener("openclawcn:detect-progress", this._boundDetectProgress);
    globalThis.removeEventListener("openclawcn:detect-complete", this._boundDetectComplete);
    globalThis.removeEventListener("openclawcn:local-engine-progress", this._boundLeProgress);
    globalThis.removeEventListener("openclawcn:voice-setup", this._boundVoiceSetup);
    if (this._switchToastTimer) {
      clearTimeout(this._switchToastTimer);
      this._switchToastTimer = null;
    }
    // 清理检测计时器，防止组件卸载后继续触发
    if (this._s._detectElapsedTimer) {
      clearInterval(this._s._detectElapsedTimer);
      this._s._detectElapsedTimer = null;
    }
    if (this._s._detectTimeoutTimer) {
      clearTimeout(this._s._detectTimeoutTimer);
      this._s._detectTimeoutTimer = null;
    }
  }

  updated(changedProperties: Map<PropertyKey, unknown>) {
    super.updated(changedProperties);
    // 断线重连时重新加载数据
    if (changedProperties.has("connected") && !this.connected) {
      this._dataLoaded = false;
    }
    if (
      (changedProperties.has("client") || changedProperties.has("connected")) &&
      this.client && this.connected && !this._dataLoaded && !this._s.modelConfigLoading
    ) {
      this._loadData();
    }
  }

  /* ═══════ DATA ═══════ */
  private async _loadData() {
    const h = this._host();
    await Promise.all([
      loadCapabilities(h),
      loadProviders(h),
      loadProviderGroups(h),
      loadProviderHealth(h),
      loadProviderPriority(h),
    ]);
    this._dataLoaded = true;
    this._sync(h);
    // 异步加载本地引擎状态和记忆提取状态（不阻塞主数据加载）
    this._loadLocalEngine();
    this._loadExtractionStatus();
  }

  private async _loadExtractionStatus() {
    if (!this.client) return;
    try {
      const res = await this.client.request("capability_matrix.extractionStatus");
      this._extractionStatus = res as typeof this._extractionStatus;
    } catch { /* ignore */ }
  }

  private async _loadLocalEngine() {
    if (!this.client) return;
    this._le = { ...this._le, loading: true };
    try {
      const status = await fetchLocalEngineStatus(this.client as never);
      this._le = { ...this._le, loading: false, status, error: null };
    } catch {
      // 本地引擎未部署或不可用 — 静默忽略
      this._le = { ...this._le, loading: false };
    }
  }

  private _host() {
    return { ...this._s, client: this.client, connected: this.connected };
  }

  private _sync(h: ReturnType<typeof this._host>) {
    this._s = { ...h };
    this.requestUpdate();
  }

  /* ═══════ HANDLERS ═══════ */
  /** 能力卡点击 — 统一展开快速切换面板（active / inactive 都一样） */
  private async _onCapCardClick(userCap: UserCapDef) {
    // 如果已展开，点击关闭
    if (this._quickSwitchCap === userCap.id) {
      this._quickSwitchCap = null;
      this._quickSwitchModels = [];
      this._quickSwitchSubModels = new Map();
      this._quickSwitchError = null;
      return;
    }

    if (!this.client || !this.connected) return;

    this._quickSwitchCap = userCap.id;
    this._quickSwitchModels = [];
    this._quickSwitchSubModels = new Map();
    this._quickSwitchLoading = true;
    this._quickSwitchError = null;

    // embedding 卡片额外加载绑定状态和提取状态
    if (userCap.id === "embedding") {
      try {
        const [bindingRes, extractionRes] = await Promise.all([
          this.client!.request("capability_matrix.embeddingBinding").catch(() => null),
          this.client!.request("capability_matrix.extractionStatus").catch(() => null),
        ]);
        this._embeddingBinding = bindingRes as typeof this._embeddingBinding;
        this._extractionStatus = extractionRes as typeof this._extractionStatus;
      } catch { /* ignore */ }
    }

    const hasMultiSubs = userCap.subs.length > 1;

    if (hasMultiSubs) {
      // 多子能力：并行加载每个子能力的模型列表
      try {
        await Promise.all(userCap.subs.map(async (sub) => {
          // "记忆提取" 是虚拟子能力，不从 registry 查询模型
          if (sub.keys.includes("memoryExtraction")) {
            this._quickSwitchSubModels.set(sub.label, { cap: undefined, models: [] });
            return;
          }
          const cap = this._resolveSubCap(sub);
          if (!cap) {
            this._quickSwitchSubModels.set(sub.label, { cap: undefined, models: [] });
            return;
          }
          try {
            const result = await this.client!.request("capability_matrix.models", {
              capability: cap.capability,
            });
            const data = result as { models: ModelInfo[] };
            this._quickSwitchSubModels.set(sub.label, {
              cap,
              // [CN-PATCH] 过滤掉本地模型（provider=local），本版本暂不支持
              models: (data.models ?? []).filter(m => m.configured && m.providerId !== "local"),
            });
          } catch {
            this._quickSwitchSubModels.set(sub.label, { cap, models: [] });
          }
        }));
        // 触发 Map 变更检测
        this._quickSwitchSubModels = new Map(this._quickSwitchSubModels);
      } catch {
        this._quickSwitchError = "加载模型列表失败，请稍后重试";
      } finally {
        this._quickSwitchLoading = false;
      }
    } else {
      // 单能力：原有逻辑
      const matchedCap = userCap.caps
        .map(c => this._s.capabilities.find(cap => cap.capability === c))
        .find(c => c);

      if (!matchedCap) {
        this._quickSwitchLoading = false;
        return;
      }

      try {
        const result = await this.client.request("capability_matrix.models", {
          capability: matchedCap.capability,
        });
        const data = result as { models: ModelInfo[] };
        // [CN-PATCH] 过滤掉本地模型（provider=local），本版本暂不支持
        this._quickSwitchModels = (data.models ?? []).filter(m => m.configured && m.providerId !== "local");
      } catch {
        this._quickSwitchModels = [];
        this._quickSwitchError = "加载模型列表失败，请稍后重试";
      } finally {
        this._quickSwitchLoading = false;
      }
    }
  }

  /** 滚动到"添加更多服务商"区域 */
  private _scrollToAddProviders() {
    this._quickSwitchCap = null;
    this._quickSwitchModels = [];
    this._quickSwitchSubModels = new Map();
    const addSection = this.renderRoot?.querySelector('.add-section');
    if (addSection) {
      addSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * 通用模型切换核心逻辑 — _onModelSelect / _onQuickSwitch / _onQuickSwitchSub 共用。
   * @param capability 要切换的能力 key
   * @param m 目标模型
   * @param force 是否强制（跳过向量库重建确认）
   * @param onSuccess 切换成功后的回调（关闭面板等）
   * @param retryWithForce 需要重建确认时的重试函数
   */
  private async _doSwitchModel(
    capability: string,
    m: ModelInfo,
    force: boolean,
    onSuccess: () => Promise<void> | void,
    retryWithForce: () => Promise<void>,
  ) {
    this._switchingModelId = m.modelId;
    try {
      const result = await this.client!.request("capability_matrix.switchModel", {
        capability,
        providerId: m.providerId,
        modelId: m.modelId,
        force,
      });
      const data = result as { success: boolean; error?: string; requiresRebuild?: boolean };

      if (data.success) {
        await onSuccess();

        if (capability === "text") {
          globalThis.dispatchEvent?.(new CustomEvent("openclawcn:silent-new"));
        }
        this._showSwitchToast(m.modelName || m.modelId, m.providerName || m.providerId);
      } else if (data.requiresRebuild) {
        this._switchingModelId = null;
        const confirmed = confirm(`${data.error}\n\n确认切换并重建向量库？`);
        if (confirmed) await retryWithForce();
        return;
      } else {
        const h = this._host();
        h.modelConfigError = formatGeneralError(data.error, "模型切换").detail;
        this._sync(h);
      }
    } catch (err) {
      const h = this._host();
      h.modelConfigError = formatGeneralError(String(err), "模型切换").detail;
      this._sync(h);
    } finally {
      this._switchingModelId = null;
    }
  }

  private async _onModelSelect(m: ModelInfo, force?: boolean) {
    if (!m.configured || this._s.modelSelectorSwitching || !this.client) return;
    if (this._s.providerConfigDetecting) return;

    const cap = this._s.modelSelectorCapability;
    if (!cap) return;
    const oldKey = cap.currentModel ? `${cap.currentModel.providerId}/${cap.currentModel.modelId}` : "";
    if (oldKey === `${m.providerId}/${m.modelId}`) return;

    await this._doSwitchModel(
      cap.capability, m, !!force,
      async () => {
        const h = this._host();
        closeModelSelector(h);
        await loadCapabilities(h);
        this._sync(h);
      },
      () => this._onModelSelect(m, true),
    );
  }

  /** 快速切换：在能力卡内直接选模型 */
  private async _onQuickSwitch(userCap: UserCapDef, m: ModelInfo, force?: boolean) {
    if (!m.configured || this._switchingModelId) return;
    if (this._s.providerConfigDetecting) return;

    const activeCap = userCap.caps
      .map(c => this._s.capabilities.find(cap => cap.capability === c))
      .find(c => c);
    if (!activeCap || !this.client || !this.connected) return;

    const oldKey = activeCap.currentModel ? `${activeCap.currentModel.providerId}/${activeCap.currentModel.modelId}` : "";
    if (oldKey === `${m.providerId}/${m.modelId}`) return;

    await this._doSwitchModel(
      activeCap.capability, m, !!force,
      async () => {
        this._quickSwitchCap = null;
        this._quickSwitchModels = [];
        this._quickSwitchSubModels = new Map();
        const h = this._host();
        await loadCapabilities(h);
        this._sync(h);
      },
      () => this._onQuickSwitch(userCap, m, true),
    );
  }

  /** 快速切换：多子能力卡片内直接选模型（指定具体子能力） */
  private async _onQuickSwitchSub(cap: Capability, m: ModelInfo, force = false) {
    if (!m.configured || this._switchingModelId) return;
    if (!this.client || !this.connected) return;
    if (this._s.providerConfigDetecting) return;

    const oldKey = cap.currentModel ? `${cap.currentModel.providerId}/${cap.currentModel.modelId}` : "";
    if (oldKey === `${m.providerId}/${m.modelId}`) return;

    await this._doSwitchModel(
      cap.capability, m, force,
      async () => {
        this._quickSwitchCap = null;
        this._quickSwitchModels = [];
        this._quickSwitchSubModels = new Map();
        const h = this._host();
        await loadCapabilities(h);
        this._sync(h);
      },
      () => this._onQuickSwitchSub(cap, m, true),
    );
  }

  /** 从快速切换面板打开完整模型选择器弹窗 */
  private async _openFullModelSelector(userCap: UserCapDef, subIndex = 0) {
    this._quickSwitchCap = null;
    this._quickSwitchModels = [];

    // 重置筛选状态
    this._modelSelectorSearch = "";
    this._modelSelectorProviderFilter = null;
    this._modelSelectorContextFilter = null;
    this._modelSelectorStrengthFilter = null;
    this._modelSelectorActiveSubIndex = subIndex;
    this._modelSelectorUserCap = userCap;
    this._msProviderDropdownOpen = false;
    this._msUnconfiguredExpanded = false;

    // 对多子能力卡片，使用指定 sub 的 capability
    const targetSub = userCap.subs[subIndex] ?? userCap.subs[0];
    const matchedCap = targetSub
      ? targetSub.keys.map(k => this._s.capabilities.find(cap => cap.capability === k)).find(c => c)
      : userCap.caps.map(c => this._s.capabilities.find(cap => cap.capability === c)).find(c => c);
    if (matchedCap) {
      const h = this._host();
      await openModelSelector(h, matchedCap);
      this._sync(h);
    }
  }

  private _closeModelSelector() {
    const h = this._host();
    closeModelSelector(h);
    this._sync(h);
    this._modelSelectorUserCap = null;
    // 重置所有筛选状态，避免下次打开时残留
    this._modelSelectorSearch = "";
    this._modelSelectorProviderFilter = null;
    this._modelSelectorContextFilter = null;
    this._modelSelectorStrengthFilter = null;
    this._modelSelectorActiveSubIndex = 0;
    this._msProviderDropdownOpen = false;
    this._msUnconfiguredExpanded = false;
  }

  /** 模型选择器：切换子能力 tab */
  private async _onModelSelectorTabSwitch(subIndex: number) {
    if (!this._modelSelectorUserCap) return;
    this._modelSelectorActiveSubIndex = subIndex;
    this._modelSelectorSearch = "";
    this._modelSelectorProviderFilter = null;
    this._modelSelectorContextFilter = null;
    this._modelSelectorStrengthFilter = null;
    this._msProviderDropdownOpen = false;
    this._msUnconfiguredExpanded = false;

    const sub = this._modelSelectorUserCap.subs[subIndex];
    if (!sub) return;

    // 跳过虚拟 sub（如 memoryExtraction）
    if (sub.keys.includes("memoryExtraction")) return;

    const matchedCap = sub.keys
      .map(k => this._s.capabilities.find(cap => cap.capability === k))
      .find(c => c);
    if (matchedCap) {
      const h = this._host();
      await openModelSelector(h, matchedCap);
      this._sync(h);
    }
  }

  private _onProviderClick(p: ProviderInfo) {
    const h = this._host();
    openProviderConfig(h, p);
    this._sync(h);
  }

  private async _closeProviderConfig() {
    const h = this._host();
    const wasResult = h.providerConfigStep === "result";
    closeProviderConfig(h);
    this._sync(h);
    // 配置成功后关闭弹窗 → 刷新列表
    if (wasResult) {
      const h2 = this._host();
      await Promise.all([loadCapabilities(h2), loadProviders(h2), loadProviderPriority(h2), loadProviderHealth(h2)]).catch(() => {});
      this._sync(h2);
    }
  }

  private _cancelDetection() {
    const h = this._host();
    cancelDetection(h);
    this._sync(h);
  }

  private _onApiKeyInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const h = this._host();
    updateProviderApiKey(h, input.value);
    this._sync(h);
  }

  private _onCustomModelInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const h = this._host();
    updateProviderCustomModel(h, input.value);
    this._sync(h);
  }

  private _onBaseUrlInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const h = this._host();
    updateProviderBaseUrl(h, input.value);
    this._sync(h);
  }

  /** blur 时 trim 空格（处理粘贴带入的首尾空格） */
  private _onApiKeyBlur(e: Event) {
    const input = e.target as HTMLInputElement;
    const trimmed = input.value.trim();
    if (trimmed !== input.value) {
      input.value = trimmed;
      const h = this._host();
      updateProviderApiKey(h, trimmed);
      this._sync(h);
    }
  }

  private _onVolcAppIdInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const h = this._host();
    updateProviderVolcAppId(h, input.value);
    this._sync(h);
  }

  private _onVolcAccessTokenInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const h = this._host();
    updateProviderVolcAccessToken(h, input.value);
    this._sync(h);
  }

  private _onVolcTabSwitch(tab: "llm" | "voice") {
    const h = this._host();
    switchProviderVolcTab(h, tab);
    this._sync(h);
    // 切到语音 Tab 时加载已有凭证状态
    if (tab === "voice") {
      this._loadVolcCredsStatus();
    }
  }

  /** 加载火山引擎已保存凭证的脱敏状态 */
  private async _loadVolcCredsStatus() {
    if (!this.client) return;
    try {
      const res = await this.client.request("voice.volcengine.credentialsStatus", {}) as {
        configured: boolean; maskedAppId?: string; maskedToken?: string;
      };
      this._s = { ...this._s, providerConfigVolcCredsStatus: res };
      this.requestUpdate();
    } catch {
      // 静默失败，不影响使用
    }
  }

  /** 保存火山引擎语音凭证 */
  private async _onSaveVolcVoiceCredentials() {
    if (!this.client) return;
    const { providerConfigVolcAppId: appId, providerConfigVolcAccessToken: token, providerConfigVolcSaving: saving } = this._s;
    if (!appId?.trim() || !token?.trim() || saving) return;

    // APP ID 格式校验
    if (!/^\d+$/.test(appId.trim())) {
      this._s = { ...this._s, providerConfigTestResult: { success: false, message: "APP ID 应为纯数字，请检查是否粘贴正确" } };
      this.requestUpdate();
      return;
    }

    // 设置 loading 状态
    this._s = { ...this._s, providerConfigVolcSaving: true, providerConfigTestResult: null };
    this.requestUpdate();

    try {
      await this.client.request("voice.volcengine.saveCredentials", {
        appId: appId.trim(),
        accessToken: token.trim(),
      });
      // 刷新能力卡片状态
      const h = this._host();
      await loadCapabilities(h);
      this._sync(h);
      // 通知 app 重新检测 ASR/TTS 可用性（更新话筒按钮状态）
      globalThis.dispatchEvent(new CustomEvent("openclawcn:voice-credentials-changed"));
      // 显示成功提示 + 更新凭证状态
      this._s = {
        ...this._s,
        providerConfigVolcSaving: false,
        providerConfigTestResult: { success: true, message: "语音凭证保存成功，ASR/TTS 已启用" },
        providerConfigVolcCredsStatus: { configured: true },
      };
      this.requestUpdate();
    } catch (err) {
      this._s = {
        ...this._s,
        providerConfigVolcSaving: false,
        providerConfigTestResult: { success: false, message: `保存失败: ${String(err)}` },
      };
      this.requestUpdate();
    }
  }

  private _onConfigNextStep() {
    const h = this._host();
    providerConfigNextStep(h);
    this._sync(h);
  }

  private _onConfigPrevStep() {
    const h = this._host();
    providerConfigPrevStep(h);
    this._sync(h);
  }

  private async _onDetect() {
    const h = this._host();
    await detectAndConfigureProvider(h);
    this._sync(h);
  }

  private _onNavigateToProvider(providerId: string) {
    const h = this._host();
    navigateToProviderConfig(h, providerId);
    this._sync(h);
  }

  private _onToggleGroup(groupId: string) {
    const h = this._host();
    toggleProviderGroup(h, groupId);
    this._sync(h);
  }

  private _clearError() {
    this._s = { ...this._s, modelConfigError: null };
    this.requestUpdate();
  }

  /** 显示模型切换成功提示（首次响应可能稍慢） */
  private _showSwitchToast(model: string, provider: string) {
    if (this._switchToastTimer) clearTimeout(this._switchToastTimer);
    this._switchToast = { model, provider };
    this._switchToastTimer = setTimeout(() => {
      this._switchToast = null;
      this._switchToastTimer = null;
    }, 6000);
  }

  private _clearSwitchToast() {
    if (this._switchToastTimer) clearTimeout(this._switchToastTimer);
    this._switchToast = null;
    this._switchToastTimer = null;
  }

  /* ═══════ LOCAL ENGINE HANDLERS ═══════ */
  private _leActions: LocalModelAction = {
    onInstall: (modelId: string) => this._leInstallModel(modelId),
    onUninstall: (modelId: string) => this._leUninstallModel(modelId),
    onStartSidecar: (domain: "voice" | "imagegen") => this._leStartSidecar(domain),
    onStopSidecar: (domain: "voice" | "imagegen") => this._leStopSidecar(domain),
    onRedetect: () => this._leRedetect(),
    onInstallRecommended: () => this._leInstallRecommended(),
    onOpenManageModal: () => { this._leManageOpen = true; },
  };

  private async _leInstallModel(modelId: string) {
    if (!this.client) return;
    try {
      await installModel(this.client as never, modelId);
    } catch (err) {
      this._le = { ...this._le, error: formatGeneralError(String(err), "模型安装").detail };
    }
  }

  private async _leUninstallModel(modelId: string) {
    if (!this.client) return;
    try {
      await uninstallModel(this.client as never, modelId);
      await this._loadLocalEngine();
    } catch (err) {
      this._le = { ...this._le, error: formatGeneralError(String(err), "模型卸载").detail };
    }
  }

  private async _leStartSidecar(domain: "voice" | "imagegen") {
    if (!this.client) return;
    try {
      await startSidecar(this.client as never, domain);
      await this._loadLocalEngine();
    } catch (err) {
      this._le = { ...this._le, error: formatGeneralError(String(err), "引擎启动").detail };
    }
  }

  private async _leStopSidecar(domain: "voice" | "imagegen") {
    if (!this.client) return;
    try {
      await stopSidecar(this.client as never, domain);
      await this._loadLocalEngine();
    } catch (err) {
      this._le = { ...this._le, error: formatGeneralError(String(err), "引擎停止").detail };
    }
  }

  private async _leRedetect() {
    if (!this.client) return;
    try {
      await redetectHardware(this.client as never);
      await this._loadLocalEngine();
    } catch (err) {
      this._le = { ...this._le, error: formatGeneralError(String(err), "硬件检测").detail };
    }
  }

  private async _leInstallRecommended() {
    if (!this.client) return;
    try {
      await installRecommended(this.client as never);
    } catch (err) {
      this._le = { ...this._le, error: formatGeneralError(String(err), "模型安装").detail };
    }
  }

  /** 关闭 provider 配置并刷新数据 */
  private async _closeProviderConfigAndRefresh() {
    const h = this._host();
    closeProviderConfig(h);
    this._sync(h);
    const h2 = this._host();
    await Promise.all([loadCapabilities(h2), loadProviders(h2)]).catch(() => {});
    this._sync(h2);
  }

  /** 关闭配置弹窗并滚动到"添加更多服务商" */
  private async _closeAndAddMore() {
    await this._closeProviderConfigAndRefresh();
    await this.updateComplete;
    this.shadowRoot?.querySelector('.add-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  /** 快速配置（新手横幅用） */
  private _onQuickSetup(providerId: string) {
    const provider = this._s.providers.find(p => p.providerId === providerId);
    if (provider) {
      const h = this._host();
      openProviderConfig(h, provider);
      // 跳过 guide，直接到 apikey 步骤
      h.providerConfigStep = "apikey";
      this._sync(h);
    }
  }

  /** 打开管理弹窗 */
  private async _onManageProvider(p: ProviderInfo) {
    const h = this._host();
    await openProviderManage(h, p);
    this._sync(h);
  }

  private _closeManage() {
    const h = this._host();
    closeProviderManage(h);
    h.providerTestResult = null;
    h.providerTestingId = null;
    this._sync(h);
    this._deleteConfirm = false;
    this._addModelId = "";
    this._addModelLoading = false;
    this._addModelMsg = null;
  }

  /** 重新配置（管理弹窗内） */
  private _onReconfigure(p: ProviderInfo) {
    this._closeManage();
    this._onProviderClick(p);
  }

  /** 删除 provider */
  private async _onDeleteProvider(providerId: string) {
    if (!this._deleteConfirm) {
      this._deleteConfirm = true;
      return;
    }
    const h = this._host();
    await deleteProviderConfig(h, providerId);
    // 成功时 controller 已关闭弹窗；失败时弹窗保持打开，错误显示在 providerManageError
    this._deleteConfirm = false;
    this._addModelId = "";
    this._addModelMsg = null;
    this._addModelLoading = false;
    this._sync(h);
  }

  /** 模型 ID 格式校验：只允许字母、数字、-_./:@ */
  private static readonly MODEL_ID_RE = /^[a-zA-Z0-9\-_.\/:@]+$/;
  /** 特定厂商的模型 ID 格式提示 */
  private static readonly PROVIDER_MODEL_HINTS: Record<string, { pattern?: RegExp; hint: string }> = {
    "volcengine-ark": { pattern: /^ep-/, hint: "火山引擎/豆包模型 ID 应以 ep- 开头（如 ep-20240901xxxxx）" },
  };

  /** 前端格式校验 */
  private _validateModelId(modelId: string, providerId: string): string | null {
    if (!modelId) return "模型 ID 不能为空";
    if (modelId.length > 200) return "模型 ID 过长（最多 200 字符）";
    if (!ModelConfigView.MODEL_ID_RE.test(modelId)) {
      return "模型 ID 只能包含字母、数字、-_./: 等字符，不能有空格或特殊符号";
    }
    const provHint = ModelConfigView.PROVIDER_MODEL_HINTS[providerId];
    if (provHint?.pattern && !provHint.pattern.test(modelId)) {
      return provHint.hint;
    }
    return null;
  }

  /** 手动添加模型 */
  private async _onAddModel(providerId: string) {
    this._deleteConfirm = false; // 重置删除确认状态
    const modelId = this._addModelId.trim();
    if (!modelId || !this.client || !this.connected) return;

    // 前端格式校验
    const fmtErr = this._validateModelId(modelId, providerId);
    if (fmtErr) {
      this._addModelMsg = { type: "err", text: fmtErr };
      return;
    }

    this._addModelLoading = true;
    this._addModelMsg = null;

    try {
      const result = await this.client.request("capability_matrix.provider.addModel", {
        providerId,
        modelId,
      }) as { success?: boolean; probeWarning?: string };
      if (result.success) {
        if (result.probeWarning) {
          this._addModelMsg = { type: "warn", text: `已添加模型 "${modelId}"（注意: ${result.probeWarning}）` };
        } else {
          this._addModelMsg = { type: "ok", text: `已添加模型 "${modelId}"` };
        }
        this._addModelId = "";
        // 刷新数据
        const h = this._host();
        await Promise.all([loadCapabilities(h), loadProviders(h)]);
        this._sync(h);
      } else {
        // [CN-PATCH] 服务端返回 success=false 但没抛异常 — 显示错误信息
        this._addModelMsg = { type: "err", text: (result as { error?: string }).error || "添加失败，请稍后重试" };
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      // 去掉可能残留的 "Error: " 前缀
      const friendly = raw.replace(/^Error:\s*/i, "").trim() || "添加失败，请稍后重试";
      this._addModelMsg = { type: "err", text: friendly };
    } finally {
      this._addModelLoading = false;
    }
  }

  /** 根据 provider 返回添加模型的说明文案 */
  private _getAddModelDesc(providerId: string): string {
    const map: Record<string, string> = {
      "volcengine-ark": "输入你在火山引擎创建的接入点 ID（ep-xxx），需先在控制台开通模型",
      "aliyun-bailian": "输入该服务商支持的模型 ID（如 qwen-max、qwen-turbo-latest 等）",
      "kimi-code": "输入 Kimi 支持的模型 ID（如 kimi-k2-0711-chat）",
    };
    return map[providerId] ?? "输入该服务商支持的模型 ID，添加后会自动验证可用性";
  }

  /** 根据 provider 返回输入框占位符 */
  private _getAddModelPlaceholder(providerId: string): string {
    const map: Record<string, string> = {
      "volcengine-ark": "接入点 ID，如 ep-20240901xxxxx",
      "aliyun-bailian": "模型 ID，如 qwen-turbo-latest",
      "deepseek": "模型 ID，如 deepseek-chat",
      "kimi-code": "模型 ID，如 kimi-k2-0711-chat",
      "siliconflow": "模型 ID，如 Qwen/Qwen3-8B",
      "zhipu": "模型 ID，如 glm-4-flash",
    };
    return map[providerId] ?? "模型 ID，如 model-name";
  }

  /**
   * 指针拖拽排序 — pointerdown/move/up（WebView2 兼容）
   * 整行可拖，但点击按钮不会触发拖拽（移动阈值 5px）
   */
  private _onPointerDragStart(e: PointerEvent, index: number) {
    if (e.button !== 0) return;
    // 如果点击的是按钮/链接等交互元素，不触发拖拽
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea")) return;

    const row = e.currentTarget as HTMLElement;
    if (!row) return;

    const startY = e.clientY;
    const startX = e.clientX;
    const rect = row.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    let dragging = false;

    // 收集所有行
    const list = row.parentElement;
    const rows = list ? Array.from(list.querySelectorAll<HTMLElement>(".prov-row")) : [];

    const onMove = (ev: PointerEvent) => {
      const dy = Math.abs(ev.clientY - startY);
      const dx = Math.abs(ev.clientX - startX);

      // 移动阈值：超过 5px 才开始拖拽，避免点击误触
      if (!dragging && dy < 5 && dx < 5) return;

      if (!dragging) {
        // 首次超过阈值 → 开始拖拽
        dragging = true;
        this._dragFromIndex = index;
        this._dragRows = rows;
        this._dragOffsetY = offsetY;

        // 创建浮动克隆
        const clone = row.cloneNode(true) as HTMLElement;
        clone.style.cssText = `position:fixed;left:${rect.left}px;top:${ev.clientY - offsetY}px;width:${rect.width}px;z-index:10000;pointer-events:none;opacity:0.85;box-shadow:0 8px 24px rgba(0,0,0,.3);transition:none;`;
        (this.shadowRoot ?? this).appendChild(clone);
        this._dragClone = clone;
        row.classList.add("dragging");
      }

      // 移动克隆
      if (this._dragClone) {
        this._dragClone.style.top = `${ev.clientY - offsetY}px`;
      }
      // 命中检测
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect();
        if (ev.clientY >= r.top && ev.clientY <= r.bottom) {
          if (this._dragOverIndex !== i) this._dragOverIndex = i;
          break;
        }
      }
    };

    const onUp = async (_ev: PointerEvent) => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);

      if (!dragging) return; // 没超过阈值 = 普通点击，不处理

      // 清理
      if (this._dragClone) { this._dragClone.remove(); this._dragClone = null; }
      for (const r of rows) r.classList.remove("dragging");

      const fromIdx = this._dragFromIndex;
      const toIdx = this._dragOverIndex;
      this._dragFromIndex = null;
      this._dragOverIndex = null;
      this._dragRows = [];

      if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;

      const configured = this._getConfiguredSorted();
      const newOrder = [...configured];
      const [moved] = newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, moved);

      const priority = newOrder.map(p => p.providerId);
      const h = this._host();
      await saveProviderPriority(h, priority);
      this._sync(h);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  /** 测试连接 */
  private async _onTestConnection(providerId: string) {
    this._deleteConfirm = false; // 重置删除确认状态
    const h = this._host();
    await testProviderConnection(h, providerId);
    this._sync(h);
  }

  private _onModalKeydown(e: KeyboardEvent, closeHandler: () => void, blockClose = false) {
    if (e.key === "Escape" && !blockClose) {
      e.stopPropagation();
      closeHandler();
    }
  }

  /* ═══════ HELPERS ═══════ */
  private _getUserCapModels(userCap: UserCapDef) {
    return userCap.caps
      .map(c => this._s.capabilities.find(cap => cap.capability === c))
      .filter((c): c is Capability => !!c);
  }

  /** 解析单个子能力的 Capability 对象（匹配 keys 中第一个命中的） */
  private _resolveSubCap(sub: SubCapDef): Capability | undefined {
    for (const key of sub.keys) {
      const found = this._s.capabilities.find(cap => cap.capability === key);
      if (found) return found;
    }
    return undefined;
  }

  private _isUserCapActive(userCap: UserCapDef): boolean {
    return this._getUserCapModels(userCap).some(c => c.status === "active");
  }

  /** 获取当前激活模型的 strengthTier（用于卡片边框颜色） */
  private _getCapStrengthTier(userCap: UserCapDef): string | undefined {
    for (const sub of userCap.subs) {
      const cap = this._resolveSubCap(sub);
      if (cap?.status === "active" && cap.currentModel?.strengthTier) {
        return cap.currentModel.strengthTier;
      }
    }
    return undefined;
  }

  private _isAllInactive(): boolean {
    return this._s.capabilities.length > 0 && this._s.capabilities.every(c => c.status === "inactive");
  }

  /** 模型选择器：应用搜索和筛选 */
  private _getFilteredModels(models: ModelInfo[]): ModelInfo[] {
    // [CN-PATCH] 过滤掉本地模型（provider=local），本版本暂不支持
    let filtered = models.filter(m => m.providerId !== "local");
    const search = this._modelSelectorSearch.toLowerCase().trim();
    if (search) {
      filtered = filtered.filter(m =>
        (m.modelName ?? "").toLowerCase().includes(search) ||
        (m.modelId ?? "").toLowerCase().includes(search) ||
        (m.providerName ?? "").toLowerCase().includes(search)
      );
    }
    if (this._modelSelectorProviderFilter) {
      filtered = filtered.filter(m => m.providerId === this._modelSelectorProviderFilter);
    }
    if (this._modelSelectorContextFilter) {
      filtered = filtered.filter(m => (m.maxContextTokens ?? 0) >= this._modelSelectorContextFilter!);
    }
    if (this._modelSelectorStrengthFilter) {
      filtered = filtered.filter(m => m.strengthTier === this._modelSelectorStrengthFilter);
    }
    return filtered;
  }

  /** 格式化 context token 数 */
  private _formatContextTokens(tokens?: number): string {
    if (!tokens) return "";
    if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M`;
    if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
    return String(tokens);
  }

  private _groupModelsByProvider(models: ModelInfo[]) {
    const groups = new Map<string, { providerId: string; providerName: string; providerIcon: string; configured: boolean; isCurrent: boolean; models: ModelInfo[] }>();
    for (const m of models) {
      if (!groups.has(m.providerId)) {
        groups.set(m.providerId, { providerId: m.providerId, providerName: m.providerName, providerIcon: m.providerIcon, configured: m.configured, isCurrent: false, models: [] });
      }
      const g = groups.get(m.providerId)!;
      g.models.push(m);
      if (m.active) g.isCurrent = true;
      if (m.configured) g.configured = true;
    }
    return [...groups.values()].sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      if (a.configured && !b.configured) return -1;
      if (!a.configured && b.configured) return 1;
      return 0;
    });
  }

  /** 获取已配置 provider 列表（按优先级排序） */
  private _getConfiguredSorted(): ProviderInfo[] {
    const configured = this._s.providers.filter(p => p.configured);
    const priority = this._s.providerPriority;
    if (priority.length === 0) return configured;
    return configured.sort((a, b) => {
      const ai = priority.indexOf(a.providerId);
      const bi = priority.indexOf(b.providerId);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }

  /** 数据是否已加载（capabilities + providers 都有数据） */
  private get _hasData(): boolean {
    return this._s.capabilities.length > 0 && this._s.providers.length > 0;
  }

  /* ═══════ RENDER ═══════ */
  render() {
    if (this._s.modelConfigLoading)
      return html`<div class="loading-state">加载中...</div>`;
    if (!this._hasData && !this.connected)
      return html`<div class="error-state">未连接到 Gateway，请检查服务是否启动</div>`;
    if (this._s.modelConfigError && this._s.capabilities.length === 0)
      return html`<div class="error-state">${this._s.modelConfigError}</div>`;
    if (!this._hasData)
      return html`<div class="loading-state">正在加载数据...</div>`;

    return html`
      <div class="mc-scroll">
        ${this._s.modelConfigError ? html`
          <div class="error-toast">
            <span class="error-toast__msg">${this._s.modelConfigError}</span>
            <button class="error-toast__close" @click=${() => this._clearError()}>&times;</button>
          </div>
        ` : nothing}

        ${this._switchToast ? html`
          <div class="info-toast">
            <span class="info-toast__icon">&#x2139;</span>
            <span class="info-toast__msg">
              已切换到 <span class="info-toast__model">${this._switchToast.provider} / ${this._switchToast.model}</span>，首次响应可能稍慢
            </span>
            <button class="info-toast__close" @click=${() => this._clearSwitchToast()}>&times;</button>
          </div>
        ` : nothing}

        ${this._renderOnboarding()}
        ${this._renderCapabilities()}

        ${/* [CN-PATCH] 本地模型暂时隐藏，后续版本恢复 */
          html`<hr class="section-divider" />`}

        ${this._renderMyProviders()}
        ${this._renderEssentialBanner()}
        ${this._renderAddProviders()}
      </div>

      ${this._s.modelSelectorOpen ? this._renderModelSelector() : nothing}
      ${this._s.providerConfigOpen ? this._renderProviderConfig() : nothing}
      ${this._s.providerManageOpen ? this._renderManageModal() : nothing}
      ${/* [CN-PATCH] 本地模型管理弹窗暂时隐藏，后续版本恢复 */ nothing}
    `;
  }

  /* ═══════ ONBOARDING BANNER ═══════ */
  private _renderOnboarding() {
    if (!this._isAllInactive()) return nothing;

    const quickProvider = this._s.providers.find(p => p.providerId === QUICK_SETUP_PROVIDER);
    const unconfiguredEssentials = ESSENTIAL_PROVIDERS
      .map(id => this._s.providers.find(p => p.providerId === id))
      .filter((p): p is ProviderInfo => !!p && !p.configured);
    const quickConfigured = quickProvider?.configured;
    const allEssentialConfigured = unconfiguredEssentials.length === 0;

    if (quickConfigured && allEssentialConfigured) return nothing;

    return html`
      <div class="onboarding">
        <div class="onboarding__title">开始使用 AI</div>

        ${!quickConfigured && quickProvider ? html`
          <div class="onboarding__step">
            <div class="onboarding__step-label">第 1 步：配置聊天能力</div>
            <div class="onboarding__step-desc">
              推荐 <strong>${quickProvider.name}</strong>（免费、无需实名、即刻可用）
            </div>
            <button class="btn btn--primary" @click=${() => this._onQuickSetup(QUICK_SETUP_PROVIDER)}>
              一键配置 ${quickProvider.name}
            </button>
          </div>
        ` : nothing}

        ${!allEssentialConfigured ? html`
          <div class="onboarding__step">
            <div class="onboarding__step-label">${!quickConfigured ? '第 2 步：' : ''}解锁 AI 记忆（必需）</div>
            <div class="onboarding__step-desc">
              以下服务为记忆系统提供免费额度，不配置会消耗你主力模型的付费额度。全部免费，注册即用。
            </div>
            <div class="onboarding__essential-list">
              ${unconfiguredEssentials.map(ep => html`
                <button class="btn btn--primary" @click=${() => this._onQuickSetup(ep.providerId)}>
                  配置${ep.name}（免费）
                </button>
              `)}
            </div>
          </div>
        ` : nothing}

        <div class="onboarding__actions">
          <button class="btn btn--ghost" @click=${() => this.shadowRoot?.querySelector('.add-section')?.scrollIntoView({ behavior: 'smooth' })}>
            查看所有服务商
          </button>
        </div>
      </div>
    `;
  }

  /* ═══════ ESSENTIAL PROVIDER BANNER ═══════ */
  private _renderEssentialBanner() {
    const unconfigured = ESSENTIAL_PROVIDERS
      .map(id => this._s.providers.find(p => p.providerId === id))
      .filter((p): p is ProviderInfo => !!p && !p.configured);

    if (unconfigured.length === 0) return nothing;

    // 每个 provider 解释其角色
    const roleMap: Record<string, string> = {
      siliconflow: "向量搜索和记忆存储",
      "meituan-longcat": "记忆提取（主力）",
      "ant-ling": "记忆提取（备选）",
    };

    return html`
      ${unconfigured.map(ep => html`
        <div class="sf-banner">
          <div class="sf-banner__icon">${ep.icon}</div>
          <div class="sf-banner__body">
            <div class="sf-banner__title">请配置${ep.name}（必需）</div>
            <div class="sf-banner__desc">${roleMap[ep.providerId] ?? "记忆系统"}依赖此服务 — 完全免费，不配置会消耗你主力模型额度</div>
          </div>
          <button class="btn btn--primary" @click=${() => this._onQuickSetup(ep.providerId)}>立即配置</button>
        </div>
      `)}
    `;
  }

  /* ═══════ CAPABILITY CARDS ═══════ */
  private _renderCapabilities() {
    return html`
      <p class="section-label">我的 AI 能力</p>
      <div class="cap-grid">
        ${USER_CAPABILITIES.map(uc => this._renderCapCard(uc))}
      </div>
    `;
  }

  private _renderCapCard(userCap: UserCapDef) {
    const active = this._isUserCapActive(userCap);
    const expanded = this._quickSwitchCap === userCap.id;
    const hasMultiSubs = userCap.subs.length > 1;
    const tier = active ? this._getCapStrengthTier(userCap) : undefined;
    const tierClass = tier === "weak" ? "tier-weak" : tier === "moderate" ? "tier-moderate" : "";

    return html`
      <div class="cap-card ${active ? 'active' : 'inactive'} ${expanded ? 'expanded' : ''} ${tierClass}">
        <div
          class="cap-card__clickable"
          tabindex="0" role="button"
          @click=${() => this._onCapCardClick(userCap)}
          @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this._onCapCardClick(userCap); }}
        >
          <div class="cap-card__head">
            <div class="cap-card__icon">${userCap.icon}</div>
            <div class="cap-card__name">${userCap.name}</div>
            <div class="cap-card__dot ${active ? 'on' : 'off'}"></div>
          </div>
          ${hasMultiSubs
            ? this._renderMultiSubStatus(userCap)
            : this._renderSingleSubStatus(userCap)}
          <div class="cap-card__action">${expanded ? '收起 ‹' : (active ? '切换模型 ›' : '查看模型 ›')}</div>
        </div>
        ${expanded ? this._renderQuickSwitch(userCap, undefined, active) : nothing}
      </div>
    `;
  }

  /** 单能力卡片的状态渲染（聊天、编程、推荐） */
  private _renderSingleSubStatus(userCap: UserCapDef) {
    const cap = this._resolveSubCap(userCap.subs[0]);
    if (cap?.status === "active" && cap.currentModel) {
      const tier = cap.currentModel.strengthTier;
      return html`
        <div class="cap-card__model">${cap.currentModel.modelName}</div>
        <div class="cap-card__provider">${cap.currentModel.providerName}</div>
        ${tier === "weak" ? html`
          <div class="strength-warn strength-warn--weak">
            <span class="strength-warn__icon">!</span>
            <span class="strength-warn__text">
              模型能力较弱，建议切换到
              <span class="strength-warn__recommend">DeepSeek V3</span> 等主流模型
            </span>
          </div>
        ` : tier === "moderate" ? html`
          <div class="strength-warn strength-warn--moderate">
            <span class="strength-warn__icon">i</span>
            <span class="strength-warn__text">中等模型，复杂任务可能力不从心</span>
          </div>
        ` : nothing}
      `;
    }
    return html`<div class="cap-card__empty">未开通</div>`;
  }

  /** 多能力卡片的子能力状态渲染（图片、视频、语音、记忆） */
  private _renderMultiSubStatus(userCap: UserCapDef) {
    return html`
      <div class="cap-card__subs">
        ${userCap.subs.map(sub => {
          // "记忆提取" 虚拟子能力 — 使用 _extractionStatus 而非 registry
          if (sub.keys.includes("memoryExtraction")) {
            const ext = this._extractionStatus;
            const extActive = ext?.status === "active";
            const PROVIDER_NAMES: Record<string, string> = {
              "meituan-longcat": "美团", "ant-ling": "蚂蚁百灵",
              siliconflow: "硅基流动", modelscope: "魔搭",
              deepseek: "深度求索", moonshot: "月之暗面",
              "kimi-coding": "Kimi", "qwen-dashscope": "通义千问",
              glm: "智谱", zhipu: "智谱", doubao: "豆包",
              "tencent-hunyuan": "腾讯混元", openai: "OpenAI",
              groq: "Groq", together: "Together",
            };
            let modelLabel = "";
            if (extActive && ext) {
              const provLabel = PROVIDER_NAMES[ext.provider!] ?? ext.provider ?? "";
              // 如果是主聊天模型（非免费提取专用 provider），显示"跟随主模型"
              const FREE_EXTRACTION_PROVIDERS = new Set([
                "meituan-longcat", "ant-ling", "siliconflow", "modelscope",
              ]);
              const isMainModel = ext.provider && !FREE_EXTRACTION_PROVIDERS.has(ext.provider);
              modelLabel = isMainModel
                ? `${ext.model}（跟随主模型）`
                : `${ext.model}（${provLabel}）`;
            }
            return html`
              <div class="cap-card__sub">
                <span class="cap-card__sub-dot ${extActive ? 'on' : 'off'}"></span>
                <span class="cap-card__sub-label">${sub.label}</span>
                ${extActive
                  ? html`<span class="cap-card__sub-model">${modelLabel}</span>`
                  : html`<span class="cap-card__sub-model cap-card__sub-model--off">未配置</span>`}
              </div>
            `;
          }
          const cap = this._resolveSubCap(sub);
          const subActive = cap?.status === "active" && cap.currentModel;
          return html`
            <div class="cap-card__sub">
              <span class="cap-card__sub-dot ${subActive ? 'on' : 'off'}"></span>
              <span class="cap-card__sub-label">${sub.label}</span>
              ${subActive
                ? html`<span class="cap-card__sub-model">${cap!.currentModel!.modelName}</span>`
                : html`<span class="cap-card__sub-model cap-card__sub-model--off">未开通</span>`}
            </div>
          `;
        })}
      </div>
    `;
  }

  /** 内联快速切换面板 */
  private _renderQuickSwitch(userCap: UserCapDef, _activeSub: Capability | undefined, isActive: boolean) {
    if (this._quickSwitchLoading) {
      return html`<div class="qs-panel"><div class="qs-loading">加载中...</div></div>`;
    }

    if (this._quickSwitchError) {
      return html`
        <div class="qs-panel">
          <div class="qs-empty" style="color: var(--danger, #f87171)">${this._quickSwitchError}</div>
        </div>
      `;
    }

    const hasMultiSubs = userCap.subs.length > 1;

    const cloudPanel = hasMultiSubs
      ? this._renderMultiSubQuickSwitch(userCap)
      : this._renderSingleSubQuickSwitch(userCap, isActive);

    // [CN-PATCH] 本地模型 tab 暂时隐藏，后续版本恢复
    return html`${cloudPanel}`;
  }

  /** 单能力卡片的快速切换面板 */
  private _renderSingleSubQuickSwitch(userCap: UserCapDef, isActive: boolean) {
    const activeSub = this._resolveSubCap(userCap.subs[0]);
    const currentModelId = activeSub?.currentModel?.modelId;

    if (this._quickSwitchModels.length === 0) {
      return html`
        <div class="qs-panel">
          <div class="qs-empty">${isActive ? '暂无其他可切换的模型' : '暂无已配置的模型'}</div>
          <div class="qs-more" tabindex="0" role="button"
            @click=${(e: Event) => { e.stopPropagation(); this._scrollToAddProviders(); }}>
            去添加服务商 ↓
          </div>
        </div>
      `;
    }

    return html`
      <div class="qs-panel">
        <div class="qs-scroll">
          ${this._quickSwitchModels.map(m => {
            const isCurrent = m.active || m.modelId === currentModelId;
            const isSwitching = this._switchingModelId === m.modelId;
            return html`
              <div
                class="qs-item ${isCurrent ? 'current' : ''} ${isSwitching ? 'switching' : ''}"
                tabindex="0" role="button"
                @click=${(e: Event) => { e.stopPropagation(); if (!isCurrent) this._onQuickSwitch(userCap, m); }}
                @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" && !isCurrent) { e.stopPropagation(); this._onQuickSwitch(userCap, m); } }}
              >
                <div class="qs-item__info">
                  <div class="qs-item__name">${m.modelName}</div>
                  <div class="qs-item__provider">${m.providerName}</div>
                </div>
                <div class="qs-item__end">
                  ${m.strengthTier === "weak" ? html`<span class="badge badge--weak">弱</span>`
                    : m.strengthTier === "moderate" ? html`<span class="badge badge--moderate">中</span>`
                    : m.strengthTier === "strong" ? html`<span class="badge badge--strong">强</span>`
                    : nothing}
                  ${isSwitching
                    ? html`<span class="qs-spinner"></span>`
                    : isCurrent
                      ? html`<span class="qs-check">✓</span>`
                      : nothing}
                </div>
              </div>
            `;
          })}
        </div>
        <div class="qs-more" tabindex="0" role="button"
          @click=${(e: Event) => { e.stopPropagation(); this._openFullModelSelector(userCap); }}>
          查看全部模型 ›
        </div>
      </div>
    `;
  }

  /** 多子能力卡片的快速切换面板（按子能力分组显示模型） */
  private _renderMultiSubQuickSwitch(userCap: UserCapDef) {
    const totalModels = Array.from(this._quickSwitchSubModels.values()).reduce((sum, v) => sum + v.models.length, 0);

    // embedding 卡片：即使没有 switchable 模型也不显示 "暂无" — 有绑定信息和提取信息
    if (totalModels === 0 && this._quickSwitchSubModels.size > 0 && userCap.id !== "embedding") {
      return html`
        <div class="qs-panel">
          <div class="qs-empty">暂无已配置的模型</div>
          <div class="qs-more" tabindex="0" role="button"
            @click=${(e: Event) => { e.stopPropagation(); this._scrollToAddProviders(); }}>
            去添加服务商 ↓
          </div>
        </div>
      `;
    }

    return html`
      <div class="qs-panel">
        <div class="qs-scroll">
          ${userCap.id === "embedding" && this._embeddingBinding?.bound ? html`
            <div style="background:rgba(251,191,36,0.1);padding:8px 12px;border-radius:6px;margin-bottom:8px;font-size:12px;color:var(--warning,#fbbf24);">
              向量库已绑定 <b>${this._embeddingBinding.vecModel}</b>（${this._embeddingBinding.vecDims ?? "?"}维，${this._embeddingBinding.vecCount} 条向量）。切换模型需清空重建，耗时较长。
            </div>
          ` : nothing}
          ${userCap.subs.map(sub => {
            // "记忆提取" — 纯信息展示，不可切换
            if (sub.keys.includes("memoryExtraction")) {
              return html`
                <div class="qs-sub-group">
                  <div class="qs-sub-label">${sub.label}</div>
                  <div style="padding:6px 0;font-size:12px;color:var(--muted,#8b9caf);line-height:1.5;">
                    自动提取长期记忆，保证 AI 记住你的偏好和习惯。<br>
                    优先级: 美团 LongCat &rarr; 蚂蚁百灵 &rarr; 主聊天模型 &rarr; 硅基流动 &rarr; 魔搭。<br>
                    默认跟随主聊天模型；配置 LongCat/百灵 API Key 可免费加速。
                  </div>
                </div>
              `;
            }
            const entry = this._quickSwitchSubModels.get(sub.label);
            if (!entry) return nothing;
            const currentModelId = entry.cap?.currentModel?.modelId;
            return html`
              <div class="qs-sub-group">
                <div class="qs-sub-label">${sub.label}</div>
                ${entry.models.length === 0
                  ? html`<div class="qs-empty" style="padding:4px 0;font-size:10px">无可用模型</div>`
                  : entry.models.map(m => {
                      const isCurrent = m.active || m.modelId === currentModelId;
                      const isSwitching = this._switchingModelId === m.modelId;
                      return html`
                        <div
                          class="qs-item ${isCurrent ? 'current' : ''} ${isSwitching ? 'switching' : ''}"
                          tabindex="0" role="button"
                          @click=${(e: Event) => { e.stopPropagation(); if (!isCurrent && entry.cap) this._onQuickSwitchSub(entry.cap, m); }}
                          @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" && !isCurrent && entry.cap) { e.stopPropagation(); this._onQuickSwitchSub(entry.cap, m); } }}
                        >
                          <div class="qs-item__info">
                            <div class="qs-item__name">${m.modelName}</div>
                            <div class="qs-item__provider">${m.providerName}</div>
                          </div>
                          <div class="qs-item__end">
                            ${m.strengthTier === "weak" ? html`<span class="badge badge--weak">弱</span>`
                              : m.strengthTier === "moderate" ? html`<span class="badge badge--moderate">中</span>`
                              : m.strengthTier === "strong" ? html`<span class="badge badge--strong">强</span>`
                              : nothing}
                            ${isSwitching
                              ? html`<span class="qs-spinner"></span>`
                              : isCurrent
                                ? html`<span class="qs-check">✓</span>`
                                : nothing}
                          </div>
                        </div>
                      `;
                    })}
              </div>
            `;
          })}
        </div>
        ${userCap.id !== "embedding" ? html`
          <div class="qs-more" tabindex="0" role="button"
            @click=${(e: Event) => { e.stopPropagation(); this._openFullModelSelector(userCap); }}>
            查看全部模型 ›
          </div>
        ` : nothing}
        <div class="qs-more" tabindex="0" role="button"
          @click=${(e: Event) => { e.stopPropagation(); this._scrollToAddProviders(); }}>
          添加更多服务商 ↓
        </div>
      </div>
    `;
  }

  /* ═══════ MY PROVIDERS (已配置) ═══════ */
  private _renderMyProviders() {
    const configured = this._getConfiguredSorted();
    if (configured.length === 0) return nothing;

    return html`
      <div class="prov-section">
        <p class="section-label">已配置的服务商（拖拽调整优先级）</p>
        <div class="prov-list">
          ${configured.map((p, idx) => {
            const health = this._s.providerHealthMap[p.providerId];
            const healthStatus = health?.status ?? "normal";
            const isDragOver = this._dragOverIndex === idx;

            return html`
              <div
                class="prov-row configured ${isDragOver ? 'drag-over' : ''}"
                tabindex="0"
                data-idx="${idx}"
                @pointerdown=${(e: PointerEvent) => this._onPointerDragStart(e, idx)}
              >
                <span class="drag-handle" title="拖拽排序" aria-label="拖拽调整服务商优先级">⠿</span>
                <span class="prov-row__rank">${idx + 1}</span>
                <div class="prov-row__icon">${p.icon}</div>
                <div class="prov-row__info">
                  <div class="prov-row__name">${p.name}${ESSENTIAL_PROVIDERS.includes(p.providerId) ? html`<span class="prov-row__essential">必须配置</span>` : nothing}</div>
                  ${p.tagline ? html`<div class="prov-row__tagline">${renderTagline(p.tagline)}</div>` : nothing}
                </div>
                <div class="health-badge" style="color:${getHealthStatusColor(healthStatus)}; border-color: ${getHealthStatusColor(healthStatus)}30; background: ${getHealthStatusColor(healthStatus)}10">
                  <span class="health-badge__dot" style="background:${getHealthStatusColor(healthStatus)}"></span>
                  ${getHealthStatusText(healthStatus)}
                </div>
                <div class="prov-row__caps">
                  ${p.capabilities.map(c => html`<span class="cap-tag">${CAPABILITY_NAME_MAP[c] ?? c}</span>`)}
                </div>
                <button class="prov-row__btn prov-row__btn--manage" @click=${(e: Event) => { e.stopPropagation(); this._onManageProvider(p); }}>管理</button>
              </div>
            `;
          })}
        </div>
      </div>
      <hr class="section-divider" />
    `;
  }

  /* ═══════ ADD PROVIDERS (未配置，按分组) ═══════ */
  private _renderAddProviders() {
    const unconfigured = this._s.providers.filter(p => !p.configured);
    const { providerGroups } = this._s;

    // 所有 provider 都已配置 → 不显示此区域
    if (unconfigured.length === 0) return nothing;

    return html`
      <div class="prov-section add-section">
        <p class="section-label">添加更多服务商</p>
        ${providerGroups.length > 0
          ? this._renderGroupedProviders(unconfigured, providerGroups)
          : html`<div class="prov-list">${unconfigured.map(p => this._renderAddProviderRow(p))}</div>`
        }
      </div>
    `;
  }

  private _renderGroupedProviders(unconfigured: ProviderInfo[], groups: typeof this._s.providerGroups) {
    const sorted = groups.slice().sort((a, b) => a.order - b.order);
    const unconfiguredSet = new Set(unconfigured.map(p => p.providerId));

    const grouped = sorted.map(g => ({
      ...g,
      items: unconfigured.filter(p => p.group === g.id),
    })).filter(g => g.items.length > 0);

    const groupedIds = new Set(grouped.flatMap(g => g.items.map(p => p.providerId)));
    const ungrouped = unconfigured.filter(p => !groupedIds.has(p.providerId));

    return html`
      ${grouped.map(g => html`
        <div>
          <div
            class="prov-group-header" tabindex="0" role="button"
            @click=${() => this._onToggleGroup(g.id)}
            @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this._onToggleGroup(g.id); }}
          >
            <span class="prov-group-icon">${g.icon}</span>
            <span class="prov-group-name">${g.name}</span>
            <span class="prov-group-count">${g.items.length} 个</span>
            <span class="prov-group-arrow ${g.expanded ? 'expanded' : ''}">▶</span>
          </div>
          ${g.expanded ? html`
            <div class="prov-group-items">
              ${g.items.map(p => this._renderAddProviderRow(p))}
            </div>
          ` : nothing}
        </div>
      `)}
      ${ungrouped.length > 0 ? html`
        <div class="prov-list" style="margin-top: 8px">
          ${ungrouped.map(p => this._renderAddProviderRow(p))}
        </div>
      ` : nothing}
    `;
  }

  private _renderAddProviderRow(p: ProviderInfo) {
    return html`
      <div class="prov-row" tabindex="0" role="button"
        @click=${() => this._onProviderClick(p)}
        @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this._onProviderClick(p); }}
      >
        <div class="prov-row__icon">${p.icon}</div>
        <div class="prov-row__info">
          <div class="prov-row__name">${p.name}${ESSENTIAL_PROVIDERS.includes(p.providerId) ? html`<span class="prov-row__essential">必须配置</span>` : nothing}</div>
          ${p.tagline ? html`<div class="prov-row__tagline">${renderTagline(p.tagline)}</div>` : nothing}
        </div>
        <div class="prov-row__caps">
          ${p.capabilities.map(c => html`<span class="cap-tag">${CAPABILITY_NAME_MAP[c] ?? c}</span>`)}
        </div>
        <button class="prov-row__btn prov-row__btn--add" @click=${(e: Event) => { e.stopPropagation(); this._onProviderClick(p); }}>配置</button>
      </div>
    `;
  }

  /* ═══════ MODEL SELECTOR MODAL (redesigned) ═══════ */
  private _renderModelSelector() {
    const { modelSelectorCapability: cap, modelSelectorModels: models, modelSelectorLoading: loading } = this._s;
    if (!cap) return nothing;

    const userCap = this._modelSelectorUserCap;
    const hasMultiSubs = userCap ? userCap.subs.filter(s => !s.keys.includes("memoryExtraction")).length > 1 : false;

    // 分离已配置 / 未配置 — [CN-PATCH] 过滤掉本地模型（provider=local），本版本暂不支持
    const configured = models.filter(m => m.configured && m.providerId !== "local");
    const unconfigured = models.filter(m => !m.configured && m.providerId !== "local");
    const filtered = this._getFilteredModels(configured);

    // 唯一服务商列表（用于筛选下拉）
    const uniqueProviders = [...new Map(configured.map(m => [m.providerId, m.providerName])).entries()];

    // 当前模型信息（从 capability 获取，而非 models 列表）
    const currentModel = cap.currentModel;
    const isLocked = currentModel?.auto === false;

    return html`
      <div class="modal-overlay" @click=${() => this._closeModelSelector()} @keydown=${(e: KeyboardEvent) => this._onModalKeydown(e, () => this._closeModelSelector())}>
        <div class="modal ms-modal" @click=${(e: Event) => { e.stopPropagation(); this._msProviderDropdownOpen = false; }}>
          <!-- Header -->
          <div class="modal-header">
            <span class="modal-title">选择「${cap.name}」模型</span>
            <button class="modal-close" @click=${() => this._closeModelSelector()}>&times;</button>
          </div>

          <!-- 当前模型 banner -->
          ${currentModel ? html`
            <div class="ms-current">
              <span class="ms-current__label">当前:</span>
              <span class="ms-current__model">${currentModel.modelName}</span>
              <span class="ms-current__provider">(${currentModel.providerName})</span>
              ${isLocked
                ? html`<span class="ms-current__lock ms-current__lock--manual">手动锁定</span>`
                : html`<span class="ms-current__lock ms-current__lock--auto">自动分配</span>`}
            </div>
          ` : nothing}

          <!-- 多子能力 tabs -->
          ${hasMultiSubs && userCap ? html`
            <div class="ms-tabs">
              ${userCap.subs
                .filter(s => !s.keys.includes("memoryExtraction"))
                .map((sub, i) => html`
                  <button
                    class="ms-tab ${this._modelSelectorActiveSubIndex === i ? 'active' : ''}"
                    @click=${() => this._onModelSelectorTabSwitch(i)}
                  >${sub.label}</button>
                `)}
            </div>
          ` : nothing}

          <!-- 搜索 + 筛选工具栏 -->
          <div class="ms-toolbar">
            <input
              class="ms-search"
              type="text"
              placeholder="搜索模型名称或服务商..."
              .value=${this._modelSelectorSearch}
              @input=${(e: Event) => { this._modelSelectorSearch = (e.target as HTMLInputElement).value; }}
            />
            <div class="ms-filters">
              <!-- 服务商筛选 -->
              <div style="position:relative">
                <button
                  class="ms-filter-chip ${this._modelSelectorProviderFilter ? 'active' : ''}"
                  @click=${(e: Event) => { e.stopPropagation(); this._msProviderDropdownOpen = !this._msProviderDropdownOpen; }}
                >${this._modelSelectorProviderFilter
                    ? uniqueProviders.find(([id]) => id === this._modelSelectorProviderFilter)?.[1] ?? "服务商"
                    : "服务商"} ▾</button>
                ${this._msProviderDropdownOpen ? html`
                  <div class="ms-dropdown">
                    <div class="ms-dropdown__item ${!this._modelSelectorProviderFilter ? 'active' : ''}"
                      @click=${() => { this._modelSelectorProviderFilter = null; this._msProviderDropdownOpen = false; }}>
                      全部
                    </div>
                    ${uniqueProviders.map(([pid, pname]) => html`
                      <div class="ms-dropdown__item ${this._modelSelectorProviderFilter === pid ? 'active' : ''}"
                        @click=${() => { this._modelSelectorProviderFilter = pid; this._msProviderDropdownOpen = false; }}>
                        ${pname}
                      </div>
                    `)}
                  </div>
                ` : nothing}
              </div>
              <!-- 上下文窗口筛选 -->
              ${[
                { label: "全部", value: null },
                { label: ">=32K", value: 32000 },
                { label: ">=128K", value: 128000 },
                { label: ">=256K", value: 256000 },
              ].map(opt => html`
                <button
                  class="ms-filter-chip ${this._modelSelectorContextFilter === opt.value ? 'active' : ''}"
                  @click=${() => { this._modelSelectorContextFilter = opt.value; }}
                >${opt.label}</button>
              `)}
              <!-- 能力等级筛选 -->
              ${[
                { label: "全部", value: null as string | null },
                { label: "强", value: "strong" },
                { label: "中", value: "moderate" },
                { label: "弱", value: "weak" },
              ].map(opt => html`
                <button
                  class="ms-filter-chip ${this._modelSelectorStrengthFilter === opt.value ? 'active' : ''}"
                  @click=${() => { this._modelSelectorStrengthFilter = opt.value; }}
                >${opt.label}</button>
              `)}
            </div>
          </div>

          <!-- 模型列表（scrollable） -->
          <div class="ms-body">
            ${loading
              ? html`<div class="loading-state" style="padding:40px 0">加载中...</div>`
              : filtered.length === 0
                ? html`<div class="ms-empty">${this._modelSelectorSearch || this._modelSelectorProviderFilter || this._modelSelectorContextFilter || this._modelSelectorStrengthFilter ? '没有匹配的模型' : '暂无已配置的模型'}</div>`
                : filtered.map(m => this._renderMsItem(m))}

            <!-- 未配置的服务商（可折叠） -->
            ${!loading && unconfigured.length > 0 ? html`
              <div class="ms-unconfigured-section">
                <div
                  class="ms-unconfigured-header"
                  tabindex="0" role="button"
                  @click=${() => { this._msUnconfiguredExpanded = !this._msUnconfiguredExpanded; }}
                >
                  <span>未配置的服务商 (${unconfigured.length} 个模型)</span>
                  <span class="ms-unconfigured-arrow ${this._msUnconfiguredExpanded ? 'expanded' : ''}">▶</span>
                </div>
                ${this._msUnconfiguredExpanded ? html`
                  <div class="ms-unconfigured-list">
                    ${this._groupModelsByProvider(unconfigured).map(g => html`
                      <div class="ms-provider-group">
                        <div class="ms-provider-group__header">
                          <span>${g.providerIcon}</span>
                          <span style="flex:1;font-size:12px;font-weight:600">${g.providerName}</span>
                          <span class="ms-provider-group__badge">未配置</span>
                        </div>
                        ${g.models.map(m => html`
                          <div class="ms-item unconfigured" title="需要先配置 ${g.providerName}">
                            <div class="ms-item__main">
                              <div class="ms-item__name">${m.modelName}</div>
                              <div class="ms-item__meta">
                                <span class="ms-item__provider">${m.providerName}</span>
                                ${m.maxContextTokens ? html`<span class="ms-item__ctx">${this._formatContextTokens(m.maxContextTokens)}</span>` : nothing}
                              </div>
                            </div>
                            <div class="ms-item__end">
                              ${this._renderStrengthBadge(m.strengthTier)}
                            </div>
                          </div>
                        `)}
                        <div class="add-provider-link" tabindex="0" role="button"
                          @click=${() => this._onNavigateToProvider(g.providerId)}
                          @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this._onNavigateToProvider(g.providerId); }}
                        >+ 添加 ${g.providerName} 配置</div>
                      </div>
                    `)}
                  </div>
                ` : nothing}
              </div>
            ` : nothing}
          </div>
        </div>
      </div>
    `;
  }

  /** 单个模型条目（已配置） */
  private _renderMsItem(m: ModelInfo) {
    const isCurrent = m.active;
    const isSwitching = this._switchingModelId === m.modelId;
    return html`
      <div
        class="ms-item ${isCurrent ? 'current' : ''} ${isSwitching ? 'switching' : ''}"
        tabindex="0" role="button"
        @click=${() => this._onModelSelect(m)}
        @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this._onModelSelect(m); }}
      >
        <div class="ms-item__main">
          <div class="ms-item__name">${m.modelName}</div>
          <div class="ms-item__meta">
            <span class="ms-item__provider">${m.providerName}</span>
            ${m.maxContextTokens ? html`<span class="ms-item__ctx">${this._formatContextTokens(m.maxContextTokens)} tokens</span>` : nothing}
          </div>
        </div>
        <div class="ms-item__end">
          ${this._renderStrengthBadge(m.strengthTier)}
          ${isSwitching
            ? html`<span class="ms-item__spinner"></span>`
            : isCurrent
              ? html`<span class="checkmark">&#x2713;</span>`
              : nothing}
        </div>
      </div>
    `;
  }

  /** 能力等级徽章 */
  private _renderStrengthBadge(tier?: string) {
    if (tier === "weak") return html`<span class="badge badge--weak">弱</span>`;
    if (tier === "moderate") return html`<span class="badge badge--moderate">中</span>`;
    if (tier === "strong") return html`<span class="badge badge--strong">强</span>`;
    return nothing;
  }

  /* ═══════ PROVIDER CONFIG MODAL ═══════ */
  private _renderProviderConfig() {
    const { providerConfigProvider: prov, providerConfigStep: step } = this._s;
    if (!prov) return nothing;
    const stepIndex = { guide: 0, apikey: 1, detecting: 2, result: 3 }[step];

    return html`
      <div class="modal-overlay" @click=${() => { if (step !== "detecting") this._closeProviderConfig(); }} @keydown=${(e: KeyboardEvent) => this._onModalKeydown(e, () => this._closeProviderConfig(), step === "detecting")}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="step-indicator">
            ${[0, 1, 2, 3].map(i => html`<div class="step-bar ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}"></div>`)}
          </div>
          <div class="modal-header">
            <span class="modal-title">
              ${step === "guide" ? `配置 ${prov.name}` : step === "apikey" ? "输入 API Key" : step === "detecting" ? "检测中..." : "配置完成"}
            </span>
            ${step !== "detecting"
              ? html`<button class="modal-close" @click=${() => this._closeProviderConfig()}>&times;</button>`
              : nothing}
          </div>
          <div class="modal-body">
            ${step === "guide" ? this._renderGuideStep(prov) :
              step === "apikey" ? this._renderApiKeyStep(prov) :
              step === "detecting" ? this._renderDetectingStep() :
              this._renderResultStep(prov)}
          </div>
        </div>
      </div>
    `;
  }

  private _renderGuideStep(prov: ProviderInfo) {
    return html`
      <div class="guide-caps">
        ${prov.capabilities.map(c => html`<span class="guide-cap-tag">${CAPABILITY_NAME_MAP[c] ?? c}</span>`)}
      </div>
      ${prov.apiKeyGuide?.length > 0 ? html`<ol class="guide-steps">${prov.apiKeyGuide.map(s => html`<li class="guide-step">${s}</li>`)}</ol>` : nothing}
      ${prov.apiKeyUrl ? html`<a class="guide-link" href="${prov.apiKeyUrl}" target="_blank" rel="noopener">前往获取 API Key ↗</a>` : nothing}
      <div class="btn-row">
        <button class="btn btn--ghost" @click=${() => this._closeProviderConfig()}>取消</button>
        <button class="btn btn--ghost" @click=${() => this._onConfigNextStep()}>我已有 Key，跳过</button>
        <button class="btn btn--primary" @click=${() => this._onConfigNextStep()}>下一步</button>
      </div>
    `;
  }

  private _renderApiKeyStep(prov: ProviderInfo) {
    const { providerConfigApiKey: apiKey, providerConfigBaseUrl: baseUrl, providerConfigCustomModel: customModel, providerConfigTestResult: result, providerConfigDetecting: detecting } = this._s;
    const needsUrl = prov.needsBaseUrl;
    const keyOptional = prov.apiKeyOptional;

    // 火山引擎: tab 切换
    const isVolcengine = prov.providerId === "volcengine-ark";
    if (isVolcengine) {
      const volcTab = this._s.providerConfigVolcTab;
      return html`
        <div class="volc-tabs">
          <button class="volc-tab ${volcTab === 'llm' ? 'active' : ''}" @click=${() => this._onVolcTabSwitch("llm")}>
            <span class="volc-tab__icon">💬</span> LLM 聊天
          </button>
          <button class="volc-tab ${volcTab === 'voice' ? 'active' : ''}" @click=${() => this._onVolcTabSwitch("voice")}>
            <span class="volc-tab__icon">🎙️</span> 语音服务 (ASR/TTS)
          </button>
        </div>
        ${volcTab === "llm"
          ? this._renderVolcLlmForm(prov, apiKey, customModel, result, detecting, keyOptional)
          : this._renderVolcVoiceForm(prov, result)}
      `;
    }

    // 其他 provider — 原逻辑
    const canDetect = (!needsUrl || !!baseUrl?.trim()) && (keyOptional || !!apiKey);
    return html`
      ${needsUrl ? html`
      <div class="form-group">
        <label class="form-label">API 端点 (Base URL) <span style="color:var(--accent-red,#e74c3c);font-weight:bold">*</span></label>
        <input type="text" class="form-input" placeholder=${prov.defaultBaseUrl || "https://api.example.com/v1"} .value=${baseUrl ?? ""} @input=${this._onBaseUrlInput} autocomplete="off" />
        <div class="form-hint">兼容 OpenAI 格式的 API 地址，如 http://localhost:11434/v1</div>
      </div>` : nothing}
      <div class="form-group">
        <label class="form-label">${prov.name} API Key${keyOptional ? html` <span style="color:var(--text-muted);font-weight:normal;font-size:12px">(可选)</span>` : nothing}</label>
        <input type="password" class="form-input" placeholder=${keyOptional ? "本地服务可留空" : "粘贴你的 API Key"} .value=${apiKey} @input=${this._onApiKeyInput} @blur=${this._onApiKeyBlur} autocomplete="off" />
        <div class="form-hint">配置后会自动检测并开通所有可用功能</div>
      </div>
      ${prov.providerId === "openai-compatible" ? html`
      <div class="form-group">
        <label class="form-label">模型名称 <span style="color:var(--text-muted);font-weight:normal;font-size:12px">(可选)</span></label>
        <input type="text" class="form-input" placeholder="如 gpt-4o、deepseek-chat 等" .value=${customModel ?? ""} @input=${this._onCustomModelInput} autocomplete="off" />
        <div class="form-hint">填写服务端支持的模型名称，留空将尝试自动检测</div>
      </div>` : nothing}
      ${result && !result.success ? html`<div class="alert alert--err">${result.message}</div>` : nothing}
      <div class="btn-row">
        ${prov.apiKeyGuide?.length > 0
          ? html`<button class="btn btn--ghost" @click=${() => this._onConfigPrevStep()}>返回</button>`
          : html`<button class="btn btn--ghost" @click=${() => this._closeProviderConfig()}>取消</button>`}
        <button class="btn btn--primary" ?disabled=${!canDetect || detecting} @click=${() => this._onDetect()}>检测并保存</button>
      </div>
    `;
  }

  /** 火山引擎 LLM 聊天 Tab */
  private _renderVolcLlmForm(prov: ProviderInfo, apiKey: string, customModel: string, result: { success: boolean; message: string } | null, detecting: boolean, keyOptional: boolean) {
    const canDetect = keyOptional || !!apiKey;
    return html`
      <div class="form-group">
        <label class="form-label">${prov.name} API Key${keyOptional ? html` <span style="color:var(--text-muted);font-weight:normal;font-size:12px">(可选)</span>` : nothing}</label>
        <input type="password" class="form-input" placeholder=${keyOptional ? "本地服务可留空" : "粘贴你的 API Key"} .value=${apiKey} @input=${this._onApiKeyInput} @blur=${this._onApiKeyBlur} autocomplete="off" />
        <div class="form-hint">配置后会自动检测并开通所有可用功能</div>
      </div>
      <div class="form-group">
        <label class="form-label">推理接入点 ID <span style="color:var(--text-muted);font-weight:normal;font-size:12px">(可选)</span></label>
        <input type="text" class="form-input" placeholder="留空使用默认模型，或输入你的接入点 ID（ep-xxx）" .value=${customModel ?? ""} @input=${this._onCustomModelInput} autocomplete="off" />
        <div class="form-hint">在火山方舟控制台「在线推理」创建的接入点 ID</div>
      </div>
      ${result && !result.success ? html`<div class="alert alert--err">${result.message}</div>` : nothing}
      <div class="btn-row">
        ${prov.apiKeyGuide?.length > 0
          ? html`<button class="btn btn--ghost" @click=${() => this._onConfigPrevStep()}>返回</button>`
          : html`<button class="btn btn--ghost" @click=${() => this._closeProviderConfig()}>取消</button>`}
        <button class="btn btn--primary" ?disabled=${!canDetect || detecting} @click=${() => this._onDetect()}>检测并保存</button>
      </div>
    `;
  }

  /** 火山引擎语音服务 Tab — ASR/TTS 凭证配置 + 教程 */
  private _renderVolcVoiceForm(prov: ProviderInfo, result: { success: boolean; message: string } | null) {
    const { providerConfigVolcAppId: appId, providerConfigVolcAccessToken: token, providerConfigVolcSaving: saving, providerConfigVolcCredsStatus: credsStatus } = this._s;
    const canSave = !!appId?.trim() && !!token?.trim() && !saving;
    return html`
      ${credsStatus?.configured && !appId && !token ? html`
      <div class="alert alert--ok" style="margin-bottom:12px">
        语音凭证已配置${credsStatus.maskedAppId ? html`（APP ID: ${credsStatus.maskedAppId}）` : nothing}。如需更新请重新填写下方表单。
      </div>` : nothing}

      <div class="volc-voice-guide">
        <div class="volc-voice-guide__title">如何获取语音服务凭证</div>
        <ol class="volc-voice-guide__steps">
          <li>
            打开 <a href="https://console.volcengine.com/speech/service" target="_blank" rel="noopener">豆包语音控制台</a>，登录你的火山引擎账号
          </li>
          <li>
            在左侧「应用管理」中点击「创建应用」，填写应用名称后提交；点击「编辑」勾选能力（流式语音识别、语音合成等），点击「确定」
          </li>
          <li>
            在左侧「API服务中心」，进入以下两个服务页面，分别点击「开通」（试用包免费）：<br/>
            · <strong>豆包流式语音识别模型2.0</strong>（ASR）<br/>
            · <strong>豆包语音合成模型2.0</strong>（TTS）
          </li>
          <li>
            在任一服务详情页底部「服务接口认证信息」区域，复制 <strong>APP ID</strong> 和 <strong>Access Token</strong>（所有服务共用同一组，填一次即可）
          </li>
        </ol>
        <div class="volc-voice-guide__links">
          <a href="https://console.volcengine.com/speech/service" target="_blank" rel="noopener">前往豆包语音控制台 ↗</a>
          <a href="https://www.volcengine.com/docs/6561/97465" target="_blank" rel="noopener">查看官方文档 ↗</a>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">APP ID <span style="color:var(--accent-red,#e74c3c);font-weight:bold">*</span></label>
        <input type="text" class="form-input" placeholder=${credsStatus?.maskedAppId ? `当前: ${credsStatus.maskedAppId}` : "纯数字，如 4069941412"} .value=${appId} @input=${this._onVolcAppIdInput} autocomplete="off" />
        <div class="form-hint">在服务详情页底部「服务接口认证信息」中获取</div>
      </div>

      <div class="form-group">
        <label class="form-label">Access Token <span style="color:var(--accent-red,#e74c3c);font-weight:bold">*</span></label>
        <input type="password" class="form-input" placeholder=${credsStatus?.maskedToken ? `当前: ${credsStatus.maskedToken}` : "粘贴你的 Access Token"} .value=${token} @input=${this._onVolcAccessTokenInput} autocomplete="off" />
        <div class="form-hint">在服务详情页底部「服务接口认证信息」中获取，与 APP ID 同一位置</div>
      </div>

      <div class="volc-voice-note">
        <span class="volc-voice-note__icon">ℹ️</span>
        <span>APP ID / Access Token 是同一个应用下所有服务共用的，只需填一次。但 ASR（流式语音识别）和 TTS（语音合成）需要在控制台各自开通才能使用。</span>
      </div>

      ${result ? html`<div class="alert ${result.success ? 'alert--ok' : 'alert--err'}">${result.message}</div>` : nothing}

      <div class="btn-row">
        <button class="btn btn--ghost" ?disabled=${saving} @click=${() => this._onVolcTabSwitch("llm")}>返回 LLM 配置</button>
        <button class="btn btn--primary" ?disabled=${!canSave} @click=${() => this._onSaveVolcVoiceCredentials()}>${saving ? "保存中..." : "保存语音凭证"}</button>
      </div>
    `;
  }

  private _renderDetectingStep() {
    const provName = this._s.providerConfigProvider?.name ?? "";
    const elapsed = this._s.providerConfigDetectElapsed;
    const total = this._s.providerConfigDetectTotal;
    const completed = this._s.providerConfigDetectCompleted;
    const hasProgress = total > 0;
    return html`
      <div class="detecting-state">
        <div class="spinner"></div>
        <div class="detecting-text">正在检测 ${provName} 可用模型...</div>
        <div class="detecting-text" style="font-size:12px;opacity:0.6">
          ${hasProgress
            ? `已完成 ${completed}/${total} 个模型（${elapsed}秒）`
            : `验证 API Key 并扫描支持的能力（${elapsed}秒）`}
        </div>
        <button class="btn btn--ghost" style="margin-top:16px;font-size:12px;" @click=${() => this._cancelDetection()}>取消检测</button>
      </div>
    `;
  }

  private _renderResultStep(prov: ProviderInfo) {
    const autoEnabled = this._s.providerConfigAutoEnabled;
    const success = this._s.providerConfigTestResult?.success === true;
    const enabledCaps = autoEnabled ? Object.keys(autoEnabled) : [];
    return html`
      <div class="result-state">
        <div class="result-icon">${success ? "✅" : "❌"}</div>
        <div class="result-title">${success ? `${prov.name} 配置成功` : `${prov.name} 配置失败`}</div>
        <div class="result-desc">${enabledCaps.length > 0 ? `已自动启用 ${enabledCaps.length} 个能力` : success ? "配置已保存" : (this._s.providerConfigTestResult?.message ?? "请重试")}</div>
        ${enabledCaps.length > 0 ? html`<div class="result-caps">${enabledCaps.map(c => html`<span class="result-cap">✓ ${CAPABILITY_NAME_MAP[c] ?? c}</span>`)}</div>` : nothing}
      </div>
      <div class="btn-row">
        <button class="btn btn--ghost" @click=${() => this._closeProviderConfigAndRefresh()}>完成</button>
        <button class="btn btn--primary" @click=${() => this._closeAndAddMore()}>配置更多服务商</button>
      </div>
    `;
  }

  /* ═══════ MANAGE MODAL ═══════ */
  private _renderManageModal() {
    const prov = this._s.providerManageTarget;
    if (!prov) return nothing;

    return html`
      <div class="modal-overlay" @click=${() => this._closeManage()} @keydown=${(e: KeyboardEvent) => this._onModalKeydown(e, () => this._closeManage())}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <span class="modal-title">管理 ${prov.name}</span>
            <button class="modal-close" @click=${() => this._closeManage()}>&times;</button>
          </div>
          <div class="modal-body">
            <div class="manage-row">
              <span class="manage-label">API Key</span>
              <span class="manage-value">${this._s.providerManageApiKey || "..."}</span>
            </div>
            <div class="manage-row">
              <span class="manage-label">状态</span>
              <span class="manage-value">
                ${(() => {
                  const health = this._s.providerHealthMap[prov.providerId];
                  const status = health?.status ?? "normal";
                  const color = getHealthStatusColor(status);
                  return html`<span style="color:${color}">${getHealthStatusText(status)}</span>`;
                })()}
              </span>
            </div>
            <div class="manage-row">
              <span class="manage-label">支持能力</span>
              <div class="manage-caps">
                ${prov.capabilities.map(c => html`<span class="cap-tag">${CAPABILITY_NAME_MAP[c] ?? c}</span>`)}
              </div>
            </div>

            <div class="btn-row" style="margin-top: 24px">
              <button class="btn btn--primary" @click=${() => this._onReconfigure(prov)}>更换 Key</button>
              <button
                class="btn btn--ghost"
                ?disabled=${this._s.providerTestingId === prov.providerId}
                @click=${() => this._onTestConnection(prov.providerId)}
              >${this._s.providerTestingId === prov.providerId ? "测试中..." : "测试连接"}</button>
            </div>
            ${this._s.providerTestResult && this._s.providerTestResult.providerId === prov.providerId ? html`
              <div class="test-conn-result ${this._s.providerTestResult.success ? 'test-conn-result--ok' : 'test-conn-result--err'}">
                ${this._s.providerTestResult.success ? "✓ " : "✗ "}${this._s.providerTestResult.message}
              </div>
            ` : nothing}

            <hr class="manage-divider" />

            <div class="add-model-section">
              <div class="add-model-title">添加自定义模型</div>
              <div class="add-model-desc">${this._getAddModelDesc(prov.providerId)}</div>
              <div class="add-model-row">
                <input
                  class="add-model-input"
                  type="text"
                  aria-label="自定义模型 ID"
                  placeholder="${this._getAddModelPlaceholder(prov.providerId)}"
                  .value=${this._addModelId}
                  @input=${(e: Event) => { this._addModelId = (e.target as HTMLInputElement).value; this._addModelMsg = null; }}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") { e.stopPropagation(); this._onAddModel(prov.providerId); } }}
                  ?disabled=${this._addModelLoading}
                />
                <button
                  class="btn btn--primary add-model-btn"
                  ?disabled=${!this._addModelId.trim() || this._addModelLoading}
                  @click=${() => this._onAddModel(prov.providerId)}
                >${this._addModelLoading ? "添加中..." : "添加"}</button>
              </div>
              ${this._addModelMsg
                ? html`<div class="add-model-msg add-model-msg--${this._addModelMsg.type}">${this._addModelMsg.text}</div>`
                : nothing}
            </div>

            <hr class="manage-divider" />

            <div class="manage-danger-zone">
              <div class="manage-danger-title">危险操作</div>
              <div class="manage-danger-desc">删除配置后，使用该服务商的 AI 能力将停止工作。</div>
              <button
                class="btn btn--danger"
                ?disabled=${this._s.providerManageDeleting}
                @click=${() => this._onDeleteProvider(prov.providerId)}
              >${this._s.providerManageDeleting ? "删除中..." : this._deleteConfirm ? "确认删除" : "删除配置"}</button>
              ${this._s.providerManageError
                ? html`<div class="alert alert--err" style="margin-top: 8px">${this._s.providerManageError}</div>`
                : nothing}
            </div>
          </div>
        </div>
      </div>
    `;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    "model-config-view": ModelConfigView;
  }
}
