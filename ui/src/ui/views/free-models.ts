/**
 * 免费模型管理页 - ClawdbotCN 独家福利
 * 每日免费大模型平滑切换
 */
import { html, nothing } from "lit";
import { t } from "../i18n/index.js";

/* ===========================================
   类型定义
   =========================================== */

export interface FreeModelProvider {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  freeQuota: {
    type: "daily" | "permanent";
    limit: number;
    unit: "tokens" | "requests";
    resetsAt?: string;
  };
  registerUrl: string;
  docsUrl: string;
  features: string[];
  recommended: boolean;
}

export interface FreeModelAccount {
  providerId: string;
  apiKey: string;
  enabled: boolean;
  priority: number;
  todayUsage: {
    tokens: number;
    requests: number;
    lastUpdated: string;
  };
  status: "active" | "exhausted" | "error" | "disabled";
  lastError?: string;
}

export interface FreeModelsStats {
  todaySavings: number;
  totalSavings: number;
  todayFreeRequests: number;
  lastResetDate: string;
}

export interface FreeModelSwitchRecord {
  timestamp: string;
  fromProvider: string;
  toProvider: string;
  reason: "quota_exhausted" | "error" | "manual";
  savings: number;
}

export interface FreeModelsProps {
  connected: boolean;
  loading: boolean;
  enabled: boolean;
  providers: FreeModelProvider[];
  accounts: FreeModelAccount[];
  stats: FreeModelsStats;
  switchHistory: FreeModelSwitchRecord[];
  error: string | null;
  // 弹窗状态
  configModalOpen: boolean;
  configModalProvider: FreeModelProvider | null;
  configModalApiKey: string;
  configModalTesting: boolean;
  configModalTestResult: { success: boolean; message: string } | null;
  configModalSaving: boolean;
  // 删除确认
  deleteModalOpen: boolean;
  deleteModalProvider: FreeModelProvider | null;
  deleteModalDeleting: boolean;
  // 回调
  onToggleEnabled: (enabled: boolean) => void;
  onOpenConfigModal: (provider: FreeModelProvider) => void;
  onCloseConfigModal: () => void;
  onApiKeyChange: (apiKey: string) => void;
  onTestConnection: () => void;
  onSaveConfig: () => void;
  onOpenDeleteModal: (provider: FreeModelProvider) => void;
  onCloseDeleteModal: () => void;
  onConfirmDelete: () => void;
  onSetPreferred: (providerId: string) => void;
  onRefresh: () => void;
}

/* ===========================================
   主渲染函数
   =========================================== */

export function renderFreeModels(props: FreeModelsProps) {
  // 确定显示内容的逻辑：
  // 1. 如果正在加载且已连接，显示加载状态
  // 2. 如果有错误，显示错误
  // 3. 如果未连接且无数据，显示空状态（引导配置）
  // 4. 如果有账户数据，显示数据（即使断开连接也能查看已配置的内容）
  // 5. 否则显示空状态

  const renderContent = () => {
    // 正在加载（仅在已连接时显示）
    if (props.loading && props.connected) {
      return renderLoading();
    }

    // 有错误
    if (props.error) {
      return renderError(props.error, props.onRefresh);
    }

    // 有账户数据，显示数据视图（即使断开连接也可以查看）
    if (props.accounts.length > 0) {
      return renderWithData(props);
    }

    // 有 providers 数据，显示空状态（引导配置）
    if (props.providers.length > 0) {
      return renderEmpty(props);
    }

    // 未连接且无数据，显示连接提示
    if (!props.connected) {
      return renderConnectionRequired(props.onRefresh);
    }

    // 默认显示空状态
    return renderEmpty(props);
  };

  return html`
    <section class="free-models">
      ${renderHeader()}
      ${renderContent()}
      ${props.configModalOpen ? renderConfigModal(props) : nothing}
      ${props.deleteModalOpen ? renderDeleteModal(props) : nothing}
    </section>
  `;
}

