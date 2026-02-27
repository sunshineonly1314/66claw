/**
 * Team Projects View
 *
 * Renders team project sidebar groups and project detail panels.
 * Pure render functions following the same pattern as agents.ts.
 */

import { html, nothing, type TemplateResult } from "lit";
import { t } from "../i18n/index.js";
import { icons } from "../icons.js";
import type {
  AgentsListResult,
  AgentIdentityResult,
  TeamProjectSummary,
  TeamProjectDetail,
  TeamProjectHealthResult,
  TeamProjectStatsResult,
  TeamSharedMemoryEntry,
  TeamMemberHealthState,
} from "../types.js";
import {
  normalizeAgentLabel,
  resolveAgentEmoji,
} from "./agents-utils.js";

// ── Types ───────────────────────────────────────────────────────────────

export type ProjectDetailTab = "members" | "stats" | "settings" | "memory";

export type ProjectSidebarProps = {
  projects: TeamProjectSummary[] | null;
  agents: AgentsListResult | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  selectedProjectId: string | null;
  selectedAgentId: string | null;
  defaultAgentId: string | null;
  collapsedProjects: Set<string>;
  onSelectProject: (projectId: string) => void;
  onSelectAgent: (agentId: string) => void;
  onToggleCollapse: (projectId: string) => void;
};

export type ProjectDetailProps = {
  detail: TeamProjectDetail | null;
  detailLoading: boolean;
  health: TeamProjectHealthResult | null;
  stats: TeamProjectStatsResult | null;
  memory: TeamSharedMemoryEntry[] | null;
  tab: ProjectDetailTab;
  busy: boolean;
  agentIdentityById: Record<string, AgentIdentityResult>;
  onSelectTab: (tab: ProjectDetailTab) => void;
  onPause: (projectId: string) => void;
  onResume: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onLoadStats: (projectId: string) => void;
  onLoadMemory: (projectId: string) => void;
  onClearMemory: (projectId: string) => void;
};

// ── Sidebar: Project Groups ─────────────────────────────────────────────

export function renderProjectSidebarGroups(props: ProjectSidebarProps): TemplateResult | typeof nothing {
  const projects = props.projects;
  const allAgents = props.agents?.agents ?? [];
  if (!projects || projects.length === 0) {
    // No projects — render all agents as standalone (handled by caller)
    return nothing;
  }

  // Build set of all agents that belong to at least one project
  const assignedAgentIds = new Set<string>();
  for (const p of projects) {
    for (const mid of p.memberIds) {
      assignedAgentIds.add(mid);
    }
  }

  // Standalone agents = not in any project
  const standaloneAgents = allAgents.filter((a) => !assignedAgentIds.has(a.id));

  return html`
    ${projects.map((project) => renderProjectGroup(project, props))}
    ${standaloneAgents.length > 0 ? html`
      <div class="standalone-divider">
        <span>${t("team.standalone")}</span>
      </div>
      ${standaloneAgents.map((agent) => {
        const badge = agent.id === props.defaultAgentId ? t("agents.default") : null;
        const emoji = resolveAgentEmoji(agent, props.agentIdentityById[agent.id] ?? null);
        return html`
          <button
            type="button"
            class="agent-row ${props.selectedAgentId === agent.id && !props.selectedProjectId ? "active" : ""}"
            @click=${() => props.onSelectAgent(agent.id)}
          >
            <div class="agent-avatar">${emoji || normalizeAgentLabel(agent).slice(0, 1)}</div>
            <div class="agent-info">
              <div class="agent-title">${normalizeAgentLabel(agent)}</div>
              <div class="agent-sub mono">${agent.id}</div>
            </div>
            ${badge ? html`<span class="agent-pill">${badge}</span>` : nothing}
          </button>
        `;
      })}
    ` : nothing}
  `;
}

function renderProjectGroup(project: TeamProjectSummary, props: ProjectSidebarProps): TemplateResult {
  const allAgents = props.agents?.agents ?? [];
  const memberAgents = allAgents.filter((a) => project.memberIds.includes(a.id));
  const isCollapsed = props.collapsedProjects.has(project.projectId);
  const isSelected = props.selectedProjectId === project.projectId;

  return html`
    <div class="project-group ${isSelected ? "project-group--selected" : ""}">
      <div
        class="project-group-header"
        role="button"
        tabindex="0"
        @click=${() => props.onSelectProject(project.projectId)}
        @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onSelectProject(project.projectId); } }}
      >
        <span class="project-status-dot project-status-dot--${project.status}"></span>
        <span class="project-group-icon">${icons.users}</span>
        <span class="project-group-name">${project.name}</span>
        <span class="project-group-count">${project.memberCount}</span>
        <button
          type="button"
          class="project-group-chevron ${isCollapsed ? "collapsed" : ""}"
          @click=${(e: Event) => { e.stopPropagation(); props.onToggleCollapse(project.projectId); }}
          aria-label="${t("team.members")}"
        >
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </div>
      <div class="project-group-agents ${isCollapsed ? "project-group-agents--collapsed" : ""}">
        ${memberAgents.map((agent) => {
          const isSupervisor = agent.id === project.supervisorId;
          const emoji = resolveAgentEmoji(agent, props.agentIdentityById[agent.id] ?? null);
          const isAgentSelected = props.selectedAgentId === agent.id && !props.selectedProjectId;
          return html`
            <button
              type="button"
              class="agent-row agent-row--nested ${isAgentSelected ? "active" : ""}"
              @click=${() => props.onSelectAgent(agent.id)}
            >
              <div class="agent-avatar agent-avatar--sm">${emoji || normalizeAgentLabel(agent).slice(0, 1)}</div>
              <div class="agent-info">
                <div class="agent-title">${normalizeAgentLabel(agent)}</div>
              </div>
              ${isSupervisor ? html`<span class="agent-pill">${t("team.supervisor")}</span>` : nothing}
            </button>
          `;
        })}
      </div>
    </div>
  `;
}

