import { html, nothing } from "lit";

import { clampText } from "../format";
import { t } from "../i18n/index.js";
import type { RemoteSkillMeta, RemoteSkillsIndex, SkillStatusEntry, SkillStatusReport, SkillsMarketResponse } from "../types";
import type { SkillMessageMap, SkillsTab } from "../controllers/skills";

export type SkillsProps = {
  loading: boolean;
  report: SkillStatusReport | null;
  error: string | null;
  filter: string;
  edits: Record<string, string>;
  busyKey: string | null;
  messages: SkillMessageMap;
  // Tab and remote (legacy)
  activeTab: SkillsTab;
  remoteLoading: boolean;
  remoteIndex: RemoteSkillsIndex | null;
  remoteError: string | null;
  // Market (new)
  marketLoading: boolean;
  marketResponse: SkillsMarketResponse | null;
  marketSyncing: boolean;
  marketLastSyncedAt: string | null;
  marketError: string | null;
  onFilterChange: (next: string) => void;
  onRefresh: () => void;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onEdit: (skillKey: string, value: string) => void;
  onSaveKey: (skillKey: string) => void;
  onInstall: (skillKey: string, name: string, installId: string) => void;
  onTabChange: (tab: SkillsTab) => void;
  onRefreshRemote: () => void;
  onInstallRemote: (skillName: string) => void;
};

