import { html, nothing } from "lit";

import type { GatewayHelloOk } from "../gateway";
import { formatAgo, formatDurationMs } from "../format";
import { formatNextRun } from "../presenter";
import type { UiSettings } from "../storage";
import { t } from "../i18n/index.js";
import type { CostUsageSummary } from "../types";
import { formatTokenCount, formatCost, getTodayUsage, getUsageTrend } from "../controllers/usage";
import type { ProviderInfo, CurrentModelInfo, ApiKeyVerifyResult } from "../controllers/models";
import type { SecurityModeInfo, SecurityMode } from "../controllers/security";

export type OverviewProps = {
  connected: boolean;
  hello: GatewayHelloOk | null;
  settings: UiSettings;
  password: string;
  lastError: string | null;
  presenceCount: number;
  sessionsCount: number | null;
  cronEnabled: boolean | null;
  cronNext: number | null;
  lastChannelsRefresh: number | null;
  // Token 使用量相关
  usageLoading: boolean;
  usageSummary: CostUsageSummary | null;
  usageError: string | null;
  // 模型选择相关
  modelsLoading: boolean;
  modelsProviders: ProviderInfo[];
  modelsDefaults: Record<string, string>;
  modelsCurrent: CurrentModelInfo | null;
  modelsSaving: boolean;
  modelsError: string | null;
  modelsSuccessMessage?: string | null;
  // 安全模式相关
  securityLoading: boolean;
  securityModes: SecurityModeInfo[];
  securityCurrent: SecurityMode | null;
  securitySaving: boolean;
  securityError: string | null;
  securityShowWarning: boolean;
  securitySuccessMessage?: string | null;
  onSettingsChange: (next: UiSettings) => void;
  onPasswordChange: (next: string) => void;
  onSessionKeyChange: (next: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
  onNavigateToUsage?: () => void;
  onModelChange?: (provider: string, model: string) => void;
  // 待保存的模型选择
  modelsPendingProvider?: string | null;
  modelsPendingModel?: string | null;
  onModelPendingChange?: (provider: string, model: string) => void;
  onModelPendingCancel?: () => void;
  onModelPendingConfirm?: () => void;
  onNavigateToConfig?: () => void;
  // 安全模式回调
  onSecurityModeChange?: (mode: SecurityMode) => void;
  onCloseSecurityWarning?: () => void;
  onConfirmSecurityTrust?: () => void;
  // 模型认证相关
  modelsAuthSaving?: boolean;
  modelsConfiguringProvider?: string | null;
  modelsAuthVerifying?: boolean;
  modelsAuthVerifyResult?: ApiKeyVerifyResult | null;
  onSetConfiguringProvider?: (providerId: string | null) => void;
  onSaveProviderAuth?: (provider: string, auth: { apiKey?: string; secretId?: string; secretKey?: string }) => void;
  onVerifyApiKey?: (provider: string, apiKey: string, model?: string) => Promise<ApiKeyVerifyResult>;
  onClearVerifyResult?: () => void;
};

/**
 * 获取模型显示名称
 */
function getModelDisplayName(
  providers: ProviderInfo[],
  providerId: string,
  modelId: string,
): string {
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) return modelId;
  const model = provider.models.find((m) => m.id === modelId);
  // 移除 emoji 前缀用于显示
  const name = model?.name ?? modelId;
  return name.replace(/^[🆓💰🧠🎨]\s*/, "");
}

/**
 * 获取提供商显示名称
 */
function getProviderDisplayName(providers: ProviderInfo[], providerId: string): string {
  const provider = providers.find((p) => p.id === providerId);
  return provider?.name ?? providerId;
}

/**
 * 渲染安全模式卡片
 */
