/**
 * 模型设置页面 View — v2 重写
 *
 * 信息架构:
 * 1. 新手引导横幅（全空时显示）
 * 2. 4 张能力卡（聊天/图片/视频/推荐）
 * 3. 已配置的服务商（可管理）
 * 4. 添加更多服务商（按分组折叠）
 */

import { html, css, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
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
  switchModel,
  openProviderConfig,
  closeProviderConfig,
  updateProviderApiKey,
  updateProviderCustomModel,
  detectAndConfigureProvider,
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

/** 能力名映射 */
const CAPABILITY_NAME_MAP: Record<string, string> = {
  text: "聊天",
  "image-understanding": "看图",
  "image-generation": "画图",
  video: "视频",
  embedding: "推荐",
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

/** 面向用户的 4 大能力分组（含 embedding） */
const USER_CAPABILITIES: { id: string; name: string; desc: string; icon: string; caps: string[] }[] = [
  { id: "text", name: "聊天", desc: "和 AI 对话", icon: "💬", caps: ["text"] },
  { id: "image", name: "图片", desc: "看图 & 画图", icon: "🎨", caps: ["image-understanding", "image-generation"] },
  { id: "video", name: "视频", desc: "视频分析", icon: "📹", caps: ["video"] },
  { id: "embedding", name: "推荐", desc: "智能推荐", icon: "🧩", caps: ["embedding"] },
];

/** 快速上手推荐的 provider */
const QUICK_SETUP_PROVIDER = "kimi-code";
/** 必须配置的 provider（记忆、推荐等核心功能依赖） */
const ESSENTIAL_PROVIDER = "siliconflow";

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
  /** 快速切换：当前展开的能力卡 ID（如 "text"），null 表示关闭 */
  @state() private _quickSwitchCap: string | null = null;
  /** 快速切换：已加载的可用模型列表 */
  @state() private _quickSwitchModels: ModelInfo[] = [];
  /** 快速切换：加载中 */
  @state() private _quickSwitchLoading = false;
  /** 快速切换：加载错误 */
  @state() private _quickSwitchError: string | null = null;
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
      padding: 16px 20px; margin-bottom: 20px;
      background: linear-gradient(135deg, rgba(168,85,247,.1) 0%, rgba(108,140,255,.08) 100%);
      border: 1px solid rgba(168,85,247,.3);
      border-radius: var(--radius-md, 8px);
      animation: fade-in 0.3s ease-out;
    }
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

    /* ═══════ CAPABILITY CARDS (4 columns) ═══════ */
    .cap-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 0;
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
    .cap-card.expanded {
      border-color: var(--accent, #6c8cff);
      box-shadow: 0 0 0 1px var(--accent, #6c8cff), var(--shadow-sm, 0 2px 8px rgba(0,0,0,.15));
    }

    /* ═══════ QUICK SWITCH PANEL ═══════ */
    .qs-panel {
      margin-top: 10px; padding-top: 10px;
      border-top: 1px solid var(--border, #2d3a4d);
    }
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

    .badge { display: inline-flex; align-items: center; padding: 0px 5px; border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1.5; }
    .badge--free { background: var(--ok-subtle, rgba(52,211,153,.15)); color: var(--ok, #34d399); }
    .badge--paid { background: var(--warn-subtle, rgba(251,191,36,.15)); color: var(--warn, #fbbf24); }

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
  `;

  /* ═══════ LIFECYCLE ═══════ */
  connectedCallback() {
    super.connectedCallback();
    if (this.client && this.connected) this._loadData();
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
  private async _onCapCardClick(userCap: typeof USER_CAPABILITIES[number]) {
    // 如果已展开，点击关闭
    if (this._quickSwitchCap === userCap.id) {
      this._quickSwitchCap = null;
      this._quickSwitchModels = [];
      this._quickSwitchError = null;
      return;
    }

    if (!this.client || !this.connected) return;

    this._quickSwitchCap = userCap.id;
    this._quickSwitchModels = [];
    this._quickSwitchLoading = true;
    this._quickSwitchError = null;

    // 找到第一个匹配的 capability（不要求 active）
    const matchedCap = userCap.caps
      .map(c => this._s.capabilities.find(cap => cap.capability === c))
      .find(c => c);

    if (!matchedCap) {
      // 后端没有返回该 capability，直接显示空面板
      this._quickSwitchLoading = false;
      return;
    }

    try {
      const result = await this.client.request("modelConfig.capability.models", {
        capability: matchedCap.capability,
      });
      const data = result as { models: ModelInfo[] };
      // 只保留已配置的模型
      this._quickSwitchModels = (data.models ?? []).filter(m => m.configured);
    } catch {
      this._quickSwitchModels = [];
      this._quickSwitchError = "加载模型列表失败，请稍后重试";
    } finally {
      this._quickSwitchLoading = false;
    }
  }

  /** 滚动到"添加更多服务商"区域 */
  private _scrollToAddProviders() {
    this._quickSwitchCap = null;
    this._quickSwitchModels = [];
    const addSection = this.renderRoot?.querySelector('.add-section');
    if (addSection) {
      addSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private async _onModelSelect(m: ModelInfo) {
    if (!m.configured || this._s.modelSelectorSwitching) return;

    // 检查是否真的切换了模型
    const cap = this._s.modelSelectorCapability;
    const oldModel = cap?.currentModel;
    const oldKey = oldModel ? `${oldModel.providerId}/${oldModel.modelId}` : "";
    const newKey = `${m.providerId}/${m.modelId}`;
    if (oldKey === newKey) return;

    this._switchingModelId = m.modelId;
    const h = this._host();
    await switchModel(h, m.providerId, m.modelId);
    this._switchingModelId = null;
    this._sync(h);

    // 切换成功后显示提示
    if (!this._s.modelConfigError) {
      this._showSwitchToast(m.modelName || m.modelId, m.providerName || m.providerId);
    }
  }

  /** 快速切换：在能力卡内直接选模型 */
  private async _onQuickSwitch(userCap: typeof USER_CAPABILITIES[number], m: ModelInfo) {
    if (!m.configured || this._switchingModelId) return;

    const activeCap = userCap.caps
      .map(c => this._s.capabilities.find(cap => cap.capability === c))
      .find(c => c);
    if (!activeCap || !this.client || !this.connected) return;

    // 记录切换前的模型，用于判断是否真的切换了
    const oldModel = activeCap.currentModel;
    const oldKey = oldModel ? `${oldModel.providerId}/${oldModel.modelId}` : "";
    const newKey = `${m.providerId}/${m.modelId}`;

    // 如果选的就是当前模型，不做任何操作
    if (oldKey === newKey) return;

    this._switchingModelId = m.modelId;

    try {
      const result = await this.client.request("modelConfig.capability.switchModel", {
        capability: activeCap.capability,
        providerId: m.providerId,
        modelId: m.modelId,
      });
      const data = result as { success: boolean; error?: string };
      if (data.success) {
        // 切换成功，关闭快速面板并刷新
        this._quickSwitchCap = null;
        this._quickSwitchModels = [];
        const h2 = this._host();
        await loadCapabilities(h2);
        this._sync(h2);

        // 显示切换提示：首次响应可能稍慢
        this._showSwitchToast(m.modelName || m.modelId, m.providerName || m.providerId);
      } else {
        const h = this._host();
        h.modelConfigError = data.error ?? "切换失败";
        this._sync(h);
      }
    } catch (err) {
      const h = this._host();
      h.modelConfigError = `切换失败: ${String(err)}`;
      this._sync(h);
    } finally {
      this._switchingModelId = null;
    }
  }

  /** 从快速切换面板打开完整模型选择器弹窗 */
  private async _openFullModelSelector(userCap: typeof USER_CAPABILITIES[number]) {
    this._quickSwitchCap = null;
    this._quickSwitchModels = [];

    const matchedCap = userCap.caps
      .map(c => this._s.capabilities.find(cap => cap.capability === c))
      .find(c => c);
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
      const result = await this.client.request("modelConfig.provider.addModel", {
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
  private _getUserCapModels(userCap: typeof USER_CAPABILITIES[number]) {
    return userCap.caps
      .map(c => this._s.capabilities.find(cap => cap.capability === c))
      .filter((c): c is Capability => !!c);
  }

  private _isUserCapActive(userCap: typeof USER_CAPABILITIES[number]): boolean {
    return this._getUserCapModels(userCap).some(c => c.status === "active");
  }

  private _isAllInactive(): boolean {
    return this._s.capabilities.length > 0 && this._s.capabilities.every(c => c.status === "inactive");
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

        <hr class="section-divider" />
        ${this._renderMyProviders()}
        ${this._renderEssentialBanner()}
        ${this._renderAddProviders()}
      </div>

      ${this._s.modelSelectorOpen ? this._renderModelSelector() : nothing}
      ${this._s.providerConfigOpen ? this._renderProviderConfig() : nothing}
      ${this._s.providerManageOpen ? this._renderManageModal() : nothing}
    `;
  }

  /* ═══════ ONBOARDING BANNER ═══════ */
  private _renderOnboarding() {
    if (!this._isAllInactive()) return nothing;

    const quickProvider = this._s.providers.find(p => p.providerId === QUICK_SETUP_PROVIDER);
    const essentialProvider = this._s.providers.find(p => p.providerId === ESSENTIAL_PROVIDER);
    const quickConfigured = quickProvider?.configured;
    const essentialConfigured = essentialProvider?.configured;

    // 两个都已配置 → 不显示（理论上 _isAllInactive 已排除，但 double-check）
    if (quickConfigured && essentialConfigured) return nothing;

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

        ${!essentialConfigured && essentialProvider ? html`
          <div class="onboarding__step">
            <div class="onboarding__step-label">${!quickConfigured ? '第 2 步：' : ''}解锁记忆与推荐（必需）</div>
            <div class="onboarding__step-desc">
              所有记忆、推荐功能基于 <strong>${essentialProvider.name}</strong> — 模型免费，需实名注册确保可用
            </div>
            <button class="btn btn--primary" @click=${() => this._onQuickSetup(ESSENTIAL_PROVIDER)}>
              配置${essentialProvider.name}
            </button>
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
    const ep = this._s.providers.find(p => p.providerId === ESSENTIAL_PROVIDER);
    // 已配置 或 provider 不存在 → 不显示
    if (!ep || ep.configured) return nothing;

    return html`
      <div class="sf-banner">
        <div class="sf-banner__icon">${ep.icon}</div>
        <div class="sf-banner__body">
          <div class="sf-banner__title">请配置${ep.name}（必需）</div>
          <div class="sf-banner__desc">所有记忆、推荐功能都基于此服务商 — 模型免费，需实名注册确保可用</div>
        </div>
        <button class="btn btn--primary" @click=${() => this._onQuickSetup(ESSENTIAL_PROVIDER)}>立即配置</button>
      </div>
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

  private _renderCapCard(userCap: typeof USER_CAPABILITIES[number]) {
    const subCaps = this._getUserCapModels(userCap);
    const active = this._isUserCapActive(userCap);
    const activeSub = subCaps.find(c => c.status === "active" && c.currentModel);
    const expanded = this._quickSwitchCap === userCap.id;

    return html`
      <div class="cap-card ${active ? 'active' : 'inactive'} ${expanded ? 'expanded' : ''}">
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
          ${active && activeSub?.currentModel
            ? html`
                <div class="cap-card__model">${activeSub.currentModel.modelName}</div>
                <div class="cap-card__provider">${activeSub.currentModel.providerName}</div>
                <div class="cap-card__action">${expanded ? '收起 ‹' : '切换模型 ›'}</div>
              `
            : html`
                <div class="cap-card__empty">未开通</div>
                <div class="cap-card__action">${expanded ? '收起 ‹' : '查看模型 ›'}</div>
              `}
        </div>
        ${expanded ? this._renderQuickSwitch(userCap, activeSub, active) : nothing}
      </div>
    `;
  }

  /** 内联快速切换面板 */
  private _renderQuickSwitch(userCap: typeof USER_CAPABILITIES[number], activeSub: Capability | undefined, isActive: boolean) {
    const currentModelId = activeSub?.currentModel?.modelId;

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
                ${m.pricing.type === "free" ? html`<span class="badge badge--free">FREE</span>` : nothing}
                ${isSwitching
                  ? html`<span class="qs-spinner"></span>`
                  : isCurrent
                    ? html`<span class="qs-check">✓</span>`
                    : nothing}
              </div>
            </div>
          `;
        })}
        <div class="qs-more" tabindex="0" role="button"
          @click=${(e: Event) => { e.stopPropagation(); this._openFullModelSelector(userCap); }}>
          查看全部模型 ›
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
                <span class="drag-handle" title="拖拽排序">⠿</span>
                <span class="prov-row__rank">${idx + 1}</span>
                <div class="prov-row__icon">${p.icon}</div>
                <div class="prov-row__info">
                  <div class="prov-row__name">${p.name}${p.providerId === ESSENTIAL_PROVIDER ? html`<span class="prov-row__essential">必须配置</span>` : nothing}</div>
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
          <div class="prov-row__name">${p.name}${p.providerId === ESSENTIAL_PROVIDER ? html`<span class="prov-row__essential">必须配置</span>` : nothing}</div>
          ${p.tagline ? html`<div class="prov-row__tagline">${renderTagline(p.tagline)}</div>` : nothing}
        </div>
        <div class="prov-row__caps">
          ${p.capabilities.map(c => html`<span class="cap-tag">${CAPABILITY_NAME_MAP[c] ?? c}</span>`)}
        </div>
        <button class="prov-row__btn prov-row__btn--add" @click=${(e: Event) => { e.stopPropagation(); this._onProviderClick(p); }}>配置</button>
      </div>
    `;
  }

  /* ═══════ MODEL SELECTOR MODAL ═══════ */
  private _renderModelSelector() {
    const { modelSelectorCapability: cap, modelSelectorModels: models, modelSelectorLoading: loading } = this._s;
    if (!cap) return nothing;
    const providerGroups = this._groupModelsByProvider(models);

    return html`
      <div class="modal-overlay" @click=${() => this._closeModelSelector()} @keydown=${(e: KeyboardEvent) => this._onModalKeydown(e, () => this._closeModelSelector())}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <span class="modal-title">选择「${cap.name}」模型</span>
            <button class="modal-close" @click=${() => this._closeModelSelector()}>&times;</button>
          </div>
          <div class="modal-body">
            ${loading
              ? html`<div class="loading-state" style="padding:40px 0">加载中...</div>`
              : providerGroups.map(g => this._renderModelGroup(g))}
          </div>
        </div>
      </div>
    `;
  }

  private _renderModelGroup(group: { providerId: string; providerName: string; providerIcon: string; configured: boolean; isCurrent: boolean; models: ModelInfo[] }) {
    const statusClass = group.isCurrent ? "current" : group.configured ? "configured" : "unconfigured";
    const statusText = group.isCurrent ? "当前" : group.configured ? "已配置" : "未配置";
    const switching = this._s.modelSelectorSwitching;

    return html`
      <div class="model-group">
        <div class="model-group__header">
          <span class="model-group__icon">${group.providerIcon}</span>
          <span class="model-group__name">${group.providerName}</span>
          <span class="model-group__badge ${statusClass}">${statusText}</span>
        </div>
        ${group.configured
          ? group.models.map(m => html`
              <div
                class="m-item ${m.active ? 'current' : ''} ${switching ? 'switching' : ''}"
                tabindex="0" role="button"
                @click=${() => this._onModelSelect(m)}
                @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this._onModelSelect(m); }}
              >
                <div class="m-item__info"><div class="m-item__name">${m.modelName}</div></div>
                <div class="m-item__end">
                  <span class="badge ${m.pricing.type === 'free' ? 'badge--free' : 'badge--paid'}">${m.pricing.type === "free" ? "FREE" : "PAID"}</span>
                  ${this._switchingModelId === m.modelId ? html`<span class="m-item__spinner"></span>` : m.active ? html`<span class="checkmark">✓</span>` : nothing}
                </div>
              </div>
            `)
          : html`
              ${group.models.map(m => html`
                <div class="m-item locked" title="需要先配置 ${group.providerName} 才能使用此模型">
                  <div class="m-item__info"><div class="m-item__name">${m.modelName}</div></div>
                  <div class="m-item__end">
                    <span class="badge ${m.pricing.type === 'free' ? 'badge--free' : 'badge--paid'}">${m.pricing.type === "free" ? "FREE" : "PAID"}</span>
                    <span style="font-size:10px;color:var(--muted,#8b9caf)">🔒</span>
                  </div>
                </div>
              `)}
              <div class="add-provider-link" tabindex="0" role="button" @click=${() => this._onNavigateToProvider(group.providerId)} @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this._onNavigateToProvider(group.providerId); }}>+ 添加 ${group.providerName} 配置</div>
            `}
      </div>
    `;
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
    const { providerConfigApiKey: apiKey, providerConfigCustomModel: customModel, providerConfigTestResult: result, providerConfigDetecting: detecting } = this._s;
    return html`
      <div class="form-group">
        <label class="form-label">${prov.name} API Key</label>
        <input type="password" class="form-input" placeholder="粘贴你的 API Key" .value=${apiKey} @input=${this._onApiKeyInput} @blur=${this._onApiKeyBlur} autocomplete="off" />
        <div class="form-hint">配置后会自动检测并开通所有可用功能</div>
      </div>
      ${prov.providerId === "volcengine-ark" ? html`
      <div class="form-group">
        <label class="form-label">推理接入点 ID <span style="color:var(--text-muted);font-weight:normal;font-size:12px">(可选)</span></label>
        <input type="text" class="form-input" placeholder="留空使用默认模型，或输入你的接入点 ID（ep-xxx）" .value=${customModel ?? ""} @input=${this._onCustomModelInput} autocomplete="off" />
        <div class="form-hint">在火山方舟控制台「在线推理」创建的接入点 ID</div>
      </div>` : nothing}
      ${result && !result.success ? html`<div class="alert alert--err">${result.message}</div>` : nothing}
      <div class="btn-row">
        ${prov.apiKeyGuide?.length > 0
          ? html`<button class="btn btn--ghost" @click=${() => this._onConfigPrevStep()}>返回</button>`
          : html`<button class="btn btn--ghost" @click=${() => this._closeProviderConfig()}>取消</button>`}
        <button class="btn btn--primary" ?disabled=${!apiKey || detecting} @click=${() => this._onDetect()}>检测并保存</button>
      </div>
    `;
  }

  private _renderDetectingStep() {
    const provName = this._s.providerConfigProvider?.name ?? "";
    return html`<div class="detecting-state"><div class="spinner"></div><div class="detecting-text">正在检测 ${provName} 可用模型...</div><div class="detecting-text" style="font-size:12px;opacity:0.6">验证 API Key 并扫描支持的能力</div></div>`;
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
