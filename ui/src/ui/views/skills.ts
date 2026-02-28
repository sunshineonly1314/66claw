/**
 * Skills page — dual-tab layout:
 *   1. 技能管理 (local skills, tier-based layout with drag-and-drop)
 *   2. 技能市场 (marketplace search with FTS5 pagination)
 *
 * All user-facing strings use i18n via t().
 */
import { html, nothing } from "lit";
import type {
  BrowseResult,
  InstallProgress,
  SkillMessageMap,
  SkillsMarketSearchResult,
} from "../controllers/skills.ts";
import { clampText } from "../format.ts";
import { t } from "../i18n/index.js";
import type { SkillStatusEntry, SkillStatusReport } from "../types.ts";
import { groupByTier, type SkillGroup, type TierGroupId } from "./skills-grouping.ts";
import {
  computeSkillMissing,
  computeSkillReasons,
  renderIncompatibleBadge,
} from "./skills-shared.ts";

// ============================================================================
// Types
// ============================================================================

export type SkillsProps = {
  // ---- local skills ----
  loading: boolean;
  report: SkillStatusReport | null;
  error: string | null;
  filter: string;
  edits: Record<string, string>;
  busyKey: string | null;
  messages: SkillMessageMap;
  /** Monotonic counter bumped to force re-render (e.g., "Load More" pagination) */
  tierRenderKey: number;
  onTierRenderBump: () => void;
  onFilterChange: (next: string) => void;
  onRefresh: () => void;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onEdit: (skillKey: string, value: string) => void;
  onSaveKey: (skillKey: string) => void;
  onInstall: (skillKey: string, name: string, installId: string) => void;
  // ---- core skills drag-and-drop ----
  onPromoteToCore: (skillKey: string) => void;
  onDemoteFromCore: (skillKey: string) => void;
  coreCount: number;
  coreMax: number;
  // ---- marketplace ----
  activeTab: "local" | "market";
  onTabChange: (tab: "local" | "market") => void;
  marketLoading: boolean;
  marketError: string | null;
  marketSearchResult: SkillsMarketSearchResult | null;
  marketCategory: string;
  installProgress: Record<string, InstallProgress>;
  onMarketSearch: (keyword: string) => void;
  onMarketCategoryChange: (category: string) => void;
  onMarketLoadMore: () => void;
  hasMorePages: boolean;
  onMarketInstall: (skillName: string) => void;
  onMarketRefresh: () => void;
  // ---- import modal ----
  importOpen: boolean;
  importPath: string;
  importBrowseResult: BrowseResult | null;
  importLoading: boolean;
  importError: string | null;
  importSuccess: string | null;
  onImportOpen: () => void;
  onImportClose: () => void;
  onImportBrowse: (path?: string) => void;
  onImportPathChange: (path: string) => void;
  onImportExecute: (path: string, mode: "copy" | "reference") => void;
};

// ============================================================================
// Marketplace constants
// ============================================================================

const SKILLS_CATEGORIES: ReadonlyArray<{ id: string; emoji: string }> = [
  { id: "all", emoji: "\u{1F31F}" },
  { id: "\u751F\u4EA7\u529B\u5DE5\u5177", emoji: "\u26A1" },           // 生产力工具
  { id: "AI \u5DE5\u5177", emoji: "\u{1F916}" },                       // AI 工具
  { id: "\u5F00\u53D1\u5DE5\u5177", emoji: "\u{1F6E0}\uFE0F" },       // 开发工具
  { id: "\u6570\u636E\u5DE5\u5177", emoji: "\u{1F4CA}" },             // 数据工具
  { id: "\u901A\u4FE1\u534F\u4F5C", emoji: "\u{1F4AC}" },             // 通信协作
  { id: "\u7CFB\u7EDF\u5DE5\u5177", emoji: "\u{1F5A5}\uFE0F" },       // 系统工具
  { id: "\u5B89\u5168\u5DE5\u5177", emoji: "\u{1F512}" },             // 安全工具
  { id: "\u5185\u5BB9\u7BA1\u7406", emoji: "\u{1F4DD}" },             // 内容管理
  { id: "\u667A\u80FD\u5BB6\u5C45", emoji: "\u{1F3E0}" },             // 智能家居
  { id: "\u591A\u5A92\u4F53", emoji: "\u{1F3A8}" },                   // 多媒体
];

/** 按 category 查找对应的 emoji，QC 数据源没有 emoji 字段，用此做 fallback */
const _categoryEmojiMap = new Map(SKILLS_CATEGORIES.map((c) => [c.id, c.emoji]));
function categoryEmoji(category: string | undefined): string {
  if (!category) return "\u{1F4E6}"; // 📦
  return _categoryEmojiMap.get(category) ?? "\u{1F4E6}";
}

let _skillSearchTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// Tier section pagination state
// ============================================================================

const TIER_PAGE_SIZE = 50;
const _tierVisibleCounts = new Map<string, number>();
let _lastFilterValue = "";

function getTierVisibleCount(tierId: string): number {
  return _tierVisibleCounts.get(tierId) ?? TIER_PAGE_SIZE;
}

function showMoreInTier(tierId: string) {
  _tierVisibleCounts.set(tierId, getTierVisibleCount(tierId) + TIER_PAGE_SIZE);
}

function resetTierPagination() {
  _tierVisibleCounts.clear();
}

// ============================================================================
// Tier section config
// ============================================================================

type TierConfig = {
  id: TierGroupId;
  icon: string;
  descKey: string;
  accentColor: string;
  accentBg: string;
};

const TIER_CONFIGS: Record<TierGroupId, TierConfig> = {
  core: {
    id: "core",
    icon: "\u2B50",
    descKey: "skills.tier.core.desc",
    accentColor: "#f59e0b",
    accentBg: "rgba(251,191,36,0.08)",
  },
  ready: {
    id: "ready",
    icon: "\u2705",
    descKey: "skills.tier.ready.desc",
    accentColor: "#34d399",
    accentBg: "rgba(52,211,153,0.06)",
  },
  "needs-config": {
    id: "needs-config",
    icon: "\u{1F527}",
    descKey: "skills.tier.needsConfig.desc",
    accentColor: "#f97316",
    accentBg: "rgba(249,115,22,0.06)",
  },
  incompatible: {
    id: "incompatible",
    icon: "\u{1F6AB}",
    descKey: "skills.tier.incompatible.desc",
    accentColor: "#94a3b8",
    accentBg: "rgba(148,163,184,0.06)",
  },
};

// ============================================================================
// Main render
// ============================================================================

export function renderSkills(props: SkillsProps) {
  return html`
    ${renderTabBar(props)}
    ${props.activeTab === "local"
      ? renderLocalSkills(props)
      : renderMarketplace(props)}
  `;
}

// ============================================================================
// Tab bar (matching extensions-page pattern)
// ============================================================================