/* ===========================================
   页面头部
   =========================================== */

function renderHeader() {
  return html`
    <header class="fm-header">
      <div class="fm-header__eyebrow">
        <span>✨</span>
        <span>${t("freeModels.eyebrow")}</span>
      </div>
      <h1 class="fm-header__title">${t("freeModels.title")}</h1>
      <p class="fm-header__subtitle">${t("freeModels.subtitle")}</p>
    </header>
  `;
}

/* ===========================================
   加载状态
   =========================================== */

function renderLoading() {
  return html`
    <div class="fm-empty fm-loading">
      <div class="fm-empty__icon">⏳</div>
      <div class="fm-empty__title">${t("common.loading")}</div>
    </div>
  `;
}

/* ===========================================
   未连接状态
   =========================================== */

function renderConnectionRequired(onRefresh: () => void) {
  return html`
    <div class="fm-empty">
      <div class="fm-empty__icon">🔌</div>
      <div class="fm-empty__title">等待连接 Gateway</div>
      <div class="fm-empty__desc">正在建立连接，请稍候...</div>
      <button class="btn primary" @click=${onRefresh}>
        ${t("common.retry")}
      </button>
    </div>
  `;
}

/* ===========================================
   错误状态
   =========================================== */

function renderError(error: string, onRefresh: () => void) {
  return html`
    <div class="fm-empty">
      <div class="fm-empty__icon">😅</div>
      <div class="fm-empty__title">${t("freeModels.error.title")}</div>
      <div class="fm-empty__desc">${error}</div>
      <button class="btn primary" @click=${onRefresh}>
        ${t("common.retry")}
      </button>
    </div>
  `;
}

/* ===========================================
   空状态 - 引导用户配置
   =========================================== */

function renderEmpty(props: FreeModelsProps) {
  const unconfiguredProviders = props.providers.filter(
    (p) => !props.accounts.some((a) => a.providerId === p.id)
  );

  return html`
    <div class="fm-empty">
      <div class="fm-empty__icon">💰</div>
      <div class="fm-empty__title">${t("freeModels.empty.title")}</div>
      <div class="fm-empty__desc">${t("freeModels.empty.desc")}</div>

      <div class="fm-features">
        <div class="fm-feature">
          <span class="fm-feature__icon">🎁</span>
          <span>${t("freeModels.feature.dailyTokens")}</span>
        </div>
        <div class="fm-feature">
          <span class="fm-feature__icon">🔄</span>
          <span>${t("freeModels.feature.autoSwitch")}</span>
        </div>
        <div class="fm-feature">
          <span class="fm-feature__icon">💵</span>
          <span>${t("freeModels.feature.saveMoney")}</span>
        </div>
      </div>
    </div>

    <div class="fm-section" style="margin-top: 32px;">
      <div class="fm-section__header">
        <div class="fm-section__title">
          <span>🚀</span>
          <span>${t("freeModels.selectProvider")}</span>
        </div>
      </div>
      <div class="fm-providers">
        ${unconfiguredProviders.map((provider) =>
          renderProviderCard(provider, props.onOpenConfigModal)
        )}
      </div>
    </div>
  `;
}

/* ===========================================
   Provider 选择卡片
   =========================================== */

function renderProviderCard(
  provider: FreeModelProvider,
  onSelect: (p: FreeModelProvider) => void,
  configured = false
) {
  const quotaText = `${formatNumber(provider.freeQuota.limit)} ${provider.freeQuota.unit === "tokens" ? "tokens" : t("freeModels.requests")}`;

  return html`
    <div
      class="fm-provider ${provider.recommended ? "fm-provider--recommended" : ""} ${configured ? "fm-provider--configured" : ""}"
      @click=${() => !configured && onSelect(provider)}
    >
      <div class="fm-provider__header">
        <div class="fm-provider__name">
          ${provider.name}
        </div>
        ${provider.recommended
          ? html`<span class="fm-provider__badge fm-provider__badge--recommended">${t("freeModels.recommended")}</span>`
          : nothing}
        ${configured
          ? html`<span class="fm-provider__badge fm-provider__badge--configured">${t("freeModels.configured")}</span>`
          : nothing}
      </div>
      <div class="fm-provider__quota">
        <span>${t("freeModels.dailyQuota")}:</span>
        <span class="fm-provider__quota-value">${quotaText}</span>
      </div>
      <div class="fm-provider__features">
        ${provider.features.slice(0, 3).map(
          (f) => html`<span class="fm-provider__feature">${f}</span>`
        )}
      </div>
      ${!configured
        ? html`
            <button class="btn primary fm-provider__action">
              ${t("freeModels.configureNow")}
            </button>
          `
        : nothing}
    </div>
  `;
}

