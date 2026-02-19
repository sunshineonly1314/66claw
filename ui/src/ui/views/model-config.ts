/**
 * 模型设置页面 View
 *
 * 布局：
 * - 上方：3种能力（文字/图片/视频）卡片，显示当前模型，点击切换
 * - 下方：所有厂商 API Key 配置列表，setup 风格扁平展示
 */

import { html, css, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  createInitialModelConfigState,
  loadCapabilities,
  loadProviders,
  loadProviderGroups,
  openModelSelector,
  closeModelSelector,
  switchModel,
  openProviderConfig,
  closeProviderConfig,
  updateProviderApiKey,
  detectAndConfigureProvider,
  providerConfigNextStep,
  providerConfigPrevStep,
  navigateToProviderConfig,
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
  embedding: "智能推荐",
};

/** 面向用户的3大能力分组 */
const USER_CAPABILITIES: { id: string; name: string; desc: string; icon: string; caps: string[] }[] = [
  { id: "text", name: "文字", desc: "和 AI 聊天对话", icon: "💬", caps: ["text"] },
  { id: "image", name: "图片", desc: "看图理解 & AI 画图", icon: "🎨", caps: ["image-understanding", "image-generation"] },
  { id: "video", name: "视频", desc: "上传视频让 AI 分析", icon: "📹", caps: ["video"] },
];

@customElement("model-config-view")
export class ModelConfigView extends LitElement {
  @property({ type: Object })
  client: { request: (method: string, params?: unknown) => Promise<unknown> } | null = null;

  @property({ type: Boolean })
  connected: boolean = false;

  @state()
  private _s: ModelConfigState = createInitialModelConfigState();

