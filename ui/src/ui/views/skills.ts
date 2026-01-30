import { html, nothing } from "lit";

import { clampText } from "../format";
import { t } from "../i18n/index.js";
import { icons } from "../icons.js";
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
  
  if (diffMin < 1) return t("skills.time.justNow") || "刚刚";
  if (diffMin < 60) return `${diffMin} ${t("skills.time.minutesAgo") || "分钟前"}`;
  if (diffHour < 24) return `${diffHour} ${t("skills.time.hoursAgo") || "小时前"}`;
  return `${diffDay} ${t("skills.time.daysAgo") || "天前"}`;
}

// Loading Spinner Component
function renderSpinner() {
  return html`<span class="skill-spinner">${icons.loader}</span>`;
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
              <li>
                <span class="skill-status skill-status--eligible" style="margin-right: 8px;">
                  ${icons.shieldCheck}
                  ${t("skills.eligible")}
                </span>
                ${t("skills.help.eligibleDesc")}
              </li>
              <li>
                <span class="skill-status skill-status--blocked" style="margin-right: 8px;">
                  ${icons.alertCircle}
                  ${t("skills.blocked")}
                </span>
                ${t("skills.help.blockedDesc")}
              </li>
              <li>
                <span class="skill-status skill-status--disabled" style="margin-right: 8px;">
                  ${icons.shieldOff}
                  ${t("skills.disabled")}
                </span>
                ${t("skills.help.disabledDesc")}
              </li>
            </ul>
          </div>
        </div>
      </details>
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">${t("skills.cardTitle")}</div>
          <div class="card-sub">${t("skills.cardSub")}</div>
        </div>
        <button 
          class="btn" 
          ?disabled=${props.loading || props.remoteLoading || isSyncing} 
          @click=${props.activeTab === "local" ? props.onRefresh : props.onRefreshRemote}
        >
          ${(props.activeTab === "local" ? props.loading : (props.remoteLoading || isSyncing)) 
            ? html`${renderSpinner()} ${t("common.loading")}` 
            : html`${icons.refreshCw} ${t("common.refresh")}`}
        </button>
      </div>

      <!-- Tab switcher - Modern Style -->
      <div class="skills-tabs" style="margin-top: 16px;">
        <button 
          class="skills-tab ${props.activeTab === "local" ? "skills-tab--active" : ""}"
          @click=${() => props.onTabChange("local")}
        >
          ${icons.hardDrive}
          <span>${t("skills.tab.local")}</span>
          <span class="skills-tab-count">${skills.length}</span>
        </button>
        <button 
          class="skills-tab ${props.activeTab === "remote" ? "skills-tab--active" : ""}"
          @click=${() => props.onTabChange("remote")}
        >
          ${icons.cloudDownload}
          <span>${t("skills.tab.remote")}</span>
          <span class="skills-tab-count">${marketSkills.length}</span>
          ${isSyncing ? renderSpinner() : nothing}
        </button>
      </div>

      <!-- Search Filter -->
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
        <div class="muted" style="align-self: flex-end; padding-bottom: 8px;">
          ${props.activeTab === "local" ? filtered.length : filteredMarket.length} ${t("skills.shown")}
        </div>
      </div>

      ${props.activeTab === "local" ? html`
        ${props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing}

        ${filtered.length === 0
          ? renderEmptyState(props.loading, "local")
          : html`
              <div class="skills-list" style="margin-top: 16px;">
                ${filtered.map((skill) => renderSkill(skill, props))}
              </div>
            `}
      ` : html`
        ${props.marketError || props.remoteError
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.marketError || props.remoteError}</div>`
          : nothing}

        <!-- Sync Status Bar -->
        ${lastSyncedAt || isSyncing
          ? html`
              <div class="skills-sync-bar ${isSyncing ? "skills-sync-bar--syncing" : ""}" style="margin-top: 12px;">
                ${isSyncing
                  ? html`${renderSpinner()} <span>${t("skills.market.syncing") || "正在同步..."}</span>`
                  : html`${icons.clock} <span>${t("skills.remote.updated")}: ${formatRelativeTime(lastSyncedAt)}</span>`}
                ${props.marketResponse?.message && !props.marketError
                  ? html`<span class="muted" style="margin-left: auto;">${props.marketResponse.message}</span>`
                  : nothing}
              </div>
            `
          : nothing}

        ${filteredMarket.length === 0
          ? renderEmptyState(isSyncing, "remote")
          : html`
              <div class="skills-list" style="margin-top: 16px;">
                ${filteredMarket.map((skill) => renderRemoteSkill(skill, props))}
              </div>
            `}
      `}
    </section>
  `;
}

function renderEmptyState(loading: boolean, type: "local" | "remote") {
  return html`
    <div class="skills-empty">
      <div class="skills-empty-icon">
        ${type === "local" ? icons.layers : icons.cloudDownload}
      </div>
      <div class="skills-empty-title">
        ${loading 
          ? t("common.loading")
          : t("skills.noSkillsFound")}
      </div>
      <div class="skills-empty-desc">
        ${loading 
          ? (type === "remote" ? t("skills.market.syncing") || "正在获取技能市场数据..." : "")
          : (type === "remote" 
              ? t("skills.market.emptyHint") || "点击刷新按钮获取技能市场" 
              : t("skills.local.emptyHint") || "暂无已安装的技能")}
      </div>
    </div>
  `;
}