// 格式化相对时间
function formatRelativeTime(isoTime: string | null): string {
  if (!isoTime) return "";
  const date = new Date(isoTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  return `${diffDay} 天前`;
}

export function renderSkills(props: SkillsProps) {
  const skills = props.report?.skills ?? [];
  const filter = props.filter.trim().toLowerCase();
  const filtered = filter
    ? skills.filter((skill) =>
        [skill.name, skill.description, skill.source]
          .join(" ")
          .toLowerCase()
          .includes(filter),
      )
    : skills;

  // 优先使用新的市场数据，兼容旧的 remoteIndex
  const marketSkills = props.marketResponse?.skills ?? props.remoteIndex?.skills ?? [];
  const filteredMarket = filter
    ? marketSkills.filter((skill) =>
        [skill.name, skill.description, skill.author ?? "", ...(skill.tags ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(filter),
      )
    : marketSkills;
  
  // 同步状态
  const isSyncing = props.marketSyncing || props.marketLoading;
  const lastSyncedAt = props.marketLastSyncedAt ?? props.remoteIndex?.updated ?? null;

  return html`
    <!-- 帮助说明卡片 -->
    <section class="card help-card">
      <details>
        <summary class="help-card__summary">
          ${t("skills.help.title")}
        </summary>
        <div class="help-card__content">
          <p class="help-card__text">${t("skills.help.description")}</p>
          
          <div class="help-card__section">
            <strong>${t("skills.help.howToInstall")}</strong>
            <p class="help-card__text" style="white-space: pre-line;">${t("skills.help.installSteps")}</p>
          </div>
          
          <div class="help-card__section">
            <strong>${t("skills.help.apiKeyTip")}</strong>
            <p class="help-card__text">${t("skills.help.apiKeyDesc")}</p>
          </div>
          
          <div class="help-card__section">
            <strong>${t("skills.help.statusExplain")}</strong>
            <ul class="help-card__list">
              <li><span class="chip chip-ok" style="margin-right: 8px;">${t("skills.eligible")}</span>${t("skills.help.eligibleDesc")}</li>
              <li><span class="chip chip-warn" style="margin-right: 8px;">${t("skills.blocked")}</span>${t("skills.help.blockedDesc")}</li>
              <li><span class="chip chip-warn" style="margin-right: 8px;">${t("skills.disabled")}</span>${t("skills.help.disabledDesc")}</li>
            </ul>
          </div>
        </div>
      </details>
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">${t("skills.cardTitle")}</div>
          <div class="card-sub">${t("skills.cardSub")}</div>
        </div>
        <button class="btn" ?disabled=${props.loading || props.remoteLoading} @click=${props.activeTab === "local" ? props.onRefresh : props.onRefreshRemote}>
          ${(props.activeTab === "local" ? props.loading : props.remoteLoading) ? t("common.loading") : t("common.refresh")}
        </button>
      </div>

      <!-- Tab switcher -->
      <div class="tabs" style="margin-top: 14px; display: flex; gap: 8px; border-bottom: 1px solid var(--border-color, #e0e0e0); padding-bottom: 8px;">
        <button 
          class="tab-btn ${props.activeTab === "local" ? "active" : ""}"
          style="padding: 8px 16px; border: none; background: ${props.activeTab === "local" ? "var(--primary-color, #0066cc)" : "transparent"}; color: ${props.activeTab === "local" ? "white" : "inherit"}; border-radius: 4px; cursor: pointer;"
          @click=${() => props.onTabChange("local")}
        >
          ${t("skills.tab.local")} (${skills.length})
        </button>
        <button 
          class="tab-btn ${props.activeTab === "remote" ? "active" : ""}"
          style="padding: 8px 16px; border: none; background: ${props.activeTab === "remote" ? "var(--primary-color, #0066cc)" : "transparent"}; color: ${props.activeTab === "remote" ? "white" : "inherit"}; border-radius: 4px; cursor: pointer;"
          @click=${() => props.onTabChange("remote")}
        >
          ${t("skills.tab.remote")} (${marketSkills.length})
          ${isSyncing ? html`<span style="margin-left: 4px; font-size: 12px;">🔄</span>` : nothing}
        </button>
      </div>

      <div class="filters" style="margin-top: 14px;">
        <label class="field" style="flex: 1;">
          <span>${t("skills.filter")}</span>
          <input
            .value=${props.filter}
            @input=${(e: Event) =>
              props.onFilterChange((e.target as HTMLInputElement).value)}
            placeholder="${t("skills.filterPlaceholder")}"
          />
        </label>
        <div class="muted">${props.activeTab === "local" ? filtered.length : filteredMarket.length} ${t("skills.shown")}</div>
      </div>

      ${props.activeTab === "local" ? html`
        ${props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing}

        ${filtered.length === 0
          ? html`<div class="muted" style="margin-top: 16px;">${t("skills.noSkillsFound")}</div>`
          : html`
              <div class="list" style="margin-top: 16px;">
                ${filtered.map((skill) => renderSkill(skill, props))}
              </div>
            `}
      ` : html`
        ${props.marketError || props.remoteError
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.marketError || props.remoteError}</div>`
          : nothing}

        <!-- 同步状态提示 -->
        <div style="margin-top: 8px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          ${lastSyncedAt
            ? html`<span class="muted">${t("skills.remote.updated")}: ${formatRelativeTime(lastSyncedAt)}</span>`
            : nothing}
          ${isSyncing
            ? html`<span style="color: var(--primary-color, #0066cc); font-size: 13px;">
                <span style="display: inline-block; animation: spin 1s linear infinite;">🔄</span>
                ${t("skills.market.syncing") || "同步中..."}
              </span>`
            : nothing}
          ${props.marketResponse?.message && !props.marketError
            ? html`<span class="muted" style="font-style: italic;">${props.marketResponse.message}</span>`
            : nothing}
        </div>

        ${filteredMarket.length === 0
          ? html`<div class="muted" style="margin-top: 16px;">${isSyncing ? t("common.loading") : t("skills.noSkillsFound")}</div>`
          : html`
              <div class="list" style="margin-top: 16px;">
                ${filteredMarket.map((skill) => renderRemoteSkill(skill, props))}
              </div>
            `}
      `}
    </section>
  `;
}

function renderRemoteSkill(skill: RemoteSkillMeta, props: SkillsProps) {
  const busy = props.busyKey === skill.name;
  const message = props.messages[skill.name] ?? null;
  
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">
          ${skill.emoji ? `${skill.emoji} ` : "📦 "}${skill.name}
        </div>
        <div class="list-sub">${clampText(skill.description, 140)}</div>
        <div class="chip-row" style="margin-top: 6px;">
          ${skill.version ? html`<span class="chip">v${skill.version}</span>` : nothing}
          ${skill.author ? html`<span class="chip">${skill.author}</span>` : nothing}
          ${skill.installed
            ? html`<span class="chip chip-ok">${t("skills.remote.installed")}</span>`
            : html`<span class="chip">${t("skills.remote.notInstalled")}</span>`}
        </div>
        ${skill.tags && skill.tags.length > 0
          ? html`
              <div class="chip-row" style="margin-top: 4px;">
                ${skill.tags.slice(0, 5).map((tag) => html`<span class="chip" style="font-size: 11px;">${tag}</span>`)}
              </div>
            `
          : nothing}
      </div>
      <div class="list-meta">
        <div class="row" style="justify-content: flex-end;">
          ${!skill.installed
            ? html`<button
                class="btn primary"
                ?disabled=${busy}
                @click=${() => props.onInstallRemote(skill.name)}
              >
                ${busy ? t("skills.installing") : t("skills.remote.install")}
              </button>`
            : html`<span class="muted">${t("skills.remote.alreadyInstalled")}</span>`}
        </div>
        ${message
          ? html`<div
              class="muted"
              style="margin-top: 8px; color: ${
                message.kind === "error"
                  ? "var(--danger-color, #d14343)"
                  : "var(--success-color, #0a7f5a)"
              };"
            >
              ${message.message}
            </div>`
          : nothing}
      </div>
    </div>
  `;
}

function renderSkill(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const apiKey = props.edits[skill.skillKey] ?? "";
  const message = props.messages[skill.skillKey] ?? null;
  const canInstall =
    skill.install.length > 0 && skill.missing.bins.length > 0;
  const missing = [
    ...skill.missing.bins.map((b) => `bin:${b}`),
    ...skill.missing.env.map((e) => `env:${e}`),
    ...skill.missing.config.map((c) => `config:${c}`),
    ...skill.missing.os.map((o) => `os:${o}`),
  ];
  const reasons: string[] = [];
  if (skill.disabled) reasons.push(t("skills.disabled"));
  if (skill.blockedByAllowlist) reasons.push(t("skills.blockedByAllowlist"));
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">
          ${skill.emoji ? `${skill.emoji} ` : ""}${skill.name}
        </div>
        <div class="list-sub">${clampText(skill.description, 140)}</div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${skill.source}</span>
          <span class="chip ${skill.eligible ? "chip-ok" : "chip-warn"}">
            ${skill.eligible ? t("skills.eligible") : t("skills.blocked")}
          </span>
          ${skill.disabled ? html`<span class="chip chip-warn">${t("skills.disabled")}</span>` : nothing}
        </div>
        ${missing.length > 0
          ? html`
              <div class="muted" style="margin-top: 6px;">
                ${t("skills.missing")}: ${missing.join(", ")}
              </div>
            `
          : nothing}
        ${reasons.length > 0
          ? html`
              <div class="muted" style="margin-top: 6px;">
                ${t("skills.reason")}: ${reasons.join(", ")}
              </div>
            `
          : nothing}
      </div>
      <div class="list-meta">
        <div class="row" style="justify-content: flex-end; flex-wrap: wrap;">
          <button
            class="btn"
            ?disabled=${busy}
            @click=${() => props.onToggle(skill.skillKey, skill.disabled)}
          >
            ${skill.disabled ? t("skills.enable") : t("skills.disable")}
          </button>
          ${canInstall
            ? html`<button
                class="btn"
                ?disabled=${busy}
                @click=${() =>
                  props.onInstall(skill.skillKey, skill.name, skill.install[0].id)}
              >
                ${busy ? t("skills.installing") : skill.install[0].label}
              </button>`
            : nothing}
        </div>
        ${message
          ? html`<div
              class="muted"
              style="margin-top: 8px; color: ${
                message.kind === "error"
                  ? "var(--danger-color, #d14343)"
                  : "var(--success-color, #0a7f5a)"
              };"
            >
              ${message.message}
            </div>`
          : nothing}
        ${skill.primaryEnv
          ? html`
              <div class="field" style="margin-top: 10px;">
                <span>${t("skills.apiKey")}</span>
                <input
                  type="password"
                  .value=${apiKey}
                  @input=${(e: Event) =>
                    props.onEdit(skill.skillKey, (e.target as HTMLInputElement).value)}
                />
              </div>
              <button
                class="btn primary"
                style="margin-top: 8px;"
                ?disabled=${busy}
                @click=${() => props.onSaveKey(skill.skillKey)}
              >
                ${t("skills.saveKey")}
              </button>
            `
          : nothing}
      </div>
    </div>
  `;
}