/* ===========================================
   有数据态
   =========================================== */

function renderWithData(props: FreeModelsProps) {
  const preferredAccount = props.accounts.find((a) => a.priority === 1);
  const unconfiguredProviders = props.providers.filter(
    (p) => !props.accounts.some((a) => a.providerId === p.id)
  );

  return html`
    <!-- 统计区 -->
    ${renderStats(props.stats, props.accounts.length)}

    <!-- 主开关 -->
    ${renderToggle(props.enabled, props.onToggleEnabled)}

    <!-- 已配置列表 -->
    <div class="fm-section">
      <div class="fm-section__header">
        <div class="fm-section__title">
          <span>⚡</span>
          <span>${t("freeModels.configuredAccounts")}</span>
        </div>
        <span class="fm-section__count">${props.accounts.length}</span>
      </div>
      <div class="fm-accounts">
        ${props.accounts.map((account) => {
          const provider = props.providers.find((p) => p.id === account.providerId);
          if (!provider) return nothing;
          const isPreferred = account.priority === 1;
          return renderAccountCard(
            account,
            provider,
            isPreferred,
            props.onSetPreferred,
            props.onOpenDeleteModal,
            props.onOpenConfigModal
          );
        })}
      </div>
    </div>

    <!-- 可添加列表 -->
    ${unconfiguredProviders.length > 0
      ? html`
          <div class="fm-section">
            <div class="fm-section__header">
              <div class="fm-section__title">
                <span>➕</span>
                <span>${t("freeModels.addMore")}</span>
              </div>
            </div>
            <div class="fm-providers">
              ${unconfiguredProviders.map((provider) =>
                renderProviderCard(provider, props.onOpenConfigModal)
              )}
            </div>
          </div>
        `
      : nothing}

    <!-- 切换历史 -->
    ${props.switchHistory.length > 0
      ? renderHistory(props.switchHistory, props.providers)
      : nothing}
  `;
}

/* ===========================================
   统计区
   =========================================== */

function renderStats(stats: FreeModelsStats, accountCount: number) {
  return html`
    <div class="fm-stats">
      <div class="fm-stat fm-stat--primary">
        <div class="fm-stat__icon">💰</div>
        <div class="fm-stat__value">¥${stats.todaySavings.toFixed(2)}</div>
        <div class="fm-stat__label">${t("freeModels.stats.todaySavings")}</div>
      </div>
      <div class="fm-stat">
        <div class="fm-stat__icon">📊</div>
        <div class="fm-stat__value">¥${stats.totalSavings.toFixed(2)}</div>
        <div class="fm-stat__label">${t("freeModels.stats.totalSavings")}</div>
      </div>
      <div class="fm-stat">
        <div class="fm-stat__icon">🎯</div>
        <div class="fm-stat__value">${stats.todayFreeRequests}</div>
        <div class="fm-stat__label">${t("freeModels.stats.freeRequests")}</div>
      </div>
      <div class="fm-stat">
        <div class="fm-stat__icon">🔌</div>
        <div class="fm-stat__value">${accountCount}</div>
        <div class="fm-stat__label">${t("freeModels.stats.accounts")}</div>
      </div>
    </div>
  `;
}

/* ===========================================
   主开关
   =========================================== */