  /* ═══════════════════════════════════════════════════════════════
     STYLES
     ═══════════════════════════════════════════════════════════════ */
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 0;
      overflow: hidden;
      font-family: var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      color: var(--text, #e8ecf1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .mc-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 20px 24px 32px;
    }
    .mc-scroll::-webkit-scrollbar { width: 5px; }
    .mc-scroll::-webkit-scrollbar-track { background: transparent; }
    .mc-scroll::-webkit-scrollbar-thumb { background: var(--border, #2d3a4d); border-radius: 3px; }

    /* ═══════ SECTION LABELS ═══════ */
    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted, #8b9caf);
      margin-bottom: 12px;
    }
    .section-divider {
      border: none;
      border-top: 1px solid var(--border, #2d3a4d);
      margin: 24px 0 20px;
    }

    /* ═══════ CAPABILITY CARDS (3 columns) ═══════ */
    .cap-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 0;
    }
    @media (max-width: 800px) {
      .cap-grid { grid-template-columns: 1fr; }
    }

    .cap-card {
      background: var(--card, #1a2332);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-lg, 12px);
      padding: 18px 20px;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
      animation: card-in 0.3s var(--ease-out, cubic-bezier(0.16,1,0.3,1)) both;
    }
    .cap-card:nth-child(1) { animation-delay: 0ms; }
    .cap-card:nth-child(2) { animation-delay: 60ms; }
    .cap-card:nth-child(3) { animation-delay: 120ms; }
    @keyframes card-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .cap-card:hover {
      border-color: var(--border-strong, #4a5a70);
      box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,.15));
    }
    .cap-card.active {
      border-color: rgba(16, 185, 129, 0.3);
    }
    .cap-card.inactive {
      border-style: dashed;
      opacity: 0.7;
    }
    .cap-card.inactive:hover {
      opacity: 1;
      border-style: solid;
    }

    .cap-card__head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .cap-card__icon {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md, 8px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      background: var(--bg-elevated, #1c242e);
      border: 1px solid var(--border, #2d3a4d);
      flex-shrink: 0;
    }
    .cap-card__title {
      flex: 1;
      min-width: 0;
    }
    .cap-card__name {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-strong, #fff);
    }
    .cap-card__desc {
      font-size: 12px;
      color: var(--muted, #8b9caf);
      margin-top: 2px;
    }
    .cap-card__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .cap-card__dot.on {
      background: var(--ok, #34d399);
      box-shadow: 0 0 6px rgba(52,211,153,0.5);
    }
    .cap-card__dot.off {
      background: var(--muted-strong, #6b7d91);
      opacity: 0.4;
    }

    /* Capability card — model rows */
    .cap-card__models {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cap-model-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: var(--bg-elevated, #1c242e);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-md, 8px);
      transition: border-color 0.12s;
    }
    .cap-model-row:hover {
      border-color: var(--border-strong, #4a5a70);
    }
    .cap-model-row__label {
      font-size: 11px;
      color: var(--muted, #8b9caf);
      width: 32px;
      flex-shrink: 0;
    }
    .cap-model-row__name {
      flex: 1;
      min-width: 0;
      font-size: 12px;
      font-family: var(--mono, "JetBrains Mono", monospace);
      color: var(--text, #e8ecf1);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cap-model-row__provider {
      font-size: 10px;
      color: var(--muted, #8b9caf);
      flex-shrink: 0;
    }
    .cap-model-row__badge {
      display: inline-flex;
      align-items: center;
      padding: 0 5px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      flex-shrink: 0;
      line-height: 1.5;
    }
    .cap-model-row__badge.free {
      background: var(--ok-subtle, rgba(52,211,153,.15));
      color: var(--ok, #34d399);
    }
    .cap-model-row__badge.paid {
      background: var(--warn-subtle, rgba(251,191,36,.15));
      color: var(--warn, #fbbf24);
    }

    .cap-card__empty {
      text-align: center;
      padding: 12px;
      font-size: 12px;
      color: var(--muted, #8b9caf);
      border: 1px dashed var(--border, #2d3a4d);
      border-radius: var(--radius-md, 8px);
    }

    .cap-card__switch {
      display: block;
      width: 100%;
      margin-top: 10px;
      padding: 7px 12px;
      background: transparent;
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-md, 8px);
      font-size: 12px;
      font-weight: 500;
      color: var(--muted, #8b9caf);
      cursor: pointer;
      text-align: center;
      transition: all 0.12s;
    }
    .cap-card__switch:hover {
      border-color: var(--accent, #6c8cff);
      color: var(--accent, #6c8cff);
      background: var(--accent-subtle, rgba(108,140,255,.06));
    }

    /* ═══════ PROVIDER LIST ═══════ */
    .prov-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .prov-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      background: var(--card, #1a2332);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-md, 8px);
      cursor: pointer;
      transition: border-color 0.12s, box-shadow 0.12s;
    }
    .prov-row:hover {
      border-color: var(--border-strong, #4a5a70);
      box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.12));
    }
    .prov-row.configured {
      border-color: rgba(16, 185, 129, 0.2);
    }

    .prov-row__icon {
      font-size: 22px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-elevated, #1c242e);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-sm, 6px);
      flex-shrink: 0;
    }

    .prov-row__info {
      flex: 1;
      min-width: 0;
    }
    .prov-row__name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-strong, #fff);
    }
    .prov-row__tagline {
      font-size: 12px;
      color: var(--muted, #8b9caf);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .prov-row__caps {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .cap-tag {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 4px;
      background: var(--bg-elevated, #1c242e);
      color: var(--muted, #8b9caf);
      border: 1px solid var(--border, #2d3a4d);
    }

    .prov-row__status {
      font-size: 12px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .prov-row__status.on {
      color: var(--ok, #34d399);
    }
    .prov-row__status.off {
      color: var(--muted, #8b9caf);
    }
    .prov-row__status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .prov-row__status-dot.on {
      background: var(--ok, #34d399);
      box-shadow: 0 0 4px rgba(52,211,153,0.5);
    }
    .prov-row__status-dot.off {
      background: var(--muted-strong, #6b7d91);
      opacity: 0.4;
    }

    .prov-row__arrow {
      font-size: 14px;
      color: var(--muted, #8b9caf);
      opacity: 0.4;
      flex-shrink: 0;
      transition: opacity 0.12s;
    }
    .prov-row:hover .prov-row__arrow {
      opacity: 1;
    }

    /* ═══════ MODAL ═══════ */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fade-in 0.15s ease-out;
    }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

    .modal {
      background: var(--surface, #1a2332);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-lg, 12px);
      max-width: 520px;
      width: 94%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: var(--shadow-xl, 0 24px 48px rgba(0,0,0,.4));
      animation: modal-in 0.2s var(--ease-out) both;
    }
    @keyframes modal-in {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 24px 0;
    }
    .modal-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-strong, #fff);
    }
    .modal-close {
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      background: none;
      border: 1px solid transparent;
      border-radius: var(--radius-sm, 6px);
      font-size: 16px;
      cursor: pointer;
      color: var(--muted, #8b9caf);
      transition: all 0.12s;
    }
    .modal-close:hover {
      background: var(--bg-hover, #2a3544);
      border-color: var(--border, #2d3a4d);
      color: var(--text, #e8ecf1);
    }
    .modal-body { padding: 20px 24px 24px; }

    /* Model selector items */
    .model-group { margin-bottom: 20px; }
    .model-group:last-child { margin-bottom: 0; }
    .model-group__header {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 8px; padding-bottom: 6px;
      border-bottom: 1px solid var(--border, #2d3a4d);
    }
    .model-group__icon { font-size: 14px; }
    .model-group__name { font-size: 12px; font-weight: 600; color: var(--text, #e8ecf1); flex: 1; }
    .model-group__badge {
      font-size: 10px; padding: 1px 6px;
      border-radius: var(--radius-sm, 6px); font-weight: 500;
    }
    .model-group__badge.current { background: var(--accent-subtle, rgba(108,140,255,.12)); color: var(--accent, #6c8cff); }
    .model-group__badge.configured { background: var(--ok-subtle, rgba(52,211,153,.1)); color: var(--ok, #34d399); }
    .model-group__badge.unconfigured { background: var(--bg-muted, #2a3544); color: var(--muted, #8b9caf); }

    .m-item {
      padding: 10px 12px;
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-md, 8px);
      cursor: pointer; transition: all 0.12s;
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 6px;
    }
    .m-item:last-child { margin-bottom: 0; }
    .m-item:hover { border-color: var(--border-strong, #4a5a70); background: var(--bg-elevated, #1c242e); }
    .m-item.current { border-color: var(--accent, #6c8cff); background: var(--accent-subtle, rgba(108,140,255,.06)); }
    .m-item.locked { opacity: 0.35; cursor: not-allowed; }
    .m-item__info { flex: 1; min-width: 0; }
    .m-item__name { font-size: 13px; font-weight: 500; color: var(--text, #e8ecf1); font-family: var(--mono, monospace); }
    .m-item__end { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .checkmark { color: var(--accent, #6c8cff); font-weight: 700; font-size: 14px; }

    .badge {
      display: inline-flex; align-items: center; padding: 0px 5px;
      border-radius: 3px; font-size: 9px; font-weight: 700;
      letter-spacing: 0.04em; text-transform: uppercase; line-height: 1.5;
    }
    .badge--free { background: var(--ok-subtle, rgba(52,211,153,.15)); color: var(--ok, #34d399); }
    .badge--paid { background: var(--warn-subtle, rgba(251,191,36,.15)); color: var(--warn, #fbbf24); }

    .add-provider-link {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px;
      border: 1px dashed var(--border, #2d3a4d);
      border-radius: var(--radius-md, 8px);
      font-size: 12px; color: var(--accent, #6c8cff);
      cursor: pointer; transition: all 0.15s; margin-top: 6px;
    }
    .add-provider-link:hover { border-color: var(--accent, #6c8cff); background: var(--accent-subtle, rgba(108,140,255,.06)); }

    /* Provider config modal */
    .step-indicator { display: flex; gap: 6px; padding: 16px 24px 0; }
    .step-bar { flex: 1; height: 3px; border-radius: 2px; background: var(--border, #2d3a4d); transition: background 0.2s; }
    .step-bar.done { background: var(--ok, #34d399); }
    .step-bar.active { background: var(--accent, #6c8cff); }

    .guide-caps { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
    .guide-cap-tag {
      font-size: 11px; padding: 3px 10px;
      border-radius: var(--radius-sm, 6px);
      background: var(--accent-subtle, rgba(108,140,255,.1));
      color: var(--accent, #6c8cff);
      border: 1px solid rgba(108,140,255, 0.15);
    }

    .guide-steps { list-style: none; counter-reset: guide-step; }
    .guide-step {
      position: relative; padding: 10px 0 10px 36px;
      font-size: 13px; color: var(--text, #e8ecf1);
      counter-increment: guide-step;
      border-left: 1px solid var(--border, #2d3a4d); margin-left: 12px;
    }
    .guide-step:last-child { border-left-color: transparent; }
    .guide-step::before {
      content: counter(guide-step);
      position: absolute; left: -10px; top: 8px;
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--bg-elevated, #1c242e);
      border: 1px solid var(--border-strong, #4a5a70);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600; color: var(--muted, #8b9caf);
    }

    .guide-link {
      display: inline-flex; align-items: center; gap: 4px;
      margin-top: 16px; padding: 8px 16px;
      background: var(--accent-subtle, rgba(108,140,255,.1));
      border: 1px solid rgba(108,140,255, 0.2);
      border-radius: var(--radius-md, 8px);
      font-size: 12px; color: var(--accent, #6c8cff);
      cursor: pointer; text-decoration: none; transition: all 0.15s;
    }
    .guide-link:hover { background: rgba(108,140,255,.15); border-color: var(--accent, #6c8cff); }

    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--text, #e8ecf1); }
    .form-input {
      width: 100%; padding: 10px 12px;
      background: var(--bg-elevated, #1c242e);
      border: 1px solid var(--border, #2d3a4d);
      border-radius: var(--radius-md, 8px);
      font-size: 13px; font-family: var(--mono, monospace);
      color: var(--text, #e8ecf1); box-sizing: border-box; transition: border-color 0.12s;
    }
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
    .result-cap {
      display: flex; align-items: center; gap: 4px; padding: 4px 12px;
      background: var(--ok-subtle, rgba(52,211,153,.1));
      border: 1px solid rgba(52,211,153,.2);
      border-radius: var(--radius-sm, 6px); font-size: 12px; color: var(--ok, #34d399);
    }

    .btn-row { display: flex; gap: 8px; margin-top: 20px; }
    .btn {
      flex: 1; padding: 9px 16px; border: none;
      border-radius: var(--radius-md, 8px); font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all 0.12s;
    }
    .btn--primary { background: var(--text-strong, #fff); color: var(--bg, #0f1419); }
    .btn--primary:hover { opacity: 0.9; }
    .btn--primary:disabled { opacity: 0.3; cursor: not-allowed; }
    .btn--ghost { background: transparent; color: var(--text, #e8ecf1); border: 1px solid var(--border, #2d3a4d); }
    .btn--ghost:hover { border-color: var(--border-strong, #4a5a70); }

    .alert { padding: 10px 14px; border-radius: var(--radius-md, 8px); margin-top: 12px; font-size: 13px; font-weight: 500; }
    .alert--err { background: var(--danger-subtle, rgba(248,113,113,.15)); color: var(--danger, #f87171); }

    .loading-state, .error-state { text-align: center; padding: 80px 24px; }
    .loading-state { color: var(--muted, #8b9caf); font-size: 14px; }
    .error-state   { color: var(--danger, #f87171); font-size: 14px; }

    .modal::-webkit-scrollbar { width: 6px; }
    .modal::-webkit-scrollbar-track { background: transparent; }
    .modal::-webkit-scrollbar-thumb { background: var(--border, #2d3a4d); border-radius: 3px; }
  `;

  /* ═══════ LIFECYCLE ═══════ */
  connectedCallback() {
    super.connectedCallback();
    if (this.client && this.connected) this._loadData();
  }

  updated(changedProperties: Map<PropertyKey, unknown>) {
    super.updated(changedProperties);
    if (
      (changedProperties.has("client") || changedProperties.has("connected")) &&
      this.client && this.connected &&
      this._s.capabilities.length === 0 &&
      !this._s.modelConfigLoading
    ) {
      this._loadData();
    }
  }

  /* ═══════ DATA ═══════ */
  private async _loadData() {
    const h = this._host();
    await Promise.all([loadCapabilities(h), loadProviders(h), loadProviderGroups(h)]);
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
  private async _onCapCardClick(userCap: typeof USER_CAPABILITIES[number]) {
    // 找到该分组下第一个 active 的 capability，打开模型选择器
    const activeCap = userCap.caps
      .map(c => this._s.capabilities.find(cap => cap.capability === c && cap.status === "active"))
      .find(c => c);

    if (activeCap) {
      const h = this._host();
      await openModelSelector(h, activeCap);
      this._sync(h);
    }
  }

  private async _onModelSelect(m: ModelInfo) {
    if (!m.configured) return;
    const h = this._host();
    await switchModel(h, m.providerId, m.modelId);
    this._sync(h);
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

  private _closeProviderConfig() {
    const h = this._host();
    closeProviderConfig(h);
    this._sync(h);
  }

  private _onApiKeyInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const h = this._host();
    updateProviderApiKey(h, input.value);
    this._sync(h);
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

  /* ═══════ HELPERS ═══════ */
  /** 获取用户能力分组下的所有子能力状态 */
  private _getUserCapModels(userCap: typeof USER_CAPABILITIES[number]) {
    return userCap.caps
      .map(c => this._s.capabilities.find(cap => cap.capability === c))
      .filter((c): c is Capability => !!c);
  }

  private _isUserCapActive(userCap: typeof USER_CAPABILITIES[number]): boolean {
    return this._getUserCapModels(userCap).some(c => c.status === "active");
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

  /* ═══════ RENDER ═══════ */
  render() {
    if (this._s.modelConfigLoading)
      return html`<div class="loading-state">加载中...</div>`;
    if (this._s.modelConfigError && this._s.capabilities.length === 0)
      return html`<div class="error-state">${this._s.modelConfigError}</div>`;

    return html`
      <div class="mc-scroll">
        <!-- 上方：3种能力 -->
        <p class="section-label">AI 能力</p>
        <div class="cap-grid">
          ${USER_CAPABILITIES.map(uc => this._renderCapCard(uc))}
        </div>

        <hr class="section-divider" />

        <!-- 下方：服务商配置 -->
        <p class="section-label">服务商配置</p>
        <div class="prov-list">
          ${this._s.providers.map(p => this._renderProviderRow(p))}
        </div>
      </div>

      ${this._s.modelSelectorOpen ? this._renderModelSelector() : nothing}
      ${this._s.providerConfigOpen ? this._renderProviderConfig() : nothing}
    `;
  }

  /* ═══════ CAPABILITY CARD ═══════ */
  private _renderCapCard(userCap: typeof USER_CAPABILITIES[number]) {
    const subCaps = this._getUserCapModels(userCap);
    const active = this._isUserCapActive(userCap);
    const activeSubs = subCaps.filter(c => c.status === "active" && c.currentModel);

    return html`
      <div class="cap-card ${active ? 'active' : 'inactive'}">
        <div class="cap-card__head">
          <div class="cap-card__icon">${userCap.icon}</div>
          <div class="cap-card__title">
            <div class="cap-card__name">${userCap.name}</div>
            <div class="cap-card__desc">${userCap.desc}</div>
          </div>
          <div class="cap-card__dot ${active ? 'on' : 'off'}"></div>
        </div>

        ${active
          ? html`
              <div class="cap-card__models">
                ${activeSubs.map(c => html`
                  <div class="cap-model-row">
                    <span class="cap-model-row__label">${CAPABILITY_NAME_MAP[c.capability] ?? c.name}</span>
                    <span class="cap-model-row__name">${c.currentModel!.modelName}</span>
                    <span class="cap-model-row__provider">${c.currentModel!.providerName}</span>
                    <span class="cap-model-row__badge ${c.currentModel!.isFree ? 'free' : 'paid'}">
                      ${c.currentModel!.isFree ? "FREE" : "PAID"}
                    </span>
                  </div>
                `)}
              </div>
              <button class="cap-card__switch" @click=${() => this._onCapCardClick(userCap)}>切换模型</button>
            `
          : html`
              <div class="cap-card__empty">未开通 · 请先配置下方服务商</div>
            `}
      </div>
    `;
  }

  /* ═══════ PROVIDER ROW ═══════ */
  private _renderProviderRow(p: ProviderInfo) {
    return html`
      <div
        class="prov-row ${p.configured ? 'configured' : ''}"
        @click=${() => this._onProviderClick(p)}
      >
        <div class="prov-row__icon">${p.icon}</div>
        <div class="prov-row__info">
          <div class="prov-row__name">${p.name}</div>
          ${p.tagline ? html`<div class="prov-row__tagline">${p.tagline}</div>` : nothing}
        </div>
        <div class="prov-row__caps">
          ${p.capabilities.map(c => html`<span class="cap-tag">${CAPABILITY_NAME_MAP[c] ?? c}</span>`)}
        </div>
        <div class="prov-row__status ${p.configured ? 'on' : 'off'}">
          <span class="prov-row__status-dot ${p.configured ? 'on' : 'off'}"></span>
          ${p.configured ? "已配置" : "未配置"}
        </div>
        <span class="prov-row__arrow">›</span>
      </div>
    `;
  }

  /* ═══════ MODEL SELECTOR MODAL ═══════ */
  private _renderModelSelector() {
    const { modelSelectorCapability: cap, modelSelectorModels: models, modelSelectorLoading: loading } = this._s;
    if (!cap) return nothing;
    const providerGroups = this._groupModelsByProvider(models);

    return html`
      <div class="modal-overlay" @click=${() => this._closeModelSelector()}>
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

    return html`
      <div class="model-group">
        <div class="model-group__header">
          <span class="model-group__icon">${group.providerIcon}</span>
          <span class="model-group__name">${group.providerName}</span>
          <span class="model-group__badge ${statusClass}">${statusText}</span>
        </div>
        ${group.configured
          ? group.models.map(m => html`
              <div class="m-item ${m.active ? 'current' : ''}" @click=${() => this._onModelSelect(m)}>
                <div class="m-item__info"><div class="m-item__name">${m.modelName}</div></div>
                <div class="m-item__end">
                  <span class="badge ${m.pricing.type === 'free' ? 'badge--free' : 'badge--paid'}">${m.pricing.type === "free" ? "FREE" : "PAID"}</span>
                  ${m.active ? html`<span class="checkmark">✓</span>` : nothing}
                </div>
              </div>
            `)
          : html`
              ${group.models.map(m => html`
                <div class="m-item locked">
                  <div class="m-item__info"><div class="m-item__name">${m.modelName}</div></div>
                  <div class="m-item__end">
                    <span class="badge ${m.pricing.type === 'free' ? 'badge--free' : 'badge--paid'}">${m.pricing.type === "free" ? "FREE" : "PAID"}</span>
                  </div>
                </div>
              `)}
              <div class="add-provider-link" @click=${() => this._onNavigateToProvider(group.providerId)}>+ 添加 ${group.providerName} 配置</div>
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
      <div class="modal-overlay" @click=${() => this._closeProviderConfig()}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="step-indicator">
            ${[0, 1, 2, 3].map(i => html`<div class="step-bar ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}"></div>`)}
          </div>
          <div class="modal-header">
            <span class="modal-title">
              ${step === "guide" ? `配置 ${prov.name}` : step === "apikey" ? "输入 API Key" : step === "detecting" ? "检测中..." : "配置完成"}
            </span>
            <button class="modal-close" @click=${() => this._closeProviderConfig()}>&times;</button>
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
        <button class="btn btn--primary" @click=${() => this._onConfigNextStep()}>下一步</button>
      </div>
    `;
  }

  private _renderApiKeyStep(prov: ProviderInfo) {
    const { providerConfigApiKey: apiKey, providerConfigTestResult: result } = this._s;
    return html`
      <div class="form-group">
        <label class="form-label">${prov.name} API Key</label>
        <input type="text" class="form-input" placeholder="粘贴你的 API Key" .value=${apiKey} @input=${this._onApiKeyInput} />
        <div class="form-hint">配置后会自动检测并开通所有可用功能</div>
      </div>
      ${result && !result.success ? html`<div class="alert alert--err">${result.message}</div>` : nothing}
      <div class="btn-row">
        ${prov.apiKeyGuide?.length > 0
          ? html`<button class="btn btn--ghost" @click=${() => this._onConfigPrevStep()}>返回</button>`
          : html`<button class="btn btn--ghost" @click=${() => this._closeProviderConfig()}>取消</button>`}
        <button class="btn btn--primary" ?disabled=${!apiKey} @click=${() => this._onDetect()}>检测并保存</button>
      </div>
    `;
  }

  private _renderDetectingStep() {
    return html`<div class="detecting-state"><div class="spinner"></div><div class="detecting-text">正在检测可用模型...</div></div>`;
  }

  private _renderResultStep(prov: ProviderInfo) {
    const autoEnabled = this._s.providerConfigAutoEnabled;
    const enabledCaps = autoEnabled ? Object.keys(autoEnabled) : [];
    return html`
      <div class="result-state">
        <div class="result-icon">✅</div>
        <div class="result-title">${prov.name} 配置成功</div>
        <div class="result-desc">${enabledCaps.length > 0 ? `已自动启用 ${enabledCaps.length} 个能力` : "配置已保存"}</div>
        ${enabledCaps.length > 0 ? html`<div class="result-caps">${enabledCaps.map(c => html`<span class="result-cap">✓ ${CAPABILITY_NAME_MAP[c] ?? c}</span>`)}</div>` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "model-config-view": ModelConfigView;
  }
}