function renderTabBar(props: SkillsProps) {
  const { activeTab, onTabChange } = props;

  const renderTab = (id: "local" | "market", label: string) => {
    const isActive = id === activeTab;
    return html`
      <button
        @click=${() => onTabChange(id)}
        style="
          all:unset; cursor:pointer;
          padding:10px 20px;
          font-size:14px;
          font-weight:${isActive ? "700" : "400"};
          color:${isActive ? "var(--fg)" : "var(--muted-strong, #6b7d91)"};
          border-bottom:2px solid ${isActive ? "var(--accent, #6c8cff)" : "transparent"};
          transition:color 150ms, border-color 150ms;
          user-select:none;
        "
      >${label}</button>
    `;
  };

  // Compute stats for the inline summary (only when local tab data is available)
  const skills = props.report?.skills ?? [];
  const groups = groupByTier(skills);
  const coreSkillCount = groups.find((g) => g.id === "core")?.skills.length ?? 0;
  const readySkillCount = groups.find((g) => g.id === "ready")?.skills.length ?? 0;
  const attentionSkillCount = groups.find((g) => g.id === "needs-config")?.skills.length ?? 0;

  return html`
    <div style="
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin-bottom:20px;
      border-bottom:1px solid var(--border);
      gap:8px;
      flex-wrap:wrap;
    ">
      <!-- Left: tabs -->
      <div style="display:flex; align-items:center; gap:0;">
        ${renderTab("local", t("skills.tab.local" as never))}
        ${renderTab("market", t("skills.tab.remote" as never))}
      </div>
      <!-- Right: stats + actions (only on local tab) -->
      ${activeTab === "local" ? html`
        <div style="display:flex; align-items:center; gap:12px; padding-right:4px; flex-shrink:0;">
          <span style="
            font-size:12px; color:var(--muted-strong, #6b7d91);
            white-space:nowrap; font-family:var(--mono, monospace);
            letter-spacing:0.01em;
          ">
            <span style="color:#f59e0b; font-weight:600;">${coreSkillCount}</span> ${t("skills.dashboard.coreLabel" as never)}
            <span style="opacity:0.4; margin:0 4px;">/</span>
            <span style="color:#34d399; font-weight:600;">${readySkillCount}</span> ${t("skills.dashboard.readyLabel" as never)}
            <span style="opacity:0.4; margin:0 4px;">/</span>
            <span style="color:#f97316; font-weight:600;">${attentionSkillCount}</span> ${t("skills.dashboard.attentionLabel" as never)}
          </span>
          <button class="btn" style="font-size:12px; padding:5px 14px;"
            @click=${props.onImportOpen}
          >${t("skills.import.button" as never)}</button>
          <button class="btn" style="font-size:12px; padding:5px 14px;"
            ?disabled=${props.loading}
            @click=${props.onRefresh}
          >${props.loading ? t("skills.market.syncing" as never) : t("common.refresh" as never)}</button>
        </div>
      ` : nothing}
    </div>
  `;
}

// ============================================================================
// Tab 1: Local Skills — tier-based layout with drag-and-drop
// ============================================================================

function renderLocalSkills(props: SkillsProps) {
  const skills = props.report?.skills ?? [];
  const filter = props.filter.trim().toLowerCase();

  // Reset pagination when filter changes
  if (filter !== _lastFilterValue) {
    _lastFilterValue = filter;
    resetTierPagination();
  }

  const filtered = filter
    ? skills.filter((skill) =>
        [skill.name, skill.nameZh, skill.description, skill.descriptionZh, skill.source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(filter),
      )
    : skills;
  const groups = groupByTier(filtered);

  // Always show core section as a drop target if there are core skills in the full list
  // (even when filter hides them all), so users can still drop ready skills into core
  const hasCoreGroup = groups.some((g) => g.id === "core");
  const hasUnfilteredCoreSkills = props.coreCount > 0;
  const showEmptyCoreSection = !hasCoreGroup && hasUnfilteredCoreSkills && filter !== "";

  return html`
    <section class="card">
      <!-- Search -->
      <div style="display:flex; align-items:center; gap:10px;">
        <input
          class="skills-local-search"
          style="
            flex:1; padding:8px 14px; font-size:13px;
            border:1.5px solid var(--border); border-radius:var(--radius-md, 8px);
            background:var(--card); color:var(--fg); outline:none;
            transition:border-color 150ms, box-shadow 150ms;
          "
          .value=${props.filter}
          @input=${(e: Event) =>
            props.onFilterChange((e.target as HTMLInputElement).value)}
          placeholder=${t("skills.filterPlaceholder" as never)}
        />
        <span class="muted" style="font-size:12px; white-space:nowrap;">
          ${filtered.length} ${t("skills.shown" as never)}
        </span>
      </div>

      ${props.error
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${props.error}
          </div>`
        : nothing}
      <div style="margin-top: 16px; display:flex; flex-direction:column; gap:20px;">
        ${showEmptyCoreSection
          ? renderCoreTierSection(
              { id: "core", label: t("skills.tier.core" as never) || "\u6838\u5FC3\u6280\u80FD", skills: [] },
              props,
              TIER_CONFIGS.core,
            )
          : nothing}
        ${groups.map((group) => renderTierSection(group, props))}
        ${filtered.length === 0 && !showEmptyCoreSection
          ? renderEmptyState(props)
          : nothing}
      </div>
    </section>
    ${renderLocalSkillsStyles()}
    ${props.importOpen ? renderSkillImportModal(props) : nothing}
  `;
}

// ============================================================================
// Dashboard summary: ring chart + 3 stat cards
// ============================================================================

function renderDashboard(
  coreCount: number,
  coreMax: number,
  coreFiltered: number,
  readyFiltered: number,
  attentionFiltered: number,
) {
  // SVG ring chart calculations
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const ratio = coreMax > 0 ? Math.min(coreCount / coreMax, 1) : 0;
  const dashOffset = circumference * (1 - ratio);
  const ringColor = ratio >= 1 ? "#ef4444" : ratio > 0.6 ? "#f59e0b" : "var(--accent, #6c8cff)";

  return html`
    <div class="skills-dashboard">
      <!-- Ring Chart -->
      <div class="skills-dashboard__ring">
        <svg class="skills-ring-svg" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="${radius}"
            fill="none" stroke="var(--border)" stroke-width="6" opacity="0.3" />
          <circle cx="40" cy="40" r="${radius}"
            fill="none" stroke="${ringColor}" stroke-width="6"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dashOffset}"
            stroke-linecap="round"
            class="skills-ring-progress"
            transform="rotate(-90 40 40)" />
        </svg>
        <div class="skills-ring-text">
          <span class="skills-ring-value">${coreCount}</span>
          <span class="skills-ring-max">/ ${coreMax}</span>
        </div>
      </div>

      <!-- 3 Stat Cards -->
      <div class="skills-dashboard__stats">
        <div class="skills-stat-card">
          <div class="skills-stat-card__icon skills-stat-card__icon--core">
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          </div>
          <div class="skills-stat-card__info">
            <span class="skills-stat-card__value">${coreFiltered}</span>
            <span class="skills-stat-card__label">${t("skills.dashboard.coreLabel" as never)}</span>
          </div>
        </div>

        <div class="skills-stat-card">
          <div class="skills-stat-card__icon skills-stat-card__icon--ready">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <div class="skills-stat-card__info">
            <span class="skills-stat-card__value">${readyFiltered}</span>
            <span class="skills-stat-card__label">${t("skills.dashboard.readyLabel" as never)}</span>
          </div>
        </div>

        <div class="skills-stat-card">
          <div class="skills-stat-card__icon skills-stat-card__icon--blocked">
            <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </div>
          <div class="skills-stat-card__info">
            <span class="skills-stat-card__value">${attentionFiltered}</span>
            <span class="skills-stat-card__label">${t("skills.dashboard.attentionLabel" as never)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// Empty state with illustration + CTA
// ============================================================================

function renderEmptyState(props: SkillsProps) {
  return html`
    <div class="skills-empty-state">
      <div class="skills-empty-state__icon">
        <svg viewBox="0 0 24 24">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>
      <div class="skills-empty-state__title">${t("skills.empty.title" as never)}</div>
      <div class="skills-empty-state__desc">${t("skills.empty.description" as never)}</div>
      <button
        class="btn"
        style="margin-top:16px;"
        @click=${() => props.onTabChange("market")}
      >${t("skills.empty.browseMarket" as never)}</button>
    </div>
  `;
}

// ============================================================================
// Tier section rendering
// ============================================================================

function renderTierSection(group: SkillGroup, props: SkillsProps) {
  const tierId = group.id as TierGroupId;
  const config = TIER_CONFIGS[tierId];
  if (!config) return nothing;

  if (tierId === "core") return renderCoreTierSection(group, props, config);
  if (tierId === "ready") return renderReadyTierSection(group, props, config);
  if (tierId === "incompatible") return renderIncompatibleTierSection(group, props, config);
  return renderStaticTierSection(group, props, config);
}

// ---- Core section: drop target, draggable cards, counter ----

function renderCoreTierSection(group: SkillGroup, props: SkillsProps, config: TierConfig) {
  const atLimit = props.coreCount >= props.coreMax;
  const nearLimit = !atLimit && props.coreCount > 30; // 超过 30 个就提醒用户注意 token 开销
  const visibleCount = getTierVisibleCount("core");
  const visible = group.skills.slice(0, visibleCount);
  const hasMore = group.skills.length > visibleCount;

  return html`
    <div
      class="skills-tier-section skills-tier-section--core"
      data-tier="core"
      style="
        border-radius:var(--radius-lg, 12px);
        padding:16px;
        background:${config.accentBg};
        transition:border-color 200ms, background 200ms;
      "
      @dragover=${(e: DragEvent) => {
        if (!e.dataTransfer?.types.includes("application/x-skill-tier")) return;
        if (atLimit) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
        const dropZone = (e.currentTarget as HTMLElement).querySelector(".skills-drop-zone");
        if (dropZone) dropZone.classList.add("skills-drop-active", "skills-drop-active--core");
      }}
      @dragleave=${(e: DragEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (!el.contains(e.relatedTarget as Node)) {
          const dropZone = el.querySelector(".skills-drop-zone");
          if (dropZone) dropZone.classList.remove("skills-drop-active", "skills-drop-active--core");
        }
      }}
      @drop=${(e: DragEvent) => {
        e.preventDefault();
        const el = e.currentTarget as HTMLElement;
        const dropZone = el.querySelector(".skills-drop-zone");
        if (dropZone) dropZone.classList.remove("skills-drop-active", "skills-drop-active--core");
        if (atLimit) return;
        const skillKey = e.dataTransfer?.getData("text/plain");
        const sourceTier = e.dataTransfer?.getData("application/x-skill-tier");
        if (skillKey && sourceTier === "ready") {
          props.onPromoteToCore(skillKey);
        }
      }}
    >
      <!-- Header -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">${config.icon}</span>
          <span style="font-size:16px; font-weight:700; color:var(--fg);">${group.label}</span>
          <span style="
            font-size:12px; font-weight:700; padding:3px 12px; border-radius:10px;
            background:${atLimit ? "rgba(239,68,68,0.12)" : "rgba(251,191,36,0.15)"};
            color:${atLimit ? "#ef4444" : "#f59e0b"};
            font-family:var(--mono, monospace);
          ">${props.coreCount}/${props.coreMax}</span>
        </div>
        <span style="font-size:11px; color:var(--muted-strong, #6b7d91);">
          ${t("skills.tier.core.desc" as never)}
        </span>
      </div>
      ${atLimit
        ? html`<div style="
            font-size:12px; padding:8px 12px; margin-bottom:12px; border-radius:8px;
            background:rgba(239,68,68,0.08); color:#ef4444; border:1px solid rgba(239,68,68,0.2);
          ">${t("skills.core.limitReached" as never)}</div>`
        : nearLimit
        ? html`<div style="
            font-size:12px; padding:8px 12px; margin-bottom:12px; border-radius:8px;
            background:rgba(251,191,36,0.08); color:#d97706; border:1px solid rgba(251,191,36,0.2);
          ">${t("skills.core.tokenWarning" as never)}</div>`
        : html`<div class="skills-drop-zone">
            <span class="skills-drop-zone__icon">
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            ${t("skills.dnd.dropToAdd" as never)}
          </div>`}
      <!-- Cards -->
      <div class="skills-tier-grid">
        ${visible.map((skill) => renderDraggableSkillCard(skill, "core", props))}
      </div>
      ${hasMore ? renderLoadMoreButton("core", visible.length, group.skills.length, props) : nothing}
    </div>
  `;
}

// ---- Ready section: drop target (for demoting), draggable cards ----

function renderReadyTierSection(group: SkillGroup, props: SkillsProps, config: TierConfig) {
  const visibleCount = getTierVisibleCount("ready");
  const visible = group.skills.slice(0, visibleCount);
  const hasMore = group.skills.length > visibleCount;

  return html`
    <div
      class="skills-tier-section skills-tier-section--ready"
      data-tier="ready"
      style="
        border-radius:var(--radius-lg, 12px);
        padding:16px;
        background:${config.accentBg};
        transition:border-color 200ms, background 200ms;
      "
      @dragover=${(e: DragEvent) => {
        if (!e.dataTransfer?.types.includes("application/x-skill-tier")) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
        const dropZone = (e.currentTarget as HTMLElement).querySelector(".skills-drop-zone");
        if (dropZone) dropZone.classList.add("skills-drop-active", "skills-drop-active--ready");
      }}
      @dragleave=${(e: DragEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (!el.contains(e.relatedTarget as Node)) {
          const dropZone = el.querySelector(".skills-drop-zone");
          if (dropZone) dropZone.classList.remove("skills-drop-active", "skills-drop-active--ready");
        }
      }}
      @drop=${(e: DragEvent) => {
        e.preventDefault();
        const el = e.currentTarget as HTMLElement;
        const dropZone = el.querySelector(".skills-drop-zone");
        if (dropZone) dropZone.classList.remove("skills-drop-active", "skills-drop-active--ready");
        const skillKey = e.dataTransfer?.getData("text/plain");
        const sourceTier = e.dataTransfer?.getData("application/x-skill-tier");
        if (skillKey && sourceTier === "core") {
          props.onDemoteFromCore(skillKey);
        }
      }}
    >
      <!-- Header -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">${config.icon}</span>
          <span style="font-size:15px; font-weight:700; color:var(--fg);">${group.label}</span>
          <span class="muted" style="font-size:12px;">${group.skills.length}</span>
        </div>
        <span style="font-size:11px; color:var(--muted-strong, #6b7d91);">
          ${t("skills.tier.ready.desc" as never)}
        </span>
      </div>
      <div class="skills-drop-zone">
        <span class="skills-drop-zone__icon">
          <svg viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6" /></svg>
        </span>
        ${t("skills.dnd.dropToRemove" as never)}
      </div>
      <!-- Cards -->
      <div class="skills-tier-grid">
        ${visible.map((skill) => renderDraggableSkillCard(skill, "ready", props))}
      </div>
      ${hasMore ? renderLoadMoreButton("ready", visible.length, group.skills.length, props) : nothing}
    </div>
  `;
}

// ---- Needs-config section: static cards ----

function renderStaticTierSection(group: SkillGroup, props: SkillsProps, config: TierConfig) {
  const tierId = group.id;
  const visibleCount = getTierVisibleCount(tierId);
  const visible = group.skills.slice(0, visibleCount);
  const hasMore = group.skills.length > visibleCount;

  return html`
    <div class="skills-tier-section--needs-config" style="
      border-radius:var(--radius-lg, 12px);
      padding:16px;
      background:${config.accentBg};
    ">
      <!-- Header -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">${config.icon}</span>
          <span style="font-size:15px; font-weight:700; color:var(--fg);">${group.label}</span>
          <span class="muted" style="font-size:12px;">${group.skills.length}</span>
        </div>
        <span style="font-size:11px; color:var(--muted-strong, #6b7d91);">
          ${t(config.descKey as never)}
        </span>
      </div>
      <!-- Cards -->
      <div class="skills-tier-grid">
        ${visible.map((skill) => renderSkillCard(skill, tierId as TierGroupId, props))}
      </div>
      ${hasMore ? renderLoadMoreButton(tierId, visible.length, group.skills.length, props) : nothing}
    </div>
  `;
}

// ---- Incompatible section: collapsed by default ----

function renderIncompatibleTierSection(group: SkillGroup, props: SkillsProps, config: TierConfig) {
  const tierId = "incompatible";
  const visibleCount = getTierVisibleCount(tierId);
  const visible = group.skills.slice(0, visibleCount);
  const hasMore = group.skills.length > visibleCount;

  return html`
    <details class="skills-tier-section--incompatible" style="
      border-radius:var(--radius-lg, 12px);
      background:${config.accentBg};
    ">
      <summary style="
        display:flex; align-items:center; justify-content:space-between;
        padding:16px; cursor:pointer; user-select:none;
      ">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">${config.icon}</span>
          <span style="font-size:15px; font-weight:700; color:var(--fg);">${group.label}</span>
          <span class="muted" style="font-size:12px;">${group.skills.length}</span>
        </div>
        <span style="font-size:11px; color:var(--muted-strong, #6b7d91);">
          ${t(config.descKey as never)}
        </span>
      </summary>
      <div style="padding:0 16px 16px;">
        <div class="skills-tier-grid">
          ${visible.map((skill) => renderSkillCard(skill, tierId, props))}
        </div>
        ${hasMore ? renderLoadMoreButton(tierId, visible.length, group.skills.length, props) : nothing}
      </div>
    </details>
  `;
}

// ============================================================================
// Skill card (draggable variant for core/ready)
// ============================================================================

function renderDraggableSkillCard(skill: SkillStatusEntry, tier: TierGroupId, props: SkillsProps) {
  return html`
    <div
      class="skills-tier-card skills-tier-card--draggable"
      draggable="true"
      @dragstart=${(e: DragEvent) => {
        e.dataTransfer!.setData("text/plain", skill.skillKey);
        e.dataTransfer!.setData("application/x-skill-tier", tier);
        e.dataTransfer!.effectAllowed = "move";
        (e.currentTarget as HTMLElement).classList.add("skills-tier-card--dragging");
      }}
      @dragend=${(e: DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove("skills-tier-card--dragging");
      }}
    >
      <div style="display:flex; gap:4px;">
        <div class="skills-drag-handle" title="${t("skills.dnd.dragHint" as never)}">
          <span class="skills-drag-handle__line"></span>
          <span class="skills-drag-handle__line"></span>
          <span class="skills-drag-handle__line"></span>
        </div>
        <div style="flex:1; min-width:0;">
          ${renderSkillCardContent(skill, tier, props)}
        </div>
      </div>
    </div>
  `;
}

function renderSkillCard(skill: SkillStatusEntry, tier: TierGroupId, props: SkillsProps) {
  return html`
    <div class="skills-tier-card">
      ${renderSkillCardContent(skill, tier, props)}
    </div>
  `;
}

function renderSkillCardContent(skill: SkillStatusEntry, tier: TierGroupId, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const apiKey = props.edits[skill.skillKey] ?? "";
  const message = props.messages[skill.skillKey] ?? null;
  const canInstall = skill.install.length > 0 && skill.missing.bins.length > 0;
  const missing = computeSkillMissing(skill);
  const reasons = computeSkillReasons(skill);
  // Real-time install progress from backend (keyed by skill name)
  const progress = props.installProgress[skill.name] ?? props.installProgress[skill.skillKey] ?? null;

  return html`
    <!-- Header row -->
    <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:8px;">
      <div style="
        width:40px; height:40px; border-radius:10px; flex-shrink:0;
        display:flex; align-items:center; justify-content:center;
        font-size:20px;
        background:${tier === "core" ? "rgba(251,191,36,0.12)" :
                     tier === "ready" ? "rgba(52,211,153,0.1)" :
                     tier === "incompatible" ? "rgba(148,163,184,0.1)" :
                     "rgba(249,115,22,0.1)"};
        border:1px solid ${tier === "core" ? "rgba(251,191,36,0.2)" :
                          tier === "ready" ? "rgba(52,211,153,0.15)" :
                          tier === "incompatible" ? "rgba(148,163,184,0.15)" :
                          "rgba(249,115,22,0.15)"};
      ">
        ${skill.emoji || "\u{1F4E6}"}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span style="font-size:13px; font-weight:600; color:var(--fg);">
            ${skill.nameZh || skill.name}
          </span>
          ${tier === "incompatible" ? renderIncompatibleBadge(skill.requirements.os) : nothing}
          ${skill.bundled && !skill.activeInPrompt && !skill.disabled && tier === "ready"
            ? html`<span style="font-size:10px; padding:1px 6px; border-radius:4px;
                background:rgba(251,191,36,0.1); color:#d97706;">
                ${t("skills.bundled.notInCore" as never)}</span>`
            : nothing}
          ${skill.cnDeprioritized
            ? html`<span style="font-size:10px; padding:1px 6px; border-radius:4px;
                background:rgba(248,113,113,0.1); color:#f87171;"
                title=${t("skills.market.cnBlocked.reason" as never)}
              >${t("skills.market.cnBlocked.vpnHint" as never)}</span>`
            : nothing}
          ${skill.disabled
            ? html`<span style="font-size:10px; padding:1px 6px; border-radius:4px;
                background:rgba(239,68,68,0.1); color:#ef4444;">
                ${t("skills.disabled" as never)}</span>`
            : nothing}
        </div>
        <div style="font-size:11px; color:var(--fg-secondary, #a0aec0); margin-top:3px;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
          line-height:1.5;">
          ${clampText(skill.descriptionZh || skill.description, 100)}
        </div>
      </div>
    </div>

    <!-- Missing deps -->
    ${missing.length > 0
      ? html`<div style="font-size:10px; color:var(--muted-strong, #6b7d91); margin-bottom:6px;">
          ${t("skills.missing" as never)}: ${missing.join(", ")}
        </div>`
      : nothing}
    ${reasons.length > 0
      ? html`<div style="font-size:10px; color:var(--muted-strong, #6b7d91); margin-bottom:6px;">
          ${t("skills.reason" as never)}: ${reasons.join(", ")}
        </div>`
      : nothing}

    <!-- Actions row -->
    <div class="skills-card-footer">
      ${tier === "ready"
        ? html`<button
            class="btn" style="font-size:11px; padding:3px 10px;"
            ?disabled=${busy}
            @click=${() => props.onPromoteToCore(skill.skillKey)}
          >${t("skills.action.addToCore" as never)}</button>`
        : nothing}
      ${tier === "core"
        ? html`<button
            class="btn" style="font-size:11px; padding:3px 10px;"
            ?disabled=${busy}
            @click=${() => props.onDemoteFromCore(skill.skillKey)}
          >${t("skills.core.demoteFromCore" as never)}</button>`
        : nothing}
      ${tier !== "incompatible"
        ? html`<button
            class="btn" style="font-size:11px; padding:3px 10px;"
            ?disabled=${busy}
            @click=${() => props.onToggle(skill.skillKey, skill.disabled)}
          >${skill.disabled ? t("skills.enable" as never) : t("skills.disable" as never)}</button>`
        : nothing}
      ${canInstall
        ? html`<button
            class="btn" style="font-size:11px; padding:3px 10px;"
            ?disabled=${busy}
            @click=${() => props.onInstall(skill.skillKey, skill.name, skill.install[0].id)}
          >${busy ? t("skills.installing" as never) : skill.install[0].label}</button>`
        : nothing}
    </div>

    <!-- Install progress bar -->
    ${progress && progress.stage !== "done"
      ? html`<div style="margin-top:8px;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="font-size:10px; color:var(--fg-secondary, #a0aec0); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${progress.message}
            </span>
            ${progress.percent != null
              ? html`<span style="font-size:10px; font-weight:600; color:var(--fg); font-family:var(--mono,monospace);">${progress.percent}%</span>`
              : nothing}
          </div>
          <div style="
            height:4px; border-radius:2px; overflow:hidden;
            background:var(--border, rgba(148,163,184,0.2));
          ">
            <div style="
              height:100%; border-radius:2px; transition:width 300ms ease;
              width:${progress.percent ?? 50}%;
              background:linear-gradient(90deg, #60a5fa, #3b82f6);
            "></div>
          </div>
        </div>`
      : nothing}

    <!-- Message -->
    ${message
      ? html`<div style="
          margin-top:6px; font-size:11px;
          color:${message.kind === "error" ? "var(--danger-color, #d14343)" : "var(--success-color, #0a7f5a)"};
        ">${message.message}</div>`
      : nothing}

    <!-- API key -->
    ${skill.primaryEnv
      ? html`
          <div class="field" style="margin-top:8px;">
            <span style="font-size:11px;">${t("skills.apiKey" as never)}</span>
            <input
              type="password"
              style="font-size:12px;"
              .value=${apiKey}
              @input=${(e: Event) =>
                props.onEdit(skill.skillKey, (e.target as HTMLInputElement).value)}
            />
          </div>
          <button
            class="btn primary" style="margin-top:6px; font-size:11px; padding:3px 10px;"
            ?disabled=${busy}
            @click=${() => props.onSaveKey(skill.skillKey)}
          >${t("skills.saveKey" as never)}</button>
        `
      : nothing}
  `;
}

// ============================================================================
// Load more button for tier sections
// ============================================================================

function renderLoadMoreButton(tierId: string, shown: number, total: number, props: SkillsProps) {
  return html`
    <button
      class="btn"
      style="margin-top:10px; width:100%; font-size:12px;"
      @click=${() => {
        showMoreInTier(tierId);
        // Bump the render key to force Lit re-render (filter same-value is a no-op)
        props.onTierRenderBump();
      }}
    >
      ${t("skills.loadMore" as never)} (${shown}/${total})
    </button>
  `;
}

// ============================================================================
// Local skills CSS (injected once)
// ============================================================================

function renderLocalSkillsStyles() {
  return html`
    <style>
      .skills-local-search:focus {
        border-color: var(--accent, #6c8cff);
        box-shadow: 0 0 0 3px rgba(108, 140, 255, 0.1);
      }
      .skills-tier-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      }
      @media (max-width: 700px) {
        .skills-tier-grid {
          grid-template-columns: 1fr;
        }
      }
      .skills-tier-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md, 8px);
        padding: 14px;
        display: flex;
        flex-direction: column;
        transition: box-shadow 200ms, border-color 200ms, opacity 200ms;
      }
      .skills-tier-card:hover {
        border-color: var(--accent, #6c8cff);
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .skills-tier-card--draggable {
        cursor: grab;
      }
      .skills-tier-card--draggable:active {
        cursor: grabbing;
      }
      .skills-tier-card--dragging {
        opacity: 0.35;
        border-style: dashed;
        border-color: var(--accent, #6c8cff);
      }
    </style>
  `;
}

// ============================================================================
// Skills Import Modal — 本地技能导入对话框
// ============================================================================

function renderSkillImportModal(props: SkillsProps) {
  const result = props.importBrowseResult;
  const dirs = result?.directories ?? [];
  const drives = result?.drives ?? [];
  const isSkillDir = result?.isSkillDir ?? false;
  const skillSubdirCount = result?.skillSubdirCount ?? 0;
  const currentPath = result?.currentPath ?? "";
  const parentPath = result?.parentPath ?? null;

  return html`
    <div
      style="
        position:fixed; inset:0; z-index:9000;
        display:flex; align-items:center; justify-content:center;
        background:rgba(0,0,0,0.7); backdrop-filter:blur(6px);
        animation:skillImportOverlayIn 0.25s ease;
      "
      @click=${(e: Event) => {
        if (e.target === e.currentTarget) props.onImportClose();
      }}
    >
      <div
        style="
          width:92%; max-width:640px; max-height:85vh;
          background:var(--card); border:1px solid var(--border);
          border-radius:18px; overflow:hidden;
          display:flex; flex-direction:column;
          animation:skillImportModalIn 0.35s cubic-bezier(0.34,1.3,0.64,1);
        "
        @click=${(e: Event) => e.stopPropagation()}
      >
        <!-- Header -->
        <div style="
          display:flex; align-items:center; justify-content:space-between;
          padding:20px 24px 16px; border-bottom:1px solid var(--border); flex-shrink:0;
        ">
          <div style="font-size:17px; font-weight:700; color:var(--fg);">
            ${t("skills.import.title" as never)}
          </div>
          <button @click=${props.onImportClose} style="
            all:unset; cursor:pointer; font-size:18px; color:var(--muted-strong, #6b7d91);
            width:28px; height:28px; display:flex; align-items:center; justify-content:center;
            border-radius:6px; transition:background 150ms;
          ">&times;</button>
        </div>

        <!-- Path input bar -->
        <div style="display:flex; gap:8px; padding:16px 24px 0; flex-shrink:0;">
          <input
            type="text"
            .value=${props.importPath}
            @input=${(e: Event) => props.onImportPathChange((e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter") props.onImportBrowse(props.importPath);
            }}
            placeholder=${t("skills.import.pathPlaceholder" as never)}
            style="
              flex:1; padding:8px 14px; font-size:13px;
              border:1px solid var(--border); border-radius:8px;
              background:var(--bg, #fff); color:var(--fg);
              outline:none; font-family:var(--mono, monospace);
            "
          />
          <button
            class="btn primary"
            ?disabled=${props.importLoading}
            @click=${() => props.onImportBrowse(props.importPath)}
            style="font-size:13px; padding:8px 16px;"
          >${t("skills.import.go" as never)}</button>
        </div>

        <!-- Windows drives bar -->
        ${drives.length > 0 ? html`
          <div style="display:flex; gap:6px; padding:10px 24px 0; flex-wrap:wrap;">
            ${drives.map(drive => html`
              <button @click=${() => props.onImportBrowse(drive)} style="
                all:unset; cursor:pointer; padding:4px 10px;
                font-size:12px; font-family:var(--mono, monospace);
                border:1px solid var(--border); border-radius:6px;
                color:var(--fg); background:var(--bg-accent, var(--secondary));
                transition:border-color 150ms;
              " title=${drive}>${drive.replace("\\", "")}</button>
            `)}
          </div>
        ` : nothing}

        <!-- Directory listing (scrollable) -->
        <div style="flex:1; overflow-y:auto; padding:12px 24px; min-height:200px;">
          ${props.importLoading ? html`
            <div style="text-align:center; padding:40px 0; color:var(--muted-strong, #6b7d91);">
              <div style="
                width:20px; height:20px; margin:0 auto 12px;
                border:2px solid var(--accent, #6c8cff);
                border-top-color:transparent; border-radius:50%;
                animation:skillImportSpin 0.8s linear infinite;
              "></div>
            </div>
          ` : html`
            <!-- Parent directory link -->
            ${parentPath != null ? html`
              <div
                @click=${() => props.onImportBrowse(parentPath)}
                class="skill-import-dir"
                style="
                  display:flex; align-items:center; gap:8px;
                  padding:8px 12px; cursor:pointer;
                  border-radius:8px; transition:background 150ms;
                  color:var(--fg);
                "
              >
                <span style="font-size:15px; opacity:0.7;">&#x1F519;</span>
                <span style="font-size:13px; font-weight:500;">..</span>
              </div>
            ` : nothing}

            <!-- Directory entries -->
            ${dirs.map(dir => html`
              <div
                @click=${() => props.onImportBrowse(dir.path)}
                class="skill-import-dir"
                style="
                  display:flex; align-items:center; gap:8px;
                  padding:8px 12px; cursor:pointer;
                  border-radius:8px; transition:background 150ms;
                  color:var(--fg);
                "
              >
                <span style="font-size:15px;">
                  ${dir.hasSkillMd ? "\u2B50" : "\uD83D\uDCC1"}
                </span>
                <span style="font-size:13px; font-weight:${dir.hasSkillMd ? "600" : "400"};">
                  ${dir.name}
                </span>
                ${dir.hasSkillMd ? html`
                  <span style="
                    font-size:10px; padding:2px 8px; border-radius:4px;
                    background:rgba(52,211,153,0.12); color:#34d399;
                    margin-left:auto; font-weight:600;
                  ">SKILL.md</span>
                ` : nothing}
              </div>
            `)}

            ${dirs.length === 0 && parentPath != null ? html`
              <div style="text-align:center; padding:20px; font-size:12px; color:var(--muted-strong, #6b7d91);">
                （空目录）
              </div>
            ` : nothing}
          `}
        </div>

        <!-- Detection status + import actions -->
        <div style="padding:16px 24px; border-top:1px solid var(--border); flex-shrink:0;">
          ${props.importLoading ? nothing
            : isSkillDir ? html`
            <div style="
              display:flex; align-items:center; gap:10px; flex-wrap:wrap;
              padding:12px; border-radius:10px;
              background:rgba(52,211,153,0.06); border:1px solid rgba(52,211,153,0.15);
              margin-bottom:12px;
            ">
              <span style="font-size:14px;">\u2705</span>
              <span style="font-size:13px; color:var(--fg); flex:1;">
                ${t("skills.import.detectedSkill" as never)}
              </span>
            </div>
            <div style="display:flex; gap:8px; justify-content:flex-end;">
              <button
                class="btn"
                ?disabled=${props.importLoading}
                @click=${() => props.onImportExecute(currentPath, "reference")}
                title=${t("skills.import.referenceHint" as never)}
              >${t("skills.import.addReference" as never)}</button>
              <button
                class="btn primary"
                ?disabled=${props.importLoading}
                @click=${() => props.onImportExecute(currentPath, "copy")}
                title=${t("skills.import.copyHint" as never)}
              >${t("skills.import.copyImport" as never)}</button>
            </div>
          ` : skillSubdirCount > 0 ? html`
            <div style="
              display:flex; align-items:center; gap:10px; flex-wrap:wrap;
              padding:12px; border-radius:10px;
              background:rgba(251,191,36,0.06); border:1px solid rgba(251,191,36,0.15);
              margin-bottom:12px;
            ">
              <span style="font-size:14px;">\uD83D\uDCE6</span>
              <span style="font-size:13px; color:var(--fg); flex:1;">
                ${(t("skills.import.detectedMultiple" as never) as string).replace("{count}", String(skillSubdirCount))}
              </span>
            </div>
            <div style="display:flex; gap:8px; justify-content:flex-end;">
              <button
                class="btn"
                ?disabled=${props.importLoading}
                @click=${() => props.onImportExecute(currentPath, "reference")}
                title=${t("skills.import.referenceHint" as never)}
              >${t("skills.import.addReference" as never)}</button>
              <button
                class="btn primary"
                ?disabled=${props.importLoading}
                @click=${() => props.onImportExecute(currentPath, "copy")}
                title=${t("skills.import.copyHint" as never)}
              >${t("skills.import.copyImport" as never)}</button>
            </div>
          ` : html`
            <div style="text-align:center; padding:12px; font-size:12px; color:var(--muted-strong, #6b7d91);">
              ${t("skills.import.noSkillFound" as never)}
            </div>
          `}

          <!-- Success display -->
          ${props.importSuccess ? html`
            <div style="
              margin-top:10px; padding:10px 14px; border-radius:8px;
              background:rgba(52,211,153,0.08); border:1px solid rgba(52,211,153,0.2);
              font-size:13px; color:#34d399; font-weight:500;
            ">\u2705 ${props.importSuccess}</div>
          ` : nothing}

          <!-- Error display (hidden during loading to avoid stale errors) -->
          ${!props.importLoading && props.importError ? html`
            <div style="
              margin-top:10px; padding:10px 14px; border-radius:8px;
              background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2);
              font-size:12px; color:#ef4444;
            ">${props.importError}</div>
          ` : nothing}
        </div>
      </div>
    </div>

    <style>
      .skill-import-dir:hover {
        background: var(--bg-accent, rgba(148,163,184,0.08)) !important;
      }
      @keyframes skillImportOverlayIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes skillImportModalIn {
        from { opacity: 0; transform: scale(0.92) translateY(12px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes skillImportSpin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
}

// ============================================================================
// Tab 2: Marketplace (search + grid + pagination) — unchanged
// ============================================================================

function renderMarketplace(props: SkillsProps) {
  const result = props.marketSearchResult;
  const items = result?.items ?? [];

  return html`
    <!-- ClawHub official link banner -->
    <div
      style="
        display:flex; align-items:center; gap:12px;
        padding:12px 18px; margin-bottom:16px;
        border:1px solid rgba(108,140,255,0.2);
        border-radius:var(--radius-md, 8px);
        background:linear-gradient(135deg, rgba(108,140,255,0.06) 0%, rgba(108,140,255,0.02) 100%);
        font-size:12px; color:var(--muted-strong, #6b7d91);
      "
    >
      <span style="font-size:16px; flex-shrink:0;">\u{1F310}</span>
      <span style="flex:1;">
        ${t("skills.market.clawhubBanner" as never)}
        <a
          href="https://clawhub.com"
          target="_blank"
          rel="noopener"
          style="color:var(--accent, #6c8cff); text-decoration:underline; font-weight:600;"
        >clawhub.com</a>
        <span style="opacity:0.4; margin:0 6px;">|</span>
        <span style="opacity:0.55;">
          ${t("skills.market.clawhubFallback" as never)}
        </span>
      </span>
    </div>

    <!-- Toolbar: search + categories + refresh -->
    <div
      style="display:flex; gap:12px; margin-bottom:16px; align-items:center; flex-wrap:wrap;"
    >
      <!-- Search box -->
      <div
        style="
          width:280px; flex-shrink:0;
          display:flex; align-items:center;
          padding:0 14px;
          border:1.5px solid var(--border);
          border-radius:var(--radius-md, 8px);
          background:var(--card);
          transition:border-color 150ms, box-shadow 150ms;
          height:38px;
        "
        class="skills-market-search-box"
      >
        <span
          style="font-size:13px; color:var(--muted-strong, #6b7d91); margin-right:8px;"
          >\u{1F50D}</span
        >
        <input
          type="text"
          @input=${(e: Event) => {
            const val = (e.target as HTMLInputElement).value;
            if (_skillSearchTimer) clearTimeout(_skillSearchTimer);
            _skillSearchTimer = setTimeout(() => props.onMarketSearch(val), 300);
          }}
          placeholder=${t("skills.search.placeholder" as never)}
          style="all:unset; flex:1; padding:8px 0; font-size:13px; color:var(--fg);"
        />
      </div>

      <!-- Category chips -->
      <div
        style="display:flex; gap:6px; flex-wrap:wrap; flex:1; align-items:center;"
      >
        ${SKILLS_CATEGORIES.map((cat) => {
          const isActive = props.marketCategory === cat.id;
          return html`
            <button
              @click=${() =>
                props.onMarketCategoryChange(
                  isActive && cat.id !== "all" ? "all" : cat.id,
                )}
              style="
                all:unset; cursor:pointer;
                padding:5px 14px;
                border-radius:var(--radius-full, 9999px);
                font-size:11px; white-space:nowrap;
                border:1px solid ${isActive ? "var(--accent, #6c8cff)" : "var(--border)"};
                background:${isActive ? "rgba(108,140,255,0.12)" : "rgba(148,163,184,0.04)"};
                color:${isActive ? "var(--accent, #6c8cff)" : "var(--muted-strong, #6b7d91)"};
                font-weight:${isActive ? "600" : "400"};
                transition:all 150ms;
                user-select:none;
              "
            >
              ${cat.emoji}
              ${cat.id === "all" ? t("skills.category.all" as never) : cat.id}
            </button>
          `;
        })}
      </div>

      <!-- Refresh button -->
      <button
        @click=${props.onMarketRefresh}
        ?disabled=${props.marketLoading}
        style="
          all:unset; cursor:pointer;
          padding:0 16px; height:38px;
          border:1.5px solid var(--border);
          border-radius:var(--radius-md, 8px);
          background:var(--card);
          color:var(--fg); font-size:12px; font-weight:500;
          flex-shrink:0;
          transition:border-color 150ms, background 150ms;
        "
      >
        ${props.marketLoading
          ? t("skills.market.syncing" as never)
          : t("common.refresh" as never)}
      </button>
    </div>

    <!-- Content -->
    ${!result
      ? (props.marketError
          ? renderMarketError(props.marketError)
          : renderMarketLoading())
      : items.length === 0
        ? renderMarketEmpty()
        : html`
            <div class="skills-market-grid" style="display:grid; gap:16px; margin-bottom:20px;">
              ${items.map((item) => renderSkillMarketCard(item, props))}
            </div>
            ${renderScrollSentinel(props)}
          `}

    <style>
      .skills-market-search-box:focus-within {
        border-color: var(--accent, #6c8cff) !important;
        box-shadow: 0 0 0 3px rgba(108, 140, 255, 0.1);
      }
      .skills-market-card:hover {
        border-color: var(--accent, #6c8cff) !important;
        box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.25)) !important;
        transform: translateY(-2px);
      }
      .skills-market-grid {
        grid-template-columns: repeat(4, 1fr);
      }
      @media (max-width: 1400px) {
        .skills-market-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (max-width: 1000px) {
        .skills-market-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 600px) {
        .skills-market-grid {
          grid-template-columns: 1fr;
        }
      }
      @keyframes skillsSpin {
        to {
          transform: rotate(360deg);
        }
      }
    </style>
  `;
}

// ============================================================================
// Marketplace card
// ============================================================================

type MarketItem = SkillsMarketSearchResult["items"][number];

function tierBg(tier: string): string {
  switch (tier) {
    case "S":
      return "rgba(52,211,153,0.12)";
    case "A":
      return "rgba(96,165,250,0.12)";
    case "B":
      return "rgba(251,191,36,0.12)";
    default:
      return "rgba(148,163,184,0.1)";
  }
}

function tierColor(tier: string): string {
  switch (tier) {
    case "S":
      return "#34d399";
    case "A":
      return "#60a5fa";
    case "B":
      return "#fbbf24";
    default:
      return "#94a3b8";
  }
}

function renderSkillMarketCard(item: MarketItem, props: SkillsProps) {
  const displayName = item.nameCn || item.name;
  const displayDesc = item.descriptionCn || item.description;
  const emoji = item.emoji || categoryEmoji(item.category);
  const isInstalled = item.installed === true;
  const installKey = item.skillId || item.name;
  const progress = props.installProgress[installKey];

  return html`
    <div
      style="
        background:var(--card);
        border:1px solid var(--border);
        border-top:2px solid ${item.tier === "S" ? "#34d399" : item.tier === "A" ? "#60a5fa" : item.tier === "B" ? "#fbbf24" : "var(--border)"};
        border-radius:var(--radius-lg, 12px);
        padding:20px;
        transition:box-shadow 200ms, border-color 200ms, transform 200ms;
        display:flex;
        flex-direction:column;
        box-shadow:var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.2));
      "
      class="skills-market-card"
    >
      <!-- Header: emoji + name + tier -->
      <div
        style="display:flex; align-items:flex-start; gap:14px; margin-bottom:12px;"
      >
        <div
          style="
            width:48px; height:48px;
            border-radius:var(--radius-md, 8px);
            background:${isInstalled
            ? "rgba(52,211,153,0.1)"
            : "rgba(108,140,255,0.08)"};
            display:flex; align-items:center; justify-content:center;
            font-size:22px; flex-shrink:0;
          "
        >
          ${emoji}
        </div>
        <div style="flex:1; min-width:0;">
          <div
            style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"
          >
            <span style="font-size:15px; font-weight:600; color:var(--fg);"
              >${displayName}</span
            >
            ${item.tier
              ? html`<span
                  style="
                    font-size:10px; padding:2px 8px; border-radius:4px;
                    background:${tierBg(item.tier)};
                    color:${tierColor(item.tier)};
                  "
                  >${item.tier}</span
                >`
              : nothing}
          </div>
          ${item.category
            ? html`<div
                style="font-size:11px; color:var(--muted-strong, #6b7d91); margin-top:3px;"
              >
                ${item.category}
              </div>`
            : nothing}
        </div>
      </div>

      <!-- Description (2-line clamp) -->
      <div
        style="
          font-size:13px; color:var(--fg-secondary, #a0aec0);
          line-height:1.6;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
          overflow:hidden; margin-bottom:10px; flex:1;
        "
      >
        ${clampText(displayDesc, 120)}
      </div>

      <!-- Tags (max 3) -->
      ${item.tags && item.tags.length > 0
        ? html`<div
            style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px;"
          >
            ${item.tags.slice(0, 3).map(
              (tag) => html`
                <span
                  style="
                    font-size:10px; padding:3px 10px; border-radius:6px;
                    background:rgba(148,163,184,0.08);
                    color:var(--muted-strong, #6b7d91);
                  "
                  >${tag}</span
                >
              `,
            )}
          </div>`
        : nothing}

      <!-- Install button -->
      <div
        style="display:flex; align-items:center; justify-content:flex-end; margin-top:auto;"
      >
        ${renderInstallButton(item, progress, props)}
      </div>
    </div>
  `;
}

function renderInstallButton(
  item: MarketItem,
  progress: InstallProgress | undefined,
  props: SkillsProps,
) {
  // 用 skillId 作为安装标识（proxy 下载 API 需要 skillId，不是 name）
  const installKey = item.skillId || item.name;
  if (item.installed) {
    return html`<span
      style="
        font-size:11px; font-weight:600; padding:5px 14px;
        border-radius:6px; background:rgba(52,211,153,0.1); color:#34d399;
      "
      >\u2713 ${t("skills.remote.alreadyInstalled" as never)}</span
    >`;
  }
  // availability-dict 来源的技能只有元数据，没有实际的 SKILL.md 文件
  // bundled 和 proxy 都不会有这些技能，安装必然失败，所以不显示安装按钮
  if (item.source === "availability-dict") {
    return html`<span
      style="
        font-size:10px; color:var(--muted-strong, #6b7d91); padding:5px 14px;
      "
      >${t("skills.market.notAvailable" as never)}</span
    >`;
  }
  if (item.cnBlocked) {
    return html`<div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
      <span style="font-size:10px; color:#f87171; line-height:1.3; text-align:right; max-width:220px;">
        ${t("skills.market.cnBlocked.reason" as never)}
      </span>
      ${item.cnAlternative
        ? html`<span style="font-size:10px; color:#f59e0b; line-height:1.3;">
            ${(t("skills.market.cnBlocked.alternative" as never) as string).replace(
              "{alternative}",
              item.cnAlternative,
            )}
          </span>`
        : nothing}
      <button
        @click=${() => props.onMarketInstall(installKey)}
        style="
          all:unset; cursor:pointer;
          font-size:10px; font-weight:600;
          padding:4px 12px; border-radius:6px;
          background:rgba(248,113,113,0.15); color:#f87171;
          border:1px solid rgba(248,113,113,0.3);
          transition:opacity 150ms;
        "
        title=${t("skills.market.cnBlocked.vpnHint" as never)}
      >
        ${t("skills.market.cnBlocked.installAnyway" as never)}
      </button>
    </div>`;
  }
  if (progress) {
    const isDone = progress.stage === "done";
    const isSuccess = isDone && (progress.percent ?? 0) >= 100;
    return html`<span
      style="
        font-size:11px; font-weight:600; padding:5px 14px;
        border-radius:6px;
        background:${isSuccess ? "rgba(52,211,153,0.1)" : isDone ? "rgba(248,113,113,0.1)" : "rgba(99,102,241,0.1)"};
        color:${isSuccess ? "#34d399" : isDone ? "#f87171" : "var(--accent, #6366f1)"};
        display:inline-flex; align-items:center; gap:6px;
      "
    >
      ${isDone
        ? html`<span style="font-size:12px;">${isSuccess ? "\u2713" : "\u2717"}</span>`
        : html`<span
            style="
              width:10px; height:10px;
              border:2px solid currentColor;
              border-top-color:transparent;
              border-radius:50%;
              animation:skillsSpin 0.8s linear infinite;
              display:inline-block;
            "
          ></span>`}
      ${progress.message || t("skills.installing" as never)}
    </span>`;
  }
  return html`<button
    @click=${() => props.onMarketInstall(installKey)}
    style="
      all:unset; cursor:pointer;
      font-size:11px; font-weight:600;
      padding:5px 14px; border-radius:6px;
      background:var(--accent, #6366f1); color:#fff;
      transition:opacity 150ms;
    "
  >
    ${t("skills.remote.install" as never)}
  </button>`;
}

// ============================================================================
// Infinite scroll sentinel (IntersectionObserver)
// ============================================================================

let _scrollObserver: IntersectionObserver | null = null;
let _latestLoadMore: (() => void) | null = null;
let _latestCanLoad = false;

function setupScrollObserver(props: SkillsProps) {
  // Update module-level refs so the observer callback always uses latest state
  _latestLoadMore = props.onMarketLoadMore;
  _latestCanLoad = props.hasMorePages && !props.marketLoading;

  // Defer to next frame so the sentinel element exists in the DOM
  requestAnimationFrame(() => {
    const sentinel = document.querySelector(".skills-scroll-sentinel");
    if (!sentinel) {
      if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }
      return;
    }

    if (!props.hasMorePages) {
      if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }
      return;
    }

    // Only create observer once; re-use across renders (callback reads module refs)
    if (!_scrollObserver) {
      _scrollObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && _latestCanLoad && _latestLoadMore) {
            _latestLoadMore();
          }
        },
        { rootMargin: "300px" },
      );
    }

    // Re-observe in case sentinel element changed (Lit may recreate DOM nodes)
    _scrollObserver.disconnect();
    _scrollObserver.observe(sentinel);
  });
}

function renderScrollSentinel(props: SkillsProps) {
  const result = props.marketSearchResult;
  const loaded = result?.items.length ?? 0;
  const total = result?.total ?? 0;

  // Schedule observer setup after this render
  setupScrollObserver(props);

  if (!props.hasMorePages) {
    return html`
      <div
        style="
          text-align:center; padding:20px 0; font-size:12px;
          color:var(--muted-strong, #6b7d91); opacity:0.7;
        "
      >
        ${t("skills.market.allLoaded" as never)} (${loaded}/${total})
      </div>
    `;
  }

  return html`
    <div
      style="
        display:flex; align-items:center; justify-content:center;
        padding:24px 0; gap:10px;
        color:var(--muted-strong, #6b7d91); font-size:12px;
      "
    >
      ${props.marketLoading
        ? html`
            <span
              style="
                width:16px; height:16px;
                border:2px solid var(--accent, #6c8cff);
                border-top-color:transparent; border-radius:50%;
                animation:skillsSpin 0.8s linear infinite;
                display:inline-block;
              "
            ></span>
            <span>${t("skills.market.loadingMore" as never)}</span>
          `
        : html`<span>${t("skills.market.scrollForMore" as never)}</span>`}
    </div>
    <div class="skills-scroll-sentinel" style="height:1px; width:100%;"></div>
  `;
}

// ============================================================================
// Loading / Error / Empty states
// ============================================================================

function renderMarketLoading() {
  return html`
    <div
      style="text-align:center; padding:60px 20px; color:var(--muted-strong, #6b7d91);"
    >
      <div
        style="
          width:24px; height:24px;
          border:3px solid var(--accent, #6c8cff);
          border-top-color:transparent; border-radius:50%;
          animation:skillsSpin 0.8s linear infinite;
          margin:0 auto 16px;
        "
      ></div>
      <div style="font-size:14px;">
        ${t("skills.market.loading" as never)}
      </div>
      <div style="font-size:12px; margin-top:6px; opacity:0.7;">
        ${t("skills.market.loadingHint" as never)}
      </div>
    </div>
  `;
}

function renderMarketError(error: string) {
  return html`
    <div
      style="text-align:center; padding:60px 20px; color:var(--muted-strong, #6b7d91);"
    >
      <div style="font-size:28px; margin-bottom:12px;">\u26A0\uFE0F</div>
      <div style="font-size:14px; font-weight:600;">
        ${t("skills.market.errorTitle" as never)}
      </div>
      <div
        style="font-size:12px; margin-top:8px; max-width:400px; margin-left:auto; margin-right:auto;"
      >
        ${error}
      </div>
      <div
        style="font-size:12px; margin-top:14px; max-width:440px; margin-left:auto; margin-right:auto; line-height:1.6;"
      >
        ${t("skills.market.errorClawhubHint" as never)}
        <a
          href="https://clawhub.com"
          target="_blank"
          rel="noopener"
          style="color:var(--accent, #6c8cff); text-decoration:underline; font-weight:600;"
        >clawhub.com</a>
      </div>
    </div>
  `;
}

function renderMarketEmpty() {
  return html`
    <div
      style="text-align:center; padding:60px 20px; color:var(--muted-strong, #6b7d91);"
    >
      <div style="font-size:28px; margin-bottom:12px;">\u{1F50D}</div>
      <div style="font-size:14px;">
        ${t("skills.noResults.title" as never)}
      </div>
      <div style="font-size:12px; margin-top:8px;">
        ${t("skills.market.emptyHint" as never)}
      </div>
      <div style="font-size:12px; margin-top:12px; line-height:1.6;">
        ${t("skills.market.emptyClawhubHint" as never)}
        <a
          href="https://clawhub.com"
          target="_blank"
          rel="noopener"
          style="color:var(--accent, #6c8cff); text-decoration:underline; font-weight:600;"
        >clawhub.com</a>
      </div>
    </div>
  `;
}