function renderToggle(enabled: boolean, onToggle: (v: boolean) => void) {
  return html`
    <div class="fm-toggle-card">
      <div class="fm-toggle__info">
        <div class="fm-toggle__title">${t("freeModels.toggle.title")}</div>
        <div class="fm-toggle__desc">${t("freeModels.toggle.desc")}</div>
      </div>
      <label class="fm-switch">
        <input
          type="checkbox"
          .checked=${enabled}
          @change=${(e: Event) => onToggle((e.target as HTMLInputElement).checked)}
        />
        <span class="fm-switch__track"></span>
        <span class="fm-switch__thumb"></span>
      </label>
    </div>
  `;
}

/* ===========================================
   账号卡片
   =========================================== */

/**
 * 解析账号状态，返回统一的状态信息
 */
function resolveAccountStatus(account: FreeModelAccount): {
  icon: string;
  text: string;
  tooltip: string;
  dotClass: string;
  cardClass: string;
  needsReconfigure: boolean;
} {
  // 检查 enabled 字段
  if (account.enabled === false) {
    return {
      icon: "🚫",
      text: t("freeModels.status.disabled"),
      tooltip: "该账号已被手动禁用，点击重新配置以启用",
      dotClass: "fm-account__state-dot--disabled",
      cardClass: "fm-account--disabled",
      needsReconfigure: true,
    };
  }

  // 检查 status 字段
  switch (account.status) {
    case "active":
      return {
        icon: "✅",
        text: t("freeModels.status.active"),
        tooltip: "账号正常，可用于聊天",
        dotClass: "",
        cardClass: "",
        needsReconfigure: false,
      };
    case "exhausted":
      return {
        icon: "⏸️",
        text: t("freeModels.status.exhausted"),
        tooltip: "今日免费额度已用完，将在次日 00:00 重置",
        dotClass: "fm-account__state-dot--exhausted",
        cardClass: "fm-account--exhausted",
        needsReconfigure: false,
      };
    case "error":
      return {
        icon: "❌",
        text: t("freeModels.status.error"),
        tooltip: account.lastError ? `错误：${account.lastError}` : "连接错误，请检查 API Key",
        dotClass: "fm-account__state-dot--error",
        cardClass: "fm-account--error",
        needsReconfigure: true,
      };
    case "disabled":
      return {
        icon: "🚫",
        text: t("freeModels.status.disabled"),
        tooltip: "账号已禁用",
        dotClass: "fm-account__state-dot--disabled",
        cardClass: "fm-account--disabled",
        needsReconfigure: true,
      };
    default:
      // status 为 undefined 或其他未知值
      return {
        icon: "⚠️",
        text: "状态异常",
        tooltip: `状态字段异常 (status=${account.status ?? "undefined"})，请重新配置`,
        dotClass: "fm-account__state-dot--warning",
        cardClass: "fm-account--warning",
        needsReconfigure: true,
      };
  }
}