function renderSecurityCard(props: OverviewProps) {
  const { securityLoading, securityModes, securityCurrent, securitySaving } = props;

  // 加载状态
  if (securityLoading) {
    return html`
      <section class="card security-card" style="margin-top: 18px;">
        <div class="card-title">${t("security.title")}</div>
        <div class="card-sub">${t("common.loading")}</div>
      </section>
    `;
  }

  // 无模式数据
  if (!securityModes || securityModes.length === 0) {
    return nothing;
  }

  // 当前模式信息
  const currentMode = securityModes.find((m) => m.id === securityCurrent);
  const currentModeName = currentMode?.name ?? t("security.mode.standard");
  const currentModeIcon = currentMode?.icon ?? "🏠";
  const currentModeDesc = currentMode?.description ?? "";

  return html`
    <section class="card security-card" style="margin-top: 18px;">
      <div class="security-card__header">
        <div>
          <div class="card-title">${t("security.title")}</div>
          <div class="card-sub">${t("security.subtitle")}</div>
        </div>
        ${props.onNavigateToConfig
          ? html`<button class="btn btn--sm btn--outline" @click=${props.onNavigateToConfig}>${t("security.advancedConfig")}</button>`
          : nothing}
      </div>

      <div class="security-card__current">
        <div class="security-card__current-icon">${currentModeIcon}</div>
        <div class="security-card__current-info">
          <div class="security-card__current-mode">${currentModeName}</div>
          <div class="security-card__current-desc">${currentModeDesc}</div>
        </div>
      </div>

      <div class="security-card__modes">
        ${securityModes.map((mode) => {
          const isSelected = mode.id === securityCurrent;
          const isDangerous = mode.dangerous ?? false;
          const isRecommended = mode.recommended ?? false;

          return html`
            <div
              class="security-mode-option ${isSelected ? "selected" : ""} ${isDangerous ? "dangerous" : ""}"
              @click=${() => {
                if (securitySaving || isSelected) return;
                props.onSecurityModeChange?.(mode.id);
              }}
            >
              <div class="security-mode-option__icon">${mode.icon}</div>
              <div class="security-mode-option__content">
                <div class="security-mode-option__title">
                  ${mode.name}
                  ${isRecommended
                    ? html`<span class="security-mode-option__badge recommended">${t("security.recommended")}</span>`
                    : nothing}
                  ${isDangerous
                    ? html`<span class="security-mode-option__badge dangerous">${t("security.dangerous")}</span>`
                    : nothing}
                </div>
                <div class="security-mode-option__desc">${mode.description}</div>
              </div>
              <div class="security-mode-option__check">✓</div>
            </div>
          `;
        })}
      </div>

      ${securitySaving
        ? html`<div class="security-card__status saving">${t("security.saving")}</div>`
        : nothing}
      ${props.securitySuccessMessage
        ? html`<div class="security-card__status success">${props.securitySuccessMessage}</div>`
        : nothing}
      ${props.securityError
        ? html`<div class="security-card__status error">${props.securityError}</div>`
        : nothing}
    </section>
  `;
}

/**
 * 渲染安全警告弹框 - 红色标识危险
 */