// ── Main Panel: Project Detail ──────────────────────────────────────────

export function renderProjectDetail(props: ProjectDetailProps): TemplateResult {
  if (props.detailLoading && !props.detail) {
    return html`<div class="card"><div class="muted">${t("agents.loading")}</div></div>`;
  }
  if (!props.detail) {
    return html`
      <div class="card">
        <div class="card-title">${t("team.detail.selectProject")}</div>
        <div class="card-sub">${t("team.detail.selectProjectHint")}</div>
      </div>
    `;
  }

  const project = props.detail.project;

  return html`
    ${renderProjectHeader(project, props)}
    ${renderProjectTabs(props.tab, props.onSelectTab)}
    ${props.tab === "members" ? renderProjectMembers(project, props) : nothing}
    ${props.tab === "stats" ? renderProjectStatsPanel(project, props) : nothing}
    ${props.tab === "settings" ? renderProjectSettings(project) : nothing}
    ${props.tab === "memory" ? renderProjectMemoryPanel(project, props) : nothing}
  `;
}

// ── Header ──────────────────────────────────────────────────────────────

function renderProjectHeader(
  project: TeamProjectDetail["project"],
  props: ProjectDetailProps,
): TemplateResult {
  const statusClass = project.status === "active" ? "ok" :
    project.status === "paused" ? "warn" :
    project.status === "error" ? "danger" : "";

  return html`
    <div class="card agent-header">
      <div class="agent-header-main">
        <div class="agent-avatar agent-avatar--lg">
          <span class="agent-avatar-icon">${icons.users}</span>
        </div>
        <div>
          <div class="card-title" style="margin-bottom: 4px;">${project.name}</div>
          <div class="card-sub">${project.description || "—"}</div>
        </div>
      </div>
      <div class="agent-header-meta">
        <span class="agent-pill ${statusClass}">${t(`team.status.${project.status}` as any)}</span>
        ${project.status === "active" ? html`
          <button class="btn btn--sm btn--outline" ?disabled=${props.busy} @click=${() => props.onPause(project.projectId)}>
            ${t("team.action.pause")}
          </button>
        ` : nothing}
        ${project.status === "paused" ? html`
          <button class="btn btn--sm" ?disabled=${props.busy} @click=${() => props.onResume(project.projectId)}>
            ${t("team.action.resume")}
          </button>
        ` : nothing}
        <button
          class="btn btn--sm btn--danger"
          ?disabled=${props.busy}
          @click=${() => {
            if (confirm(t("team.action.deleteConfirm").replace("{{name}}", project.name))) {
              props.onDelete(project.projectId);
            }
          }}
        >${t("team.action.delete")}</button>
      </div>
    </div>
  `;
}

// ── Tabs ────────────────────────────────────────────────────────────────

function renderProjectTabs(
  active: ProjectDetailTab,
  onSelect: (tab: ProjectDetailTab) => void,
): TemplateResult {
  const tabs: { id: ProjectDetailTab; label: string }[] = [
    { id: "members", label: t("team.members") },
    { id: "stats", label: t("team.stats") },
    { id: "settings", label: t("team.settings") },
    { id: "memory", label: t("team.memory") },
  ];

  return html`
    <div class="agent-tabs">
      ${tabs.map((tab) => html`
        <button
          type="button"
          class="agent-tab ${active === tab.id ? "active" : ""}"
          @click=${() => onSelect(tab.id)}
        >${tab.label}</button>
      `)}
    </div>
  `;
}

// ── Members (Health) Panel ──────────────────────────────────────────────