function renderAccountCard(
  account: FreeModelAccount,
  provider: FreeModelProvider,
  isPreferred: boolean,
  onSetPreferred: (id: string) => void,
  onDelete: (p: FreeModelProvider) => void,
  onOpenConfig: (p: FreeModelProvider) => void
) {
  const usagePercent = Math.min(
    ((account.todayUsage?.tokens ?? 0) / provider.freeQuota.limit) * 100,
    100
  );
  const usageClass =
    usagePercent >= 90 ? "fm-account__usage-fill--danger" :
    usagePercent >= 70 ? "fm-account__usage-fill--warning" : "";

  // 使用统一的状态解析函数
  const statusInfo = resolveAccountStatus(account);
  
  // 如果是首选账号且状态正常，添加首选样式
  const cardClass = statusInfo.cardClass || (isPreferred ? "fm-account--preferred" : "");

  return html`
    <div class="fm-account ${cardClass}">
      <div class="fm-account__icon" title="${statusInfo.tooltip}">
        ${statusInfo.icon}
      </div>
      <div class="fm-account__info">
        <div class="fm-account__name">
          ${provider.name}
          ${isPreferred
            ? html`<span class="fm-account__preferred-badge">⭐ ${t("freeModels.preferred")}</span>`
            : nothing}
        </div>
        <div class="fm-account__status">
          <div class="fm-account__usage">
            <div class="fm-account__usage-bar">
              <div
                class="fm-account__usage-fill ${usageClass}"
                style="width: ${usagePercent}%"
              ></div>
            </div>
            <span>${formatNumber(account.todayUsage?.tokens ?? 0)} / ${formatNumber(provider.freeQuota.limit)}</span>
          </div>
          <div class="fm-account__state" title="${statusInfo.tooltip}">
            <span class="fm-account__state-dot ${statusInfo.dotClass}"></span>
            <span>${statusInfo.text}</span>
          </div>
        </div>
      </div>
      <div class="fm-account__actions">
        ${statusInfo.needsReconfigure
          ? html`
              <button
                class="btn btn--sm primary"
                @click=${() => onOpenConfig(provider)}
                title="${statusInfo.tooltip}"
              >
                重新配置
              </button>
            `
          : nothing}
        ${!isPreferred && !statusInfo.needsReconfigure
          ? html`
              <button
                class="btn btn--sm"
                @click=${() => onSetPreferred(account.providerId)}
              >
                ${t("freeModels.setPreferred")}
              </button>
            `
          : nothing}
        <button
          class="btn btn--sm danger"
          @click=${() => onDelete(provider)}
        >
          ${t("common.delete")}
        </button>
      </div>
    </div>
  `;
}

/* ===========================================
   切换历史
   =========================================== */

function renderHistory(
  history: FreeModelSwitchRecord[],
  providers: FreeModelProvider[]
) {
  const getProviderName = (id: string) =>
    providers.find((p) => p.id === id)?.name ?? id;

  return html`
    <div class="fm-section fm-history">
      <details>
        <summary class="fm-history__toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span>${t("freeModels.switchHistory")} (${history.length})</span>
        </summary>
        <ul class="fm-history__list">
          ${history.slice(0, 10).map(
            (record) => html`
              <li class="fm-history__item">
                <span class="fm-history__time">
                  ${new Date(record.timestamp).toLocaleString()}
                </span>
                <span class="fm-history__change">
                  ${getProviderName(record.fromProvider)} → ${getProviderName(record.toProvider)}
                </span>
                <span class="fm-history__savings">+¥${record.savings.toFixed(2)}</span>
              </li>
            `
          )}
        </ul>
      </details>
    </div>
  `;
}

/* ===========================================
   配置弹窗
   =========================================== */