function renderRemoteSkill(skill: RemoteSkillMeta, props: SkillsProps) {
  const busy = props.busyKey === skill.name;
  const message = props.messages[skill.name] ?? null;
  const isInstalled = (skill as RemoteSkillMeta & { installed?: boolean }).installed;
  
  return html`
    <div class="skill-card">
      <!-- Icon -->
      <div class="skill-icon ${isInstalled ? "skill-icon--installed" : ""}">
        ${isInstalled ? icons.checkCircle : icons.package}
      </div>
      
      <!-- Content -->
      <div class="skill-content">
        <div class="skill-header">
          <span class="skill-name">${skill.name}</span>
          ${skill.version ? html`<span class="skill-version">v${skill.version}</span>` : nothing}
        </div>
        
        <div class="skill-desc">${clampText(skill.description, 160)}</div>
        
        <div class="skill-meta">
          ${skill.author 
            ? html`<span class="skill-meta-item">${icons.user} ${skill.author}</span>` 
            : nothing}
        </div>
        
        ${skill.tags && skill.tags.length > 0
          ? html`
              <div class="skill-tags">
                ${skill.tags.slice(0, 5).map((tag) => html`<span class="skill-tag">${tag}</span>`)}
                ${skill.tags.length > 5 ? html`<span class="skill-tag">+${skill.tags.length - 5}</span>` : nothing}
              </div>
            `
          : nothing}
      </div>
      
      <!-- Actions -->
      <div class="skill-actions">
        ${isInstalled
          ? html`
              <span class="skill-status skill-status--installed">
                ${icons.checkCircle}
                ${t("skills.remote.installed")}
              </span>
            `
          : html`
              <button
                class="btn primary"
                ?disabled=${busy}
                @click=${() => props.onInstallRemote(skill.name)}
              >
                ${busy 
                  ? html`${renderSpinner()} ${t("skills.installing")}` 
                  : html`${icons.download} ${t("skills.remote.install")}`}
              </button>
            `}
        
        ${message
          ? html`
              <div style="font-size: 12px; color: ${message.kind === "error" ? "var(--danger)" : "var(--ok)"};">
                ${message.message}
              </div>
            `
          : nothing}
      </div>
    </div>
  `;
}

function renderSkill(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const apiKey = props.edits[skill.skillKey] ?? "";
  const message = props.messages[skill.skillKey] ?? null;
  const canInstall = skill.install.length > 0 && skill.missing.bins.length > 0;
  const missing = [
    ...skill.missing.bins.map((b) => `bin:${b}`),
    ...skill.missing.env.map((e) => `env:${e}`),
    ...skill.missing.config.map((c) => `config:${c}`),
    ...skill.missing.os.map((o) => `os:${o}`),
  ];

  return html`
    <div class="skill-card">
      <!-- Icon -->
      <div class="skill-icon ${skill.eligible ? "skill-icon--installed" : ""}">
        ${skill.eligible ? icons.shieldCheck : icons.package}
      </div>
      
      <!-- Content -->
      <div class="skill-content">
        <div class="skill-header">
          <span class="skill-name">${skill.name}</span>
          <span class="skill-source">${skill.source}</span>
        </div>
        
        <div class="skill-desc">${clampText(skill.description, 160)}</div>
        
        ${missing.length > 0
          ? html`
              <div class="skill-missing">
                ${icons.alertCircle}
                <span>${t("skills.missing")}: ${missing.join(", ")}</span>
              </div>
            `
          : nothing}
      </div>
      
      <!-- Actions -->
      <div class="skill-actions">
        <!-- Status Badge -->
        <span class="skill-status ${
          skill.disabled ? "skill-status--disabled" : 
          skill.eligible ? "skill-status--eligible" : "skill-status--blocked"
        }">
          ${skill.disabled 
            ? html`${icons.shieldOff} ${t("skills.disabled")}` 
            : skill.eligible 
              ? html`${icons.shieldCheck} ${t("skills.eligible")}` 
              : html`${icons.alertCircle} ${t("skills.blocked")}`}
        </span>
        
        <!-- Action Buttons -->
        <div class="row" style="gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
          <button
            class="btn btn--sm"
            ?disabled=${busy}
            @click=${() => props.onToggle(skill.skillKey, skill.disabled)}
          >
            ${skill.disabled ? t("skills.enable") : t("skills.disable")}
          </button>
          ${canInstall
            ? html`
                <button
                  class="btn btn--sm primary"
                  ?disabled=${busy}
                  @click=${() => props.onInstall(skill.skillKey, skill.name, skill.install[0].id)}
                >
                  ${busy ? html`${renderSpinner()}` : nothing}
                  ${busy ? t("skills.installing") : skill.install[0].label}
                </button>
              `
            : nothing}
        </div>
        
        ${message
          ? html`
              <div style="font-size: 12px; text-align: right; color: ${message.kind === "error" ? "var(--danger)" : "var(--ok)"};">
                ${message.message}
              </div>
            `
          : nothing}
        
        <!-- API Key Input -->
        ${skill.primaryEnv
          ? html`
              <div class="skill-apikey">
                <div class="field">
                  <span>${t("skills.apiKey")}</span>
                  <input
                    type="password"
                    .value=${apiKey}
                    @input=${(e: Event) =>
                      props.onEdit(skill.skillKey, (e.target as HTMLInputElement).value)}
                    style="width: 100%;"
                  />
                </div>
                <button
                  class="btn primary btn--sm"
                  style="margin-top: 8px;"
                  ?disabled=${busy}
                  @click=${() => props.onSaveKey(skill.skillKey)}
                >
                  ${t("skills.saveKey")}
                </button>
              </div>
            `
          : nothing}
      </div>
    </div>
  `;
}
