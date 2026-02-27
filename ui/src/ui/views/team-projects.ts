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
  /** Delete all agents in an orphan orchestration group. */
  onDeleteOrchGroup?: (agentIds: string[]) => void;
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
  /** All available agents for "add member" picker */
  allAgents?: AgentsListResult | null;
  onSelectTab: (tab: ProjectDetailTab) => void;
  onPause: (projectId: string) => void;
  onResume: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onLoadStats: (projectId: string) => void;
  onLoadMemory: (projectId: string) => void;
  onClearMemory: (projectId: string) => void;
  onUpdateSettings?: (projectId: string, updates: Record<string, unknown>) => void;
  onRemoveMember?: (projectId: string, agentId: string) => void;
  onSelectAgent?: (agentId: string) => void;
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

  // Further split standalone agents: group orchestrator agents by orch prefix,
  // truly standalone agents are those without an orch- prefix.
  const orchGroups = new Map<string, typeof standaloneAgents>();
  const trulyStandalone: typeof standaloneAgents = [];
  for (const agent of standaloneAgents) {
    const orchMatch = /^(orch-[^-]+-[^-]+)--/.exec(agent.id);
    if (orchMatch) {
      const orchId = orchMatch[1];
      let group = orchGroups.get(orchId);
      if (!group) { group = []; orchGroups.set(orchId, group); }
      group.push(agent);
    } else {
      trulyStandalone.push(agent);
    }
  }

  return html`
    ${projects.map((project) => renderProjectGroup(project, props))}
    ${orchGroups.size > 0 ? [...orchGroups.entries()].map(([orchId, agents]) => html`
      <div class="orch-group">
        <div class="orch-group-header">
          <span class="project-status-dot project-status-dot--warn"></span>
          <span class="orch-group-name">${t("team.orchGroup")}</span>
          <span class="project-group-count">${agents.length}</span>
          ${props.onDeleteOrchGroup ? html`
            <button
              type="button"
              class="orch-group-delete"
              title="${t("team.orchGroupDelete")}"
              @click=${(e: Event) => {
                e.stopPropagation();
                const ids = agents.map(a => a.id);
                if (confirm(t("team.orchGroupDeleteConfirm", { count: ids.length }))) {
                  props.onDeleteOrchGroup!(ids);
                }
              }}
            >
              <svg viewBox="0 0 24 24" width="12" height="12"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            </button>
          ` : nothing}
        </div>
        <div class="project-group-agents">
          ${agents.map((agent) => {
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
              </button>
            `;
          })}
        </div>
      </div>
    `) : nothing}
    ${trulyStandalone.length > 0 ? html`
      <div class="standalone-divider">
        <span>${t("team.standalone")}</span>
      </div>
      ${trulyStandalone.map((agent) => {
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
    ${props.tab === "settings" ? renderProjectSettings(project, props) : nothing}
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

// ── Members (Enhanced) Panel ───────────────────────────────────────────

function renderProjectMembers(
  project: TeamProjectDetail["project"],
  props: ProjectDetailProps,
): TemplateResult {
  const health = props.health;
  const members = project.members;

  return html`
    <div class="card">
      <div class="card-title" style="margin-bottom: 12px;">${t("team.members")} (${members.length})</div>
      <div class="project-members-cards">
        ${members.map((m) => {
          const h = health?.members.find((hm) => hm.agentId === m.id);
          const state: TeamMemberHealthState = h?.state ?? "healthy";
          const identity = props.agentIdentityById[m.id];
          const emoji = m.emoji || identity?.emoji || "";
          const isSupervisor = m.id === project.supervisorId;
          const toolProfile = m.toolProfile ?? "";
          const modelTier = m.modelTier ?? "";
          const keywords = m.keywords ?? [];

          return html`
            <div class="project-member-card">
              <div class="project-member-card-header">
                <div class="agent-avatar agent-avatar--sm">${emoji || m.name.slice(0, 1)}</div>
                <div class="project-member-card-info">
                  <div class="agent-title">
                    ${m.name}
                    ${isSupervisor ? html`<span class="agent-pill ok" style="margin-left: 6px; font-size: 10px;">Supervisor</span>` : nothing}
                  </div>
                  <div class="agent-sub">${m.role}</div>
                </div>
                <span class="project-health-badge project-health-badge--${state}">
                  <span class="project-status-dot project-status-dot--${state === "healthy" ? "active" : state === "degraded" ? "paused" : "error"}"></span>
                  ${t(`team.health.${state}` as any)}
                </span>
              </div>
              <div class="project-member-card-meta">
                ${modelTier ? html`<span class="agent-pill" title="${t("team.detail.modelTier")}">${modelTier}</span>` : nothing}
                ${toolProfile ? html`<span class="agent-pill" title="${t("team.detail.toolProfile")}">${toolProfile}</span>` : nothing}
                ${(h?.totalSuccesses ?? 0) > 0 || (h?.totalFailures ?? 0) > 0 ? html`
                  <span class="mono" style="font-size: 11px; color: var(--muted);">
                    ${h?.totalSuccesses ?? 0}/${(h?.totalSuccesses ?? 0) + (h?.totalFailures ?? 0)}
                  </span>
                ` : nothing}
              </div>
              ${keywords.length > 0 ? html`
                <div class="project-member-card-keywords">
                  ${keywords.slice(0, 6).map((kw) => html`<span class="keyword-chip">${kw}</span>`)}
                  ${keywords.length > 6 ? html`<span class="keyword-chip">+${keywords.length - 6}</span>` : nothing}
                </div>
              ` : nothing}
              ${h?.lastError ? html`
                <div class="agent-sub" style="margin-top: 4px; color: var(--danger); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${h.lastError}">${h.lastError}</div>
              ` : nothing}
              <div class="project-member-card-actions">
                ${props.onSelectAgent ? html`
                  <button class="btn btn--xs btn--outline" @click=${() => props.onSelectAgent!(m.id)}>${t("team.action.chat")}</button>
                ` : nothing}
                ${!isSupervisor && props.onRemoveMember ? html`
                  <button
                    class="btn btn--xs btn--danger"
                    ?disabled=${props.busy}
                    @click=${() => {
                      if (confirm(t("team.action.removeMemberConfirm").replace("{{name}}", m.name))) {
                        props.onRemoveMember!(project.projectId, m.id);
                      }
                    }}
                  >${t("team.action.remove")}</button>
                ` : nothing}
              </div>
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

// ── Settings Panel (Editable) ──────────────────────────────────────────

function renderProjectSettings(
  project: TeamProjectDetail["project"],
  props: ProjectDetailProps,
): TemplateResult {
  const bindings = project.bindings ?? [];
  const canEdit = !!props.onUpdateSettings;

  const handleSave = (field: string, value: unknown) => {
    if (!props.onUpdateSettings) return;
    // Backend expects nested objects for coordination/visibility fields
    const coordFields = ["supervisorStyle", "hopLimit", "memberTimeoutSeconds", "supervisorFallbackEnabled", "handoffStyle"];
    if (coordFields.includes(field)) {
      props.onUpdateSettings(project.projectId, { coordination: { [field]: value } });
    } else if (field === "visibilityMode") {
      props.onUpdateSettings(project.projectId, { visibility: { mode: value } });
    } else {
      props.onUpdateSettings(project.projectId, { [field]: value });
    }
  };

  return html`
    <div class="card">
      <div class="project-settings-grid">
        <!-- Supervisor -->
        <div class="project-settings-row">
          <label class="project-settings-label">${t("team.supervisor")}</label>
          <div class="project-settings-value">
            ${canEdit ? html`
              <select
                class="input input--sm"
                .value=${project.supervisorId}
                @change=${(e: Event) => handleSave("supervisorId", (e.target as HTMLSelectElement).value)}
                ?disabled=${props.busy}
              >
                ${project.members.map((m) => html`
                  <option value="${m.id}" ?selected=${m.id === project.supervisorId}>${m.name}</option>
                `)}
              </select>
            ` : html`<span>${project.members.find((m) => m.id === project.supervisorId)?.name ?? project.supervisorId}</span>`}
          </div>
        </div>

        <!-- Visibility -->
        <div class="project-settings-row">
          <label class="project-settings-label">${t("team.detail.visibility")}</label>
          <div class="project-settings-value">
            ${canEdit ? html`
              <select
                class="input input--sm"
                .value=${project.visibility.mode}
                @change=${(e: Event) => handleSave("visibilityMode", (e.target as HTMLSelectElement).value)}
                ?disabled=${props.busy}
              >
                <option value="unified" ?selected=${project.visibility.mode === "unified"}>unified</option>
                <option value="team" ?selected=${project.visibility.mode === "team"}>team</option>
                <option value="transparent" ?selected=${project.visibility.mode === "transparent"}>transparent</option>
              </select>
            ` : html`<span>${project.visibility.mode}</span>`}
          </div>
        </div>

        <!-- Coordination Style -->
        <div class="project-settings-row">
          <label class="project-settings-label">${t("team.detail.coordinationStyle")}</label>
          <div class="project-settings-value">
            ${canEdit ? html`
              <select
                class="input input--sm"
                .value=${project.coordination.supervisorStyle}
                @change=${(e: Event) => handleSave("supervisorStyle", (e.target as HTMLSelectElement).value)}
                ?disabled=${props.busy}
              >
                <option value="concierge" ?selected=${project.coordination.supervisorStyle === "concierge"}>concierge</option>
                <option value="delegate-only" ?selected=${project.coordination.supervisorStyle === "delegate-only"}>delegate-only</option>
              </select>
            ` : html`<span>${project.coordination.supervisorStyle}</span>`}
          </div>
        </div>

        <!-- Hop Limit -->
        <div class="project-settings-row">
          <label class="project-settings-label">${t("team.detail.hopLimit")}</label>
          <div class="project-settings-value">
            ${canEdit ? html`
              <input
                type="number"
                class="input input--sm"
                style="width: 80px;"
                .value=${String(project.coordination.hopLimit)}
                min="1" max="20"
                @change=${(e: Event) => handleSave("hopLimit", Number((e.target as HTMLInputElement).value))}
                ?disabled=${props.busy}
              />
            ` : html`<span>${project.coordination.hopLimit}</span>`}
          </div>
        </div>

        <!-- Member Timeout -->
        <div class="project-settings-row">
          <label class="project-settings-label">${t("team.detail.memberTimeout")}</label>
          <div class="project-settings-value">
            ${canEdit ? html`
              <input
                type="number"
                class="input input--sm"
                style="width: 80px;"
                .value=${String(project.coordination.memberTimeoutSeconds)}
                min="5" max="300"
                @change=${(e: Event) => handleSave("memberTimeoutSeconds", Number((e.target as HTMLInputElement).value))}
                ?disabled=${props.busy}
              /><span class="agent-sub" style="margin-left: 4px;">s</span>
            ` : html`<span>${project.coordination.memberTimeoutSeconds}s</span>`}
          </div>
        </div>

        <!-- Supervisor Fallback -->
        <div class="project-settings-row">
          <label class="project-settings-label">${t("team.detail.supervisorFallback")}</label>
          <div class="project-settings-value">
            ${canEdit ? html`
              <label class="toggle-label">
                <input
                  type="checkbox"
                  .checked=${project.coordination.supervisorFallbackEnabled}
                  @change=${(e: Event) => handleSave("supervisorFallbackEnabled", (e.target as HTMLInputElement).checked)}
                  ?disabled=${props.busy}
                />
                <span>${project.coordination.supervisorFallbackEnabled ? t("agents.yes") : t("agents.no")}</span>
              </label>
            ` : html`<span>${project.coordination.supervisorFallbackEnabled ? t("agents.yes") : t("agents.no")}</span>`}
          </div>
        </div>

        <!-- Memory Mode -->
        <div class="project-settings-row">
          <label class="project-settings-label">${t("team.detail.memoryMode")}</label>
          <div class="project-settings-value">
            ${canEdit ? html`
              <select
                class="input input--sm"
                .value=${project.memory.mode}
                @change=${(e: Event) => handleSave("memoryMode", (e.target as HTMLSelectElement).value)}
                ?disabled=${props.busy}
              >
                <option value="isolated" ?selected=${project.memory.mode === "isolated"}>isolated</option>
                <option value="read-shared" ?selected=${project.memory.mode === "read-shared"}>read-shared</option>
              </select>
            ` : html`<span>${project.memory.mode}</span>`}
          </div>
        </div>

        <!-- Handoff Style -->
        <div class="project-settings-row">
          <label class="project-settings-label">${t("team.detail.handoffStyle")}</label>
          <div class="project-settings-value">
            ${canEdit ? html`
              <select
                class="input input--sm"
                .value=${project.coordination.handoffStyle ?? "notify"}
                @change=${(e: Event) => handleSave("handoffStyle", (e.target as HTMLSelectElement).value)}
                ?disabled=${props.busy}
              >
                <option value="silent" ?selected=${project.coordination.handoffStyle === "silent"}>silent</option>
                <option value="notify" ?selected=${project.coordination.handoffStyle === "notify" || !project.coordination.handoffStyle}>notify</option>
                <option value="introduce" ?selected=${project.coordination.handoffStyle === "introduce"}>introduce</option>
              </select>
            ` : html`<span>${project.coordination.handoffStyle ?? "notify"}</span>`}
          </div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top: 12px;">
      <div class="card-title" style="margin-bottom: 12px;">${t("team.detail.boundChannels")}</div>
      ${bindings.length > 0
        ? html`
          <div class="project-binding-chips">
            ${bindings.map(
              (b) => html`
                <span class="agent-pill">
                  ${b.channel}${b.accountId ? ` (${b.accountId})` : ""}
                </span>
              `,
            )}
          </div>
        `
        : html`
          <div class="muted">${t("team.detail.noBindings")}</div>
        `}
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