function renderConfigModal(props: FreeModelsProps) {
  const provider = props.configModalProvider;
  if (!provider) return nothing;

  // 只要输入了 API Key 就可以保存（保存时自动验证）
  const canSave =
    props.configModalApiKey.trim().length > 0 &&
    !props.configModalSaving;

  return html`
    <div
      class="fm-modal-overlay"
      @click=${(e: Event) => {
        if (e.target === e.currentTarget) props.onCloseConfigModal();
      }}
    >
      <div class="fm-modal">
        <div class="fm-modal__header">
          <div class="fm-modal__title">
            <span>⚙️</span>
            <span>${t("freeModels.modal.configTitle", { name: provider.name })}</span>
          </div>
          <button class="fm-modal__close" @click=${props.onCloseConfigModal}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="fm-modal__body">
          <!-- 额度信息卡片 -->
          <div class="fm-modal__info">
            <div class="fm-modal__info-item">
              <span class="fm-modal__info-label">${t("freeModels.dailyQuota")}</span>
              <span class="fm-modal__info-value">
                ${formatNumber(provider.freeQuota.limit)} tokens
              </span>
            </div>
            <div class="fm-modal__info-item">
              <span class="fm-modal__info-label">${t("freeModels.resetTime")}</span>
              <span class="fm-modal__info-value">
                ${provider.freeQuota.resetsAt ?? "00:00 CST"}
              </span>
            </div>
          </div>

          <!-- 步骤引导 -->
          <div class="fm-steps">
            <div class="fm-step">
              <div class="fm-step__number">1</div>
              <div class="fm-step__content">
                <div class="fm-step__title">${t("freeModels.step1.title")}</div>
                <div class="fm-step__desc">${t("freeModels.step1.desc")}</div>
                <a
                  href="${provider.registerUrl}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="fm-step__link btn primary"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  ${t("freeModels.openRegisterPage", { name: provider.name })}
                </a>
              </div>
            </div>

            <div class="fm-step">
              <div class="fm-step__number">2</div>
              <div class="fm-step__content">
                <div class="fm-step__title">${t("freeModels.step2.title")}</div>
                <div class="fm-step__desc">${t("freeModels.step2.desc")}</div>
              </div>
            </div>

            <div class="fm-step">
              <div class="fm-step__number">3</div>
              <div class="fm-step__content">
                <div class="fm-step__title">${t("freeModels.step3.title")}</div>
                <div class="fm-form__field" style="margin-top: 12px;">
                  <input
                    type="password"
                    class="fm-form__input"
                    placeholder="${t("freeModels.modal.apiKeyPlaceholder")}"
                    .value=${props.configModalApiKey}
                    @input=${(e: Event) =>
                      props.onApiKeyChange((e.target as HTMLInputElement).value)}
                    ?disabled=${props.configModalTesting || props.configModalSaving}
                  />
                </div>

                ${props.configModalTestResult
                  ? html`
                      <div
                        class="fm-test-result ${props.configModalTestResult.success ? "fm-test-result--success" : "fm-test-result--error"}"
                      >
                        <span>${props.configModalTestResult.success ? "✅" : "❌"}</span>
                        <span>${props.configModalTestResult.message}</span>
                      </div>
                    `
                  : props.configModalSaving
                    ? html`
                        <div class="fm-test-result fm-test-result--loading">
                          <span>⏳</span>
                          <span>正在验证 API 密钥...</span>
                        </div>
                      `
                    : nothing}
              </div>
            </div>
          </div>
        </div>

        <div class="fm-modal__footer">
          <button
            class="btn primary"
            @click=${props.onSaveConfig}
            ?disabled=${!canSave}
            style="min-width: 140px;"
          >
            ${props.configModalSaving ? "验证并保存中..." : t("freeModels.modal.save")}
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ===========================================
   删除确认弹窗
   =========================================== */

function renderDeleteModal(props: FreeModelsProps) {
  const provider = props.deleteModalProvider;
  if (!provider) return nothing;

  return html`
    <div
      class="fm-modal-overlay"
      @click=${(e: Event) => {
        if (e.target === e.currentTarget) props.onCloseDeleteModal();
      }}
    >
      <div class="fm-modal">
        <div class="fm-modal__header">
          <div class="fm-modal__title">
            <span>⚠️</span>
            <span>${t("freeModels.modal.deleteTitle")}</span>
          </div>
          <button class="fm-modal__close" @click=${props.onCloseDeleteModal}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="fm-modal__body">
          <div class="fm-confirm">
            <div class="fm-confirm__icon">🗑️</div>
            <div class="fm-confirm__title">
              ${t("freeModels.modal.deleteConfirm", { name: provider.name })}
            </div>
            <div class="fm-confirm__desc">
              ${t("freeModels.modal.deleteDesc")}
            </div>
          </div>
        </div>

        <div class="fm-modal__footer">
          <button class="btn" @click=${props.onCloseDeleteModal}>
            ${t("common.cancel")}
          </button>
          <button
            class="btn danger"
            @click=${props.onConfirmDelete}
            ?disabled=${props.deleteModalDeleting}
          >
            ${props.deleteModalDeleting ? "删除中..." : t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ===========================================
   工具函数
   =========================================== */

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + "K";
  }
  return num.toString();
}