function renderProjectMembers(
  project: TeamProjectDetail["project"],
  props: ProjectDetailProps,
): TemplateResult {
  const health = props.health;
  const members = project.members;

  return html`
    <div class="card">
      <div class="card-title" style="margin-bottom: 12px;">${t("team.members")} (${members.length})</div>
      <div class="project-member-table">
        <div class="project-member-header">
          <span></span>
          <span>${t("team.members")}</span>
          <span>${t("team.detail.status")}</span>
          <span>${t("team.detail.successes")}</span>
          <span>${t("team.detail.failures")}</span>
          <span>${t("team.detail.lastError")}</span>
        </div>
        ${members.map((m) => {
          const h = health?.members.find((hm) => hm.agentId === m.id);
          const state: TeamMemberHealthState = h?.state ?? "healthy";
          const identity = props.agentIdentityById[m.id];
          const emoji = m.emoji || identity?.emoji || "";

          return html`
            <div class="project-member-row">
              <div class="agent-avatar agent-avatar--sm">${emoji || m.name.slice(0, 1)}</div>
              <div class="project-member-name">
                <div class="agent-title">${m.name}</div>
                <div class="agent-sub mono">${m.role}${m.id === project.supervisorId ? ` (${t("team.supervisor")})` : ""}</div>
              </div>
              <span class="project-health-badge project-health-badge--${state}">
                <span class="project-status-dot project-status-dot--${state === "healthy" ? "active" : state === "degraded" ? "paused" : "error"}"></span>
                ${t(`team.health.${state}` as any)}
              </span>
              <span class="mono">${h?.totalSuccesses ?? 0}</span>
              <span class="mono" style="${(h?.totalFailures ?? 0) > 0 ? "color: var(--danger);" : ""}">${h?.totalFailures ?? 0}</span>
              <span class="agent-sub" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${h?.lastError ?? ""}">${h?.lastError ?? "—"}</span>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// ── Stats Panel ─────────────────────────────────────────────────────────

function renderProjectStatsPanel(
  project: TeamProjectDetail["project"],
  props: ProjectDetailProps,
): TemplateResult {
  const stats = props.stats;

  if (!stats) {
    return html`<div class="card"><div class="muted">${t("agents.loading")}</div></div>`;
  }

  const maxCalls = Math.max(...stats.members.map((m) => m.callCount), 1);

  return html`
    <div class="card">
      <div class="agents-overview-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 16px;">
        <div class="agent-kv">
          <div class="label">${t("team.detail.totalCalls")}</div>
          <div>${stats.totalCalls}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("team.detail.avgDuration")}</div>
          <div>${stats.avgDurationMs}ms</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("team.members")}</div>
          <div>${stats.members.length}</div>
        </div>
      </div>
      <div class="card-title" style="margin-bottom: 12px;">${t("team.detail.callCount")}</div>
      ${stats.members.map((m) => {
        const member = project.members.find((pm) => pm.id === m.agentId);
        const pct = maxCalls > 0 ? Math.round((m.callCount / maxCalls) * 100) : 0;
        return html`
          <div class="project-stat-row">
            <span class="project-stat-label">${member?.name ?? m.agentId}</span>
            <div class="project-stat-bar-bg">
              <div class="project-stat-bar" style="width: ${pct}%;"></div>
            </div>
            <span class="project-stat-value mono">${m.callCount}</span>
            <span class="agent-sub">${m.avgDurationMs}ms avg</span>
          </div>
        `;
      })}
    </div>
  `;
}

// ── Settings Panel ──────────────────────────────────────────────────────

function renderProjectSettings(project: TeamProjectDetail["project"]): TemplateResult {
  return html`
    <div class="card">
      <div class="agents-overview-grid" style="grid-template-columns: repeat(2, 1fr);">
        <div class="agent-kv">
          <div class="label">${t("team.detail.description")}</div>
          <div>${project.description || "—"}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("team.detail.visibility")}</div>
          <div>${project.visibility.mode}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("team.detail.hopLimit")}</div>
          <div>${project.coordination.hopLimit}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("team.detail.memberTimeout")}</div>
          <div>${project.coordination.memberTimeoutSeconds}s</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("team.detail.supervisorFallback")}</div>
          <div>${project.coordination.supervisorFallbackEnabled ? t("agents.yes") : t("agents.no")}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("team.detail.memoryMode")}</div>
          <div>${project.memory.mode}</div>
        </div>
      </div>
    </div>
  `;
}

// ── Memory Panel ────────────────────────────────────────────────────────

function renderProjectMemoryPanel(
  project: TeamProjectDetail["project"],
  props: ProjectDetailProps,
): TemplateResult {
  const memory = props.memory;

  if (memory === null) {
    return html`<div class="card"><div class="muted">${t("agents.loading")}</div></div>`;
  }

  if (memory.length === 0) {
    return html`
      <div class="card">
        <div class="muted">${t("team.detail.noMemory")}</div>
      </div>
    `;
  }

  return html`
    <div class="card">
      <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
        <div class="card-title">${t("team.memory")} (${memory.length})</div>
        <button
          class="btn btn--sm btn--danger"
          ?disabled=${props.busy}
          @click=${() => props.onClearMemory(project.projectId)}
        >${t("team.detail.clearMemory")}</button>
      </div>
      <div class="project-memory-list">
        ${memory.map((entry) => html`
          <div class="project-memory-entry">
            <div class="project-memory-key mono">${entry.key}</div>
            <div class="project-memory-value">${entry.value}</div>
            ${entry.agentId ? html`<div class="agent-sub">by ${entry.agentId}</div>` : nothing}
          </div>
        `)}
      </div>
    </div>
  `;
}