function renderSecurityWarningModal(props: OverviewProps) {
  if (!props.securityShowWarning) return nothing;

  return html`
    <div class="modal-overlay" @click=${(e: Event) => {
      if (e.target === e.currentTarget) props.onCloseSecurityWarning?.();
    }}>
      <div class="security-warning-modal">
        <div class="security-warning-modal__header">
          <h3 class="security-warning-modal__title">
            <span style="color: #ef4444;">⚠️</span>
            ${t("security.warning.title")}
          </h3>
        </div>
        <div class="security-warning-modal__body">
          <p class="security-warning-modal__subtitle">${t("security.warning.subtitle")}</p>
          <ul class="security-warning-modal__risks">
            <li class="security-warning-modal__risk">
              <span class="security-warning-modal__risk-icon">❌</span>
              <span>${t("security.warning.risk1")}</span>
            </li>
            <li class="security-warning-modal__risk">
              <span class="security-warning-modal__risk-icon">❌</span>
              <span>${t("security.warning.risk2")}</span>
            </li>
            <li class="security-warning-modal__risk">
              <span class="security-warning-modal__risk-icon">❌</span>
              <span>${t("security.warning.risk3")}</span>
            </li>
            <li class="security-warning-modal__risk">
              <span class="security-warning-modal__risk-icon">❌</span>
              <span>${t("security.warning.risk4")}</span>
            </li>
          </ul>
          <div class="security-warning-modal__tip">
            <span class="security-warning-modal__tip-icon">💡</span>
            <span>${t("security.warning.tip")}</span>
          </div>
        </div>
        <div class="security-warning-modal__footer">
          <button
            class="security-warning-modal__btn security-warning-modal__btn--cancel"
            @click=${() => props.onCloseSecurityWarning?.()}
          >
            ${t("security.warning.cancel")}
          </button>
          <button
            class="security-warning-modal__btn security-warning-modal__btn--danger"
            @click=${() => props.onConfirmSecurityTrust?.()}
          >
            ${t("security.warning.confirm")}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染验证结果
 */
function renderVerifyResult(result: ApiKeyVerifyResult | null | undefined) {
  if (!result) return nothing;

  if (result.valid) {
    return html`
      <div class="model-auth-form__verify-result success">
        <span class="model-auth-form__verify-icon">✓</span>
        <span>${result.message ?? t("models.verifySuccess")}</span>
      </div>
    `;
  }

  return html`
    <div class="model-auth-form__verify-result error">
      <span class="model-auth-form__verify-icon">✗</span>
      <span>${result.error ?? t("models.verifyFailed")}</span>
    </div>
  `;
}

/**
 * 渲染认证配置表单
 */
function renderAuthForm(
  provider: ProviderInfo,
  props: OverviewProps,
) {
  const auth = provider.auth;
  const authField = auth?.authField ?? "apiKey";
  const isSaving = props.modelsAuthSaving ?? false;
  const isVerifying = props.modelsAuthVerifying ?? false;
  const verifyResult = props.modelsAuthVerifyResult;
  const isDisabled = isSaving || isVerifying;

  // 根据认证类型渲染不同的表单
  if (authField === "secretId") {
    // 腾讯云等需要 SecretId + SecretKey（不支持在线验证）
    return html`
      <div class="model-auth-form">
        <div class="model-auth-form__fields">
          <label class="field">
            <span>Secret ID</span>
            <input
              type="text"
              id="auth-secret-id"
              placeholder="输入 Secret ID"
              ?disabled=${isDisabled}
              @input=${() => props.onClearVerifyResult?.()}
            />
          </label>
          <label class="field">
            <span>Secret Key</span>
            <input
              type="password"
              id="auth-secret-key"
              placeholder="输入 Secret Key"
              ?disabled=${isDisabled}
              @input=${() => props.onClearVerifyResult?.()}
            />
          </label>
        </div>
        ${auth?.authHint ? html`<div class="model-auth-form__hint">${auth.authHint}</div>` : nothing}
        <div class="model-auth-form__actions">
          <button
            class="btn btn--sm"
            ?disabled=${isDisabled}
            @click=${() => {
              const secretIdInput = document.getElementById("auth-secret-id") as HTMLInputElement;
              const secretKeyInput = document.getElementById("auth-secret-key") as HTMLInputElement;
              if (secretIdInput?.value && secretKeyInput?.value && props.onSaveProviderAuth) {
                props.onSaveProviderAuth(provider.id, {
                  secretId: secretIdInput.value,
                  secretKey: secretKeyInput.value,
                });
              }
            }}
          >
            ${isSaving ? t("common.saving") : t("common.save")}
          </button>
          <button
            class="btn btn--sm btn--outline"
            ?disabled=${isDisabled}
            @click=${() => {
              props.onClearVerifyResult?.();
              props.onSetConfiguringProvider?.(null);
            }}
          >
            ${t("common.cancel")}
          </button>
          ${auth?.docsUrl ? html`
            <a
              class="btn btn--sm btn--link"
              href="${auth.docsUrl}"
              target="_blank"
              rel="noreferrer"
            >
              ${t("models.getApiKey")}
            </a>
          ` : nothing}
        </div>
      </div>
    `;
  }

  // 标准 API Key 表单（支持在线验证）
  // 只有验证成功后才能保存
  const canSave = verifyResult?.valid === true;
  
  // 检查是否已配置（用于显示提示）
  const isAlreadyConfigured = provider.authConfigured;
  const placeholder = isAlreadyConfigured
    ? "已配置 - 如需更新请输入新的 API Key"
    : (auth?.authHint ?? "输入 API Key");
  
  return html`
    <div class="model-auth-form">
      ${isAlreadyConfigured ? html`
        <div class="model-auth-form__configured-hint">
          <span class="material-icons" style="color: var(--clr-success); font-size: 16px; vertical-align: middle;">check_circle</span>
          <span>该提供商已配置 API Key，如需更新请在下方输入新密钥</span>
        </div>
      ` : nothing}
      <div class="model-auth-form__fields">
        <label class="field">
          <span>API Key</span>
          <input
            type="password"
            id="auth-api-key"
            placeholder="${placeholder}"
            ?disabled=${isDisabled}
            @input=${() => props.onClearVerifyResult?.()}
          />
        </label>
      </div>
      ${auth?.authNote ? html`<div class="model-auth-form__note">${auth.authNote}</div>` : nothing}
      ${renderVerifyResult(verifyResult)}
      <div class="model-auth-form__actions">
        <button
          class="btn btn--sm btn--outline"
          ?disabled=${isDisabled}
          @click=${async () => {
            const apiKeyInput = document.getElementById("auth-api-key") as HTMLInputElement;
            if (apiKeyInput?.value && props.onVerifyApiKey) {
              await props.onVerifyApiKey(provider.id, apiKeyInput.value);
            }
          }}
        >
          ${isVerifying ? t("models.verifying") : t("models.verify")}
        </button>
        <button
          class="btn btn--sm"
          ?disabled=${isDisabled || !canSave}
          title=${canSave ? "" : t("models.verifyFirst")}
          @click=${() => {
            const apiKeyInput = document.getElementById("auth-api-key") as HTMLInputElement;
            if (apiKeyInput?.value && props.onSaveProviderAuth) {
              props.onSaveProviderAuth(provider.id, { apiKey: apiKeyInput.value });
            }
          }}
        >
          ${isSaving ? t("common.saving") : t("common.save")}
        </button>
        <button
          class="btn btn--sm btn--outline"
          ?disabled=${isDisabled}
          @click=${() => {
            props.onClearVerifyResult?.();
            props.onSetConfiguringProvider?.(null);
          }}
        >
          ${t("common.cancel")}
        </button>
        ${auth?.docsUrl ? html`
          <a
            class="btn btn--sm btn--link"
            href="${auth.docsUrl}"
            target="_blank"
            rel="noreferrer"
          >
            ${t("models.getApiKey")}
          </a>
        ` : nothing}
      </div>
    </div>
  `;
}

/**
 * 渲染模型选择卡片 - 完整版本带 API Key 配置
 */
function renderModelCard(props: OverviewProps) {
  const { modelsLoading, modelsProviders, modelsCurrent, modelsSaving } = props;
  const configuringProvider = props.modelsConfiguringProvider;

  // 加载状态
  if (modelsLoading) {
    return html`
      <section class="card model-card" style="margin-top: 18px;">
        <div class="card-title">${t("models.title")}</div>
        <div class="card-sub">${t("common.loading")}</div>
      </section>
    `;
  }

  // 无提供商数据
  if (!modelsProviders || modelsProviders.length === 0) {
    return nothing;
  }

  // 当前已保存的模型信息
  const savedProvider = modelsCurrent?.provider ?? "";
  const savedModel = modelsCurrent?.model ?? "";

  // 待保存的模型选择（用户选中但未保存）
  const pendingProvider = props.modelsPendingProvider;
  const pendingModel = props.modelsPendingModel;
  const hasPendingChange = pendingProvider !== null && pendingModel !== null;

  // 下拉框显示的值：
  // 1. 如果正在配置某个提供商的 API Key，使用该提供商
  // 2. 如果有待保存的选择，使用待保存的提供商
  // 3. 否则使用已保存的值
  const displayProvider = configuringProvider ?? pendingProvider ?? savedProvider;
  const displayModel = hasPendingChange ? pendingModel : savedModel;

  // 根据显示的提供商获取数据
  const displayProviderData = modelsProviders.find((p) => p.id === displayProvider);
  const savedProviderData = modelsProviders.find((p) => p.id === savedProvider);

  // 当前模型状态显示（始终显示已保存的值）
  const currentProviderName = savedProvider
    ? getProviderDisplayName(modelsProviders, savedProvider)
    : t("models.notConfigured");
  const currentModelName = savedProvider && savedModel
    ? getModelDisplayName(modelsProviders, savedProvider, savedModel)
    : t("models.notConfigured");

  // 当前提供商是否已配置认证
  const isDisplayAuthConfigured = displayProviderData?.authConfigured ?? false;
  const isSavedAuthConfigured = savedProviderData?.authConfigured ?? false;

  // 构建提供商选项（显示配置状态）
  const providerOptions = modelsProviders.map((p) => {
    const statusIcon = p.authConfigured ? "✓ " : "";
    return html`
      <option value="${p.id}" ?selected=${p.id === displayProvider}>${statusIcon}${p.name}</option>
    `;
  });

  // 获取当前显示提供商的模型列表
  const modelOptions = displayProviderData?.models.map((m) => {
    const displayName = m.name.replace(/^[🆓💰🧠🎨⭐]\s*/, "");
    const suffix = m.recommended ? " ⭐" : "";
    return html`
      <option value="${m.id}" ?selected=${m.id === displayModel}>${displayName}${suffix}</option>
    `;
  }) ?? [];

  // 正在配置的提供商
  const configuringProviderData = configuringProvider
    ? modelsProviders.find((p) => p.id === configuringProvider)
    : null;

  return html`
    <section class="card model-card" style="margin-top: 18px;">
      <div class="model-card__header">
        <div>
          <div class="card-title">${t("models.title")}</div>
          <div class="card-sub">${t("models.subtitle")}</div>
        </div>
        ${props.onNavigateToConfig
          ? html`<button class="btn btn--sm btn--outline" @click=${props.onNavigateToConfig}>${t("models.advancedConfig")}</button>`
          : nothing}
      </div>

      <!-- 当前模型状态显示（已保存的值） -->
      <div class="model-card__current" style="margin-top: 16px;">
        <div class="model-card__current-icon">🤖</div>
        <div class="model-card__current-info">
          <div class="model-card__current-model">${currentModelName}</div>
          <div class="model-card__current-provider">
            ${currentProviderName}
            ${savedProvider && !isSavedAuthConfigured
              ? html`<span class="model-card__auth-status warning">${t("models.authNotConfigured")}</span>`
              : savedProvider
                ? html`<span class="model-card__auth-status ok">${t("models.authConfigured")}</span>`
                : nothing}
          </div>
        </div>
      </div>

      <!-- 提供商选择 -->
      <div class="model-card__selectors" style="margin-top: 16px;">
        <div class="model-card__selector">
          <label class="field">
            <span>${t("models.provider")}</span>
            <select
              class="model-select"
              ?disabled=${modelsSaving}
              @change=${(e: Event) => {
                const select = e.target as HTMLSelectElement;
                const newProvider = select.value;
                if (!newProvider) return;
                
                // 检查是否需要配置认证
                const providerData = modelsProviders.find((p) => p.id === newProvider);
                if (providerData && !providerData.authConfigured) {
                  // 显示认证配置表单
                  props.onSetConfiguringProvider?.(newProvider);
                  return;
                }
                
                // 已配置的 provider：清除正在配置状态（如果之前在配置其他 provider）
                if (configuringProvider && configuringProvider !== newProvider) {
                  props.onSetConfiguringProvider?.(null);
                  props.onClearVerifyResult?.();
                }
                
                // 选择该提供商的默认模型，更新待保存状态
                const defaultModel = props.modelsDefaults[newProvider];
                const recommendedModel = providerData?.models.find((m) => m.recommended);
                const firstModel = providerData?.models[0];
                const modelToUse = defaultModel ?? recommendedModel?.id ?? firstModel?.id;
                if (modelToUse && props.onModelPendingChange) {
                  props.onModelPendingChange(newProvider, modelToUse);
                }
              }}
            >
              <option value="">${t("models.selectProvider")}</option>
              ${providerOptions}
            </select>
          </label>
        </div>

        <div class="model-card__selector">
          <label class="field">
            <span>${t("models.model")}</span>
            <select
              class="model-select"
              ?disabled=${modelsSaving || !displayProvider}
              @change=${(e: Event) => {
                const select = e.target as HTMLSelectElement;
                const newModel = select.value;
                if (!newModel) return;
                if (displayProvider && props.onModelPendingChange) {
                  props.onModelPendingChange(displayProvider, newModel);
                }
              }}
            >
              ${modelOptions.length > 0
                ? modelOptions
                : html`<option value="">${t("models.selectProviderFirst")}</option>`}
            </select>
          </label>
        </div>
      </div>

      <!-- 保存按钮（有待保存更改时显示） -->
      ${hasPendingChange
        ? html`
          <div class="model-card__actions" style="margin-top: 16px; display: flex; gap: 12px; align-items: center;">
            <button
              class="btn btn--sm"
              ?disabled=${modelsSaving}
              @click=${() => props.onModelPendingConfirm?.()}
            >
              ${modelsSaving ? t("models.saving") : t("models.confirmChange")}
            </button>
            <span class="model-card__pending-hint" style="color: var(--clr-warning); font-size: 13px;">
              ${t("models.pendingChange")}
            </span>
          </div>
        `
        : nothing}

      <!-- 认证配置区域 -->
      ${displayProvider && !isDisplayAuthConfigured && !configuringProvider
        ? html`
          <div class="model-card__auth-prompt" style="margin-top: 16px;">
            <div class="model-card__auth-prompt-text">
              ${t("models.authRequired", { provider: getProviderDisplayName(modelsProviders, displayProvider) })}
            </div>
            <button
              class="btn btn--sm"
              @click=${() => props.onSetConfiguringProvider?.(displayProvider)}
            >
              ${t("models.configureApiKey")}
            </button>
            ${displayProviderData?.auth?.docsUrl ? html`
              <a
                class="btn btn--sm btn--link"
                href="${displayProviderData.auth.docsUrl}"
                target="_blank"
                rel="noreferrer"
              >
                ${t("models.getApiKey")}
              </a>
            ` : nothing}
          </div>
        `
        : nothing}

      <!-- 认证配置表单（展开时显示） -->
      ${configuringProviderData
        ? html`
          <div class="model-card__auth-config" style="margin-top: 16px;">
            <div class="model-card__auth-config-header">
              <span>${t("models.configuring", { provider: configuringProviderData.name })}</span>
            </div>
            ${renderAuthForm(configuringProviderData, props)}
          </div>
        `
        : nothing}

      ${modelsSaving
        ? html`<div class="model-card__status saving">⏳ ${t("models.saving")}</div>`
        : nothing}
      ${props.modelsSuccessMessage
        ? html`<div class="model-card__status success">✓ ${props.modelsSuccessMessage}</div>`
        : nothing}
      ${props.modelsError
        ? html`<div class="model-card__status error">✗ ${props.modelsError}</div>`
        : nothing}
    </section>
  `;
}

/**
 * 渲染 Token 使用量卡片
 */
function renderUsageCard(props: OverviewProps) {
  const todayUsage = getTodayUsage(props.usageSummary);
  const trend = getUsageTrend(props.usageSummary);
  const totals = props.usageSummary?.totals;

  // 趋势图标
  const trendIcon = trend
    ? trend.direction === "up"
      ? html`<span class="trend-icon trend-up" title="${t("usage.trendUp")}">↑${trend.percentage}%</span>`
      : trend.direction === "down"
        ? html`<span class="trend-icon trend-down" title="${t("usage.trendDown")}">↓${trend.percentage}%</span>`
        : html`<span class="trend-icon trend-stable" title="${t("usage.trendStable")}">→</span>`
    : null;

  // 加载状态
  if (props.usageLoading) {
    return html`
      <section class="card usage-card" style="margin-top: 18px;">
        <div class="card-title">${t("usage.title")}</div>
        <div class="card-sub">${t("common.loading")}</div>
      </section>
    `;
  }

  // 错误状态
  if (props.usageError) {
    return html`
      <section class="card usage-card" style="margin-top: 18px;">
        <div class="card-title">${t("usage.title")}</div>
        <div class="callout danger">${props.usageError}</div>
      </section>
    `;
  }

  // 无数据状态
  if (!props.usageSummary || !totals) {
    return html`
      <section class="card usage-card" style="margin-top: 18px;">
        <div class="card-title">${t("usage.title")}</div>
        <div class="card-sub">${t("usage.noData")}</div>
      </section>
    `;
  }

  return html`
    <section class="card usage-card" style="margin-top: 18px;">
      <div class="usage-card__header">
        <div>
          <div class="card-title">${t("usage.title")}</div>
          <div class="card-sub">${t("usage.subtitle")}</div>
        </div>
        ${props.onNavigateToUsage
          ? html`<button class="btn btn--sm" @click=${props.onNavigateToUsage}>${t("usage.viewDetails")}</button>`
          : null}
      </div>
      <div class="stat-grid usage-stats" style="margin-top: 16px;">
        <div class="stat">
          <div class="stat-label">${t("usage.todayTokens")}</div>
          <div class="stat-value">
            ${todayUsage ? formatTokenCount(todayUsage.totalTokens) : "0"}
            ${trendIcon}
          </div>
          <div class="muted">${t("usage.tokens")}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${t("usage.todayCost")}</div>
          <div class="stat-value">${todayUsage ? formatCost(todayUsage.totalCost) : "¥0.00"}</div>
          <div class="muted">${t("usage.estimatedCost")}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${t("usage.totalTokens")}</div>
          <div class="stat-value">${formatTokenCount(totals.totalTokens)}</div>
          <div class="muted">${t("usage.last30Days")}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${t("usage.totalCost")}</div>
          <div class="stat-value">${formatCost(totals.totalCost)}</div>
          <div class="muted">${t("usage.last30Days")}</div>
        </div>
      </div>
      ${renderMiniChart(props.usageSummary)}
    </section>
  `;
}

/**
 * 渲染迷你使用量图表（最近 7 天柱状图）
 */
function renderMiniChart(summary: CostUsageSummary | null) {
  if (!summary || !summary.daily || summary.daily.length === 0) {
    return null;
  }

  // 取最近 7 天数据
  const sorted = [...summary.daily].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-7);

  if (recent.length === 0) return null;

  // 找到最大值用于归一化
  const maxTokens = Math.max(...recent.map((d) => d.totalTokens), 1);

  return html`
    <div class="usage-mini-chart" style="margin-top: 16px;">
      <div class="usage-mini-chart__title">${t("usage.recentUsage")}</div>
      <div class="usage-mini-chart__bars">
        ${recent.map((day) => {
          const height = Math.max((day.totalTokens / maxTokens) * 100, 2);
          const dayLabel = day.date.slice(-5); // MM-DD
          return html`
            <div class="usage-mini-chart__bar-container" title="${day.date}: ${formatTokenCount(day.totalTokens)}">
              <div class="usage-mini-chart__bar" style="height: ${height}%"></div>
              <div class="usage-mini-chart__label">${dayLabel}</div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

export function renderOverview(props: OverviewProps) {
  const snapshot = props.hello?.snapshot as
    | { uptimeMs?: number; policy?: { tickIntervalMs?: number } }
    | undefined;
  const uptime = snapshot?.uptimeMs ? formatDurationMs(snapshot.uptimeMs) : "n/a";
  const tick = snapshot?.policy?.tickIntervalMs
    ? `${snapshot.policy.tickIntervalMs}ms`
    : "n/a";
  // 友好的错误消息映射
  const getFriendlyError = (error: string): string => {
    const lower = error.toLowerCase();
    if (lower.includes("unauthorized") || lower.includes("1008")) {
      return t("connection.error.unauthorized");
    }
    if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("econnrefused")) {
      return t("connection.error.network");
    }
    if (lower.includes("timeout")) {
      return t("connection.error.timeout");
    }
    return t("connection.error.unknown");
  };

  const authHint = (() => {
    if (props.connected || !props.lastError) return null;
    const lower = props.lastError.toLowerCase();
    const authFailed = lower.includes("unauthorized") || lower.includes("connect failed") || lower.includes("1008");
    if (!authFailed) return null;
    const hasToken = Boolean(props.settings.token.trim());
    const hasPassword = Boolean(props.password.trim());
    
    const copyCommand = (cmd: string) => {
      navigator.clipboard.writeText(cmd).then(() => {
        // 可以添加一个 toast 提示
      });
    };
    
    if (!hasToken && !hasPassword) {
      return html`
        <div class="connection-hint">
          <div class="connection-hint__title">💡 ${t("connection.hint.getToken")}</div>
          <div class="connection-hint__commands">
            <div class="connection-hint__cmd">
              <code>clawdbot dashboard --no-open</code>
              <button 
                class="btn btn--sm" 
                type="button"
                @click=${() => copyCommand("clawdbot dashboard --no-open")}
                title="${t("connection.hint.copyCommand")}"
              >
                ${t("common.copy")}
              </button>
            </div>
            <div class="connection-hint__cmd">
              <code>clawdbot doctor --generate-gateway-token</code>
              <button 
                class="btn btn--sm" 
                type="button"
                @click=${() => copyCommand("clawdbot doctor --generate-gateway-token")}
                title="${t("connection.hint.copyCommand")}"
              >
                ${t("common.copy")}
              </button>
            </div>
          </div>
          <div class="connection-hint__links">
            <a
              href="https://gitee.com/tecbinai/cnDoc/blob/master/web/dashboard.md"
              target="_blank"
              rel="noreferrer"
            >📖 ${t("common.docs")}</a>
            <span class="connection-hint__divider">·</span>
            <a
              href="https://www.tecbinai.com"
              target="_blank"
              rel="noreferrer"
            >🚀 tecbinai</a>
          </div>
        </div>
      `;
    }
    return html`
      <div class="connection-hint">
        <div class="connection-hint__title">⚠️ ${t("overview.authFailed")}</div>
        <div class="connection-hint__desc">请检查令牌或密码是否正确，或重新获取令牌</div>
        <div class="connection-hint__links">
          <a
            href="https://gitee.com/tecbinai/cnDoc/blob/master/web/dashboard.md"
            target="_blank"
            rel="noreferrer"
          >📖 ${t("common.docs")}</a>
          <span class="connection-hint__divider">·</span>
          <a
            href="https://www.tecbinai.com"
            target="_blank"
            rel="noreferrer"
          >🚀 tecbinai</a>
        </div>
      </div>
    `;
  })();
  const insecureContextHint = (() => {
    if (props.connected || !props.lastError) return null;
    const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : true;
    if (isSecureContext !== false) return null;
    const lower = props.lastError.toLowerCase();
    if (!lower.includes("secure context") && !lower.includes("device identity required")) {
      return null;
    }
    return html`
      <div class="muted" style="margin-top: 8px;">
        ${t("overview.insecureContext")}
        <div style="margin-top: 6px;">
          <a
            class="session-link"
            href="https://gitee.com/tecbinai/cnDoc/blob/master/gateway/tailscale.md"
            target="_blank"
            rel="noreferrer"
            >${t("common.docs")}</a
          >
        </div>
      </div>
    `;
  })();

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">${t("overview.gatewayAccess")}</div>
        <div class="card-sub">${t("overview.gatewayUrl")}</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>WebSocket URL</span>
            <input
              .value=${props.settings.gatewayUrl}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSettingsChange({ ...props.settings, gatewayUrl: v });
              }}
              placeholder="ws://100.x.y.z:18789"
            />
          </label>
          <label class="field">
            <span>${t("overview.token")}</span>
            <input
              .value=${props.settings.token}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSettingsChange({ ...props.settings, token: v });
              }}
              placeholder="CLAWDBOT_GATEWAY_TOKEN"
            />
          </label>
          <label class="field">
            <span>${t("overview.password")}</span>
            <input
              type="password"
              .value=${props.password}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onPasswordChange(v);
              }}
              placeholder=""
            />
          </label>
          <label class="field">
            <span>${t("overview.sessionKey")}</span>
            <input
              .value=${props.settings.sessionKey}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSessionKeyChange(v);
              }}
            />
          </label>
        </div>
        <div class="row" style="margin-top: 14px;">
          <button class="btn" @click=${() => props.onConnect()}>${t("common.connect")}</button>
          <button class="btn" @click=${() => props.onRefresh()}>${t("common.refresh")}</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${t("overview.snapshot")}</div>
        <div class="card-sub"></div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">${t("common.status")}</div>
            <div class="stat-value ${props.connected ? "ok" : "warn"}">
              ${props.connected ? t("common.connected") : t("common.disconnected")}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.uptime")}</div>
            <div class="stat-value">${uptime}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.tickInterval")}</div>
            <div class="stat-value">${tick}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("nav.channels")}</div>
            <div class="stat-value">
              ${props.lastChannelsRefresh
                ? formatAgo(props.lastChannelsRefresh)
                : t("common.na")}
            </div>
          </div>
        </div>
        ${props.lastError
          ? html`<div class="callout danger" style="margin-top: 14px;">
              <div>${props.lastError}</div>
              ${authHint ?? ""}
              ${insecureContextHint ?? ""}
            </div>`
          : html`<div class="callout" style="margin-top: 14px;">
              ${t("channels.title")}
            </div>`}
      </div>
    </section>

    <section class="grid grid-cols-3" style="margin-top: 18px;">
      <div class="card stat-card">
        <div class="stat-label">${t("overview.instances")}</div>
        <div class="stat-value">${props.presenceCount}</div>
        <div class="muted">${t("overview.presenceBeacons")}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${t("overview.sessions")}</div>
        <div class="stat-value">${props.sessionsCount ?? t("common.na")}</div>
        <div class="muted">${t("overview.activeSessions")}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${t("nav.cron")}</div>
        <div class="stat-value">
          ${props.cronEnabled == null
            ? t("common.na")
            : props.cronEnabled
              ? t("overview.cronEnabled")
              : t("overview.cronDisabled")}
        </div>
        <div class="muted">${t("overview.nextRun")} ${formatNextRun(props.cronNext)}</div>
      </div>
    </section>

    ${renderSecurityCard(props)}

    ${renderModelCard(props)}

    ${renderUsageCard(props)}

    ${renderSecurityWarningModal(props)}

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">${t("overview.notes")}</div>
      <div class="card-sub">${t("overview.quickActions")}</div>
      <div class="note-grid" style="margin-top: 14px;">
        <div>
          <div class="note-title">Tailscale serve</div>
          <div class="muted">
            Prefer serve mode to keep the gateway on loopback with tailnet auth.
          </div>
        </div>
        <div>
          <div class="note-title">Session hygiene</div>
          <div class="muted">Use /new or sessions.patch to reset context.</div>
        </div>
        <div>
          <div class="note-title">Cron reminders</div>
          <div class="muted">Use isolated sessions for recurring runs.</div>
        </div>
      </div>
    </section>
  `;
}
