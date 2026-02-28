import { html, nothing, type TemplateResult } from "lit";
import { t } from "../i18n/index.js";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
  SkillStatusReport,
  TeamProjectSummary,
  TeamProjectDetail,
  TeamProjectHealthResult,
  TeamProjectStatsResult,
  TeamSharedMemoryEntry,
  TeamActivityEvent,
} from "../types.ts";
import {
  renderAgentFiles,
  renderAgentChannels,
  renderAgentCron,
} from "./agents-panels-status-files.ts";
import { renderAgentTools, renderAgentSkills } from "./agents-panels-tools-skills.ts";
import {
  agentBadgeText,
  buildAgentContext,
  buildModelOptions,
  normalizeAgentLabel,
  normalizeModelValue,
  parseFallbackList,
  resolveAgentConfig,
  resolveAgentEmoji,
  resolveModelFallbacks,
  resolveModelLabel,
  resolveModelPrimary,
} from "./agents-utils.ts";
import {
  renderProjectSidebarGroups,
  renderProjectDetail,
  type ProjectDetailTab,
} from "./team-projects.ts";
import { renderAgentChatPanel, type AgentChatPanelProps } from "./agent-chat-panel.ts";

export type AgentsPanel = "overview" | "files" | "tools" | "skills" | "channels" | "cron" | "chat";

export type AgentsProps = {
  loading: boolean;
  error: string | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  activePanel: AgentsPanel;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  channelsLoading: boolean;
  channelsError: string | null;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsLastSuccess: number | null;
  cronLoading: boolean;
  cronStatus: CronStatus | null;
  cronJobs: CronJob[];
  cronError: string | null;
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFilesList: AgentsFilesListResult | null;
  agentFileActive: string | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileSaving: boolean;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentSkillsLoading: boolean;
  agentSkillsReport: SkillStatusReport | null;
  agentSkillsError: string | null;
  agentSkillsAgentId: string | null;
  skillsFilter: string;
  agentCreating: boolean;
  agentCreateError: string | null;
  agentDeleting: boolean;
  agentDeleteError: string | null;
  onRefresh: () => void;
  onSelectAgent: (agentId: string) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
  onToolsProfileChange: (agentId: string, profile: string | null, clearAllow: boolean) => void;
  onToolsOverridesChange: (agentId: string, alsoAllow: string[], deny: string[]) => void;
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
  onChannelsRefresh: () => void;
  onCronRefresh: () => void;
  onSkillsFilterChange: (next: string) => void;
  onSkillsRefresh: () => void;
  onAgentSkillToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  onAgentSkillsClear: (agentId: string) => void;
  onAgentSkillsDisableAll: (agentId: string) => void;
  addFormOpen: boolean;
  onToggleAddForm: (open: boolean) => void;
  onCreateAgent: (id: string, name: string, workspace: string) => Promise<boolean>;
  onDeleteAgent: (agentId: string) => Promise<void>;
  onStartChat: (agentId: string) => void;
  // Embedded agent chat
  agentChatProps: Omit<AgentChatPanelProps, "agentId" | "agentName" | "agentEmoji"> | null;
  // dmScope auto-detection status
  dmScopeStatus?: {
    recommended: string;
    current: string;
    isExplicit: boolean;
    shouldUpgrade: boolean;
    reason: string;
    configuredChannelCount: number;
    totalAccounts: number;
    multiUserChannels: string[];
  } | null;
  onDmScopeApply?: () => void;
  // OpenClawCN: Orchestrator (智能组队) entry
  orchestratorEntryHtml?: TemplateResult | typeof nothing;
  orchestratorHtml?: TemplateResult | typeof nothing;
  // Team Projects
  teamProjects: TeamProjectSummary[] | null;
  teamProjectSelectedId: string | null;
  teamProjectDetail: TeamProjectDetail | null;
  teamProjectDetailLoading: boolean;
  teamProjectHealth: TeamProjectHealthResult | null;
  teamProjectStats: TeamProjectStatsResult | null;
  teamProjectMemory: TeamSharedMemoryEntry[] | null;
  teamProjectActivity: TeamActivityEvent[] | null;
  teamProjectTab: ProjectDetailTab;
  teamProjectBusy: boolean;
  teamCollapsedProjects: Set<string>;
  onSelectProject: (projectId: string) => void;
  onSelectProjectTab: (tab: ProjectDetailTab) => void;
  onPauseProject: (projectId: string) => void;
  onResumeProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onLoadProjectStats: (projectId: string) => void;
  onLoadProjectMemory: (projectId: string) => void;
  onLoadProjectActivity: (projectId: string) => void;
  onClearProjectMemory: (projectId: string) => void;
  onToggleProjectCollapse: (projectId: string) => void;
  onDeleteOrchGroup?: (agentIds: string[]) => void;
  // Team project detail: settings + member management
  onUpdateProjectSettings?: (projectId: string, updates: Record<string, unknown>) => void;
  onRemoveProjectMember?: (projectId: string, agentId: string) => void;
  onSelectAgentFromProject?: (agentId: string) => void;
  // Overview: inline identity update
  onIdentityUpdate?: (agentId: string, name: string, emoji: string) => Promise<boolean>;
  // Overview: inline SOUL.md load/save
  onSoulLoad?: (agentId: string) => Promise<string>;
  onSoulSave?: (agentId: string, content: string) => Promise<boolean>;
  // Force UI re-render (for module-scoped state)
  requestUpdate?: () => void;
};

export type AgentContext = {
  workspace: string;
  model: string;
  identityName: string;
  identityEmoji: string;
  skillsLabel: string;
  isDefault: boolean;
};

/* ── Add-agent form field values (module-scoped, non-reactive) ── */
const addFormFields = { id: "", name: "", workspace: "" };

/* ── Overview identity editing state ── */
const overviewIdentity = { name: "", emoji: "", dirty: false, agentId: "" };

/* ── Overview SOUL.md editing state ── */
const overviewSoul = { content: "", draft: "", loaded: false, dirty: false, agentId: "" };

/* ── Advanced section collapse state ── */
let overviewAdvancedOpen = false;

export function renderAgents(props: AgentsProps) {
  const agents = props.agentsList?.agents ?? [];
  const defaultId = props.agentsList?.defaultId ?? null;
  const selectedId = props.selectedAgentId ?? defaultId ?? agents[0]?.id ?? null;
  const selectedAgent = selectedId
    ? (agents.find((agent) => agent.id === selectedId) ?? null)
    : null;
  const isOnlyDefault = agents.length <= 1;

  return html`
    <div class="agents-wrapper">
    ${props.orchestratorHtml && props.orchestratorHtml !== nothing ? html`<div class="orch-overlay">${props.orchestratorHtml}</div>` : nothing}
    <div class="agents-layout">
      <section class="agents-sidebar">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">${t("agents.title")} <span style="color:#e53935;font-size:12px;font-weight:normal;margin-left:6px;">试运行</span></div>
            <div class="card-sub">${agents.length} ${t("agents.configured")}</div>
          </div>
          <button class="btn btn--sm" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? t("agents.loading") : t("overview.refresh")}
          </button>
        </div>
        ${
          props.error
            ? html`<div class="callout danger">${props.error}</div>`
            : nothing
        }
        ${props.orchestratorEntryHtml ?? nothing}
        <div class="agent-list">
          ${
            agents.length === 0
              ? html`<div class="muted">${t("agents.noAgents")}</div>`
              : hasTeamProjects(props.teamProjects)
                ? renderProjectSidebarGroups({
                    projects: props.teamProjects,
                    agents: props.agentsList,
                    agentIdentityById: props.agentIdentityById,
                    selectedProjectId: props.teamProjectSelectedId,
                    selectedAgentId: selectedId,
                    defaultAgentId: defaultId,
                    collapsedProjects: props.teamCollapsedProjects,
                    onSelectProject: props.onSelectProject,
                    onSelectAgent: props.onSelectAgent,
                    onToggleCollapse: props.onToggleProjectCollapse,
                    onDeleteOrchGroup: props.onDeleteOrchGroup,
                  })
                : agents.map((agent) => {
                    const badge = agentBadgeText(agent.id, defaultId);
                    const emoji = resolveAgentEmoji(agent, props.agentIdentityById[agent.id] ?? null);
                    return html`
                      <button
                        type="button"
                        class="agent-row ${selectedId === agent.id ? "active" : ""}"
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
                  })
          }
        </div>
        ${renderAddAgentForm(props)}
      </section>
      <section class="agents-main">
        ${isOnlyDefault && !hasTeamProjects(props.teamProjects) ? renderMultiAgentGuide() : nothing}
        ${
          props.teamProjectSelectedId
            ? renderProjectDetail({
                detail: props.teamProjectDetail,
                detailLoading: props.teamProjectDetailLoading,
                health: props.teamProjectHealth,
                stats: props.teamProjectStats,
                memory: props.teamProjectMemory,
                activity: props.teamProjectActivity,
                tab: props.teamProjectTab,
                busy: props.teamProjectBusy,
                agentIdentityById: props.agentIdentityById,
                allAgents: props.agentsList,
                onSelectTab: props.onSelectProjectTab,
                onPause: props.onPauseProject,
                onResume: props.onResumeProject,
                onDelete: props.onDeleteProject,
                onLoadStats: props.onLoadProjectStats,
                onLoadMemory: props.onLoadProjectMemory,
                onLoadActivity: props.onLoadProjectActivity,
                onClearMemory: props.onClearProjectMemory,
                onUpdateSettings: props.onUpdateProjectSettings,
                onRemoveMember: props.onRemoveProjectMember,
                onSelectAgent: props.onSelectAgentFromProject,
              })
          : !selectedAgent
            ? html`
                <div class="card">
                  <div class="card-title">${t("agents.selectAgent")}</div>
                  <div class="card-sub">${t("agents.selectAgentHint")}</div>
                </div>
              `
            : html`
                ${renderAgentHeader(
                  selectedAgent,
                  defaultId,
                  props.agentIdentityById[selectedAgent.id] ?? null,
                  props,
                )}
                ${renderAgentTabs(props.activePanel, (panel) => props.onSelectPanel(panel))}
                ${
                  props.activePanel === "overview"
                    ? renderAgentOverview({
                        agent: selectedAgent,
                        defaultId,
                        configForm: props.configForm,
                        agentFilesList: props.agentFilesList,
                        agentIdentity: props.agentIdentityById[selectedAgent.id] ?? null,
                        agentIdentityError: props.agentIdentityError,
                        agentIdentityLoading: props.agentIdentityLoading,
                        configLoading: props.configLoading,
                        configSaving: props.configSaving,
                        configDirty: props.configDirty,
                        onConfigReload: props.onConfigReload,
                        onConfigSave: props.onConfigSave,
                        onModelChange: props.onModelChange,
                        onModelFallbacksChange: props.onModelFallbacksChange,
                        dmScopeStatus: props.dmScopeStatus ?? null,
                        onIdentityUpdate: props.onIdentityUpdate,
                        onSoulLoad: props.onSoulLoad,
                        onSoulSave: props.onSoulSave,
                        requestUpdate: props.requestUpdate ?? (() => {}),
                      })
                    : nothing
                }
                ${
                  props.activePanel === "files"
                    ? renderAgentFiles({
                        agentId: selectedAgent.id,
                        agentFilesList: props.agentFilesList,
                        agentFilesLoading: props.agentFilesLoading,
                        agentFilesError: props.agentFilesError,
                        agentFileActive: props.agentFileActive,
                        agentFileContents: props.agentFileContents,
                        agentFileDrafts: props.agentFileDrafts,
                        agentFileSaving: props.agentFileSaving,
                        onLoadFiles: props.onLoadFiles,
                        onSelectFile: props.onSelectFile,
                        onFileDraftChange: props.onFileDraftChange,
                        onFileReset: props.onFileReset,
                        onFileSave: props.onFileSave,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "tools"
                    ? renderAgentTools({
                        agentId: selectedAgent.id,
                        configForm: props.configForm,
                        configLoading: props.configLoading,
                        configSaving: props.configSaving,
                        configDirty: props.configDirty,
                        onProfileChange: props.onToolsProfileChange,
                        onOverridesChange: props.onToolsOverridesChange,
                        onConfigReload: props.onConfigReload,
                        onConfigSave: props.onConfigSave,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "skills"
                    ? renderAgentSkills({
                        agentId: selectedAgent.id,
                        report: props.agentSkillsReport,
                        loading: props.agentSkillsLoading,
                        error: props.agentSkillsError,
                        activeAgentId: props.agentSkillsAgentId,
                        configForm: props.configForm,
                        configLoading: props.configLoading,
                        configSaving: props.configSaving,
                        configDirty: props.configDirty,
                        filter: props.skillsFilter,
                        onFilterChange: props.onSkillsFilterChange,
                        onRefresh: props.onSkillsRefresh,
                        onToggle: props.onAgentSkillToggle,
                        onClear: props.onAgentSkillsClear,
                        onDisableAll: props.onAgentSkillsDisableAll,
                        onConfigReload: props.onConfigReload,
                        onConfigSave: props.onConfigSave,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "channels"
                    ? renderAgentChannels({
                        context: buildAgentContext(
                          selectedAgent,
                          props.configForm,
                          props.agentFilesList,
                          defaultId,
                          props.agentIdentityById[selectedAgent.id] ?? null,
                        ),
                        configForm: props.configForm,
                        snapshot: props.channelsSnapshot,
                        loading: props.channelsLoading,
                        error: props.channelsError,
                        lastSuccess: props.channelsLastSuccess,
                        onRefresh: props.onChannelsRefresh,
                        dmScopeStatus: props.dmScopeStatus ?? null,
                        onDmScopeApply: props.onDmScopeApply,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "cron"
                    ? renderAgentCron({
                        context: buildAgentContext(
                          selectedAgent,
                          props.configForm,
                          props.agentFilesList,
                          defaultId,
                          props.agentIdentityById[selectedAgent.id] ?? null,
                        ),
                        agentId: selectedAgent.id,
                        jobs: props.cronJobs,
                        status: props.cronStatus,
                        loading: props.cronLoading,
                        error: props.cronError,
                        onRefresh: props.onCronRefresh,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "chat" && props.agentChatProps
                    ? renderAgentChatPanel({
                        agentId: selectedAgent.id,
                        agentName: normalizeAgentLabel(selectedAgent),
                        agentEmoji: resolveAgentEmoji(selectedAgent, props.agentIdentityById[selectedAgent.id] ?? null),
                        ...props.agentChatProps,
                      })
                    : nothing
                }
              `
        }
      </section>
    </div>
    </div>
  `;
}

function hasTeamProjects(projects: TeamProjectSummary[] | null): boolean {
  return !!projects && projects.length > 0;
}

function renderAgentHeader(
  agent: AgentsListResult["agents"][number],
  defaultId: string | null,
  agentIdentity: AgentIdentityResult | null,
  props: AgentsProps,
) {
  const badge = agentBadgeText(agent.id, defaultId);
  const displayName = normalizeAgentLabel(agent);
  const subtitle = agent.identity?.theme?.trim() || t("agents.defaultSubtitle");
  const emoji = resolveAgentEmoji(agent, agentIdentity);
  const isDefault = agent.id === defaultId;
  return html`
    <section class="card agent-header">
      <div class="agent-header-main">
        <div class="agent-avatar agent-avatar--lg">${emoji || displayName.slice(0, 1)}</div>
        <div>
          <div class="card-title">${displayName}</div>
          <div class="card-sub">${subtitle}</div>
        </div>
      </div>
      <div class="agent-header-meta">
        <div class="mono">${agent.id}</div>
        ${badge ? html`<span class="agent-pill">${badge}</span>` : nothing}
        <button
          class="btn btn--sm primary"
          style="margin-left: 8px;"
          @click=${() => props.onStartChat(agent.id)}
        >
          ${t("agents.startChat")}
        </button>
        ${!isDefault
          ? html`
            <button
              class="btn btn--sm"
              style="margin-left: 8px; color: var(--danger, #d33);"
              ?disabled=${props.agentDeleting}
              @click=${() => {
                const msg = t("agents.deleteConfirm", { name: displayName });
                if (confirm(msg)) void props.onDeleteAgent(agent.id);
              }}
            >
              ${t("agents.deleteAgent")}
            </button>
          `
          : nothing}
      </div>
      ${props.agentDeleteError
        ? html`<div class="callout danger" style="margin-top: 8px;">${props.agentDeleteError}</div>`
        : nothing}
    </section>
  `;
}

function renderAgentTabs(active: AgentsPanel, onSelect: (panel: AgentsPanel) => void) {
  const tabs: Array<{ id: AgentsPanel; label: string }> = [
    { id: "overview", label: t("agents.tabOverview") },
    { id: "chat", label: t("agents.tabChat") },
    { id: "tools", label: t("agents.tabTools") },
    { id: "skills", label: t("agents.tabSkills") },
    { id: "channels", label: t("agents.tabChannels") },
    { id: "cron", label: t("agents.tabCron") },
    { id: "files", label: t("agents.tabFiles") },
  ];
  return html`
    <div class="agent-tabs">
      ${tabs.map(
        (tab) => html`
          <button
            class="agent-tab ${active === tab.id ? "active" : ""}"
            type="button"
            @click=${() => onSelect(tab.id)}
          >
            ${tab.label}
          </button>
        `,
      )}
    </div>
  `;
}

function renderAgentOverview(params: {
  agent: AgentsListResult["agents"][number];
  defaultId: string | null;
  configForm: Record<string, unknown> | null;
  agentFilesList: AgentsFilesListResult | null;
  agentIdentity: AgentIdentityResult | null;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
  dmScopeStatus: AgentsProps["dmScopeStatus"] | null;
  onIdentityUpdate?: AgentsProps["onIdentityUpdate"];
  onSoulLoad?: AgentsProps["onSoulLoad"];
  onSoulSave?: AgentsProps["onSoulSave"];
  requestUpdate: () => void;
}) {
  const {
    agent,
    configForm,
    agentFilesList,
    agentIdentity,
    agentIdentityLoading,
    agentIdentityError,
    configLoading,
    configSaving,
    configDirty,
    onConfigReload,
    onConfigSave,
    onModelChange,
    onModelFallbacksChange,
    requestUpdate,
  } = params;
  const config = resolveAgentConfig(configForm, agent.id);
  const workspaceFromFiles =
    agentFilesList && agentFilesList.agentId === agent.id ? agentFilesList.workspace : null;
  const workspace =
    workspaceFromFiles || config.entry?.workspace || config.defaults?.workspace || "default";
  const model = config.entry?.model
    ? resolveModelLabel(config.entry?.model)
    : resolveModelLabel(config.defaults?.model);
  const defaultModel = resolveModelLabel(config.defaults?.model);
  const modelPrimary =
    resolveModelPrimary(config.entry?.model) || (model !== "-" ? normalizeModelValue(model) : null);
  const defaultPrimary =
    resolveModelPrimary(config.defaults?.model) ||
    (defaultModel !== "-" ? normalizeModelValue(defaultModel) : null);
  const effectivePrimary = modelPrimary ?? defaultPrimary ?? null;
  const modelFallbacks = resolveModelFallbacks(config.entry?.model);
  const fallbackText = modelFallbacks ? modelFallbacks.join(", ") : "";
  const identityName =
    agentIdentity?.name?.trim() ||
    agent.identity?.name?.trim() ||
    agent.name?.trim() ||
    config.entry?.name ||
    "-";
  const resolvedEmoji = resolveAgentEmoji(agent, agentIdentity);
  const identityEmoji = resolvedEmoji || "-";
  const skillFilter = Array.isArray(config.entry?.skills) ? config.entry?.skills : null;
  const skillCount = skillFilter?.length ?? null;
  const isDefault = Boolean(params.defaultId && agent.id === params.defaultId);

  // Sync identity editing state when agent changes
  if (overviewIdentity.agentId !== agent.id) {
    overviewIdentity.agentId = agent.id;
    overviewIdentity.name = identityName !== "-" ? identityName : "";
    overviewIdentity.emoji = identityEmoji !== "-" ? identityEmoji : "";
    overviewIdentity.dirty = false;
  }

  // Auto-load SOUL.md when agent changes
  if (overviewSoul.agentId !== agent.id) {
    overviewSoul.agentId = agent.id;
    overviewSoul.content = "";
    overviewSoul.draft = "";
    overviewSoul.loaded = false;
    overviewSoul.dirty = false;
    if (params.onSoulLoad) {
      void params.onSoulLoad(agent.id).then((content) => {
        if (overviewSoul.agentId === agent.id) {
          overviewSoul.content = content;
          overviewSoul.draft = content;
          overviewSoul.loaded = true;
          requestUpdate();
        }
      });
    }
  }

  const identityDirty = overviewIdentity.dirty;
  const soulDirty = overviewSoul.dirty;

  return html`
    <!-- Card 1: Identity (editable) -->
    <section class="card">
      <div class="card-title">${t("agents.identityTitle")}</div>
      <div class="card-sub">${t("agents.identitySub")}</div>
      <div class="row" style="gap: 12px; flex-wrap: wrap; margin-top: 12px;">
        <label class="field" style="flex: 1; min-width: 200px;">
          <span>${t("agents.identityName")}</span>
          <input
            type="text"
            .value=${overviewIdentity.name}
            placeholder=${t("agents.identityNamePlaceholder")}
            style="box-sizing: border-box; width: 100%;"
            @input=${(e: Event) => {
              overviewIdentity.name = (e.target as HTMLInputElement).value;
              overviewIdentity.dirty = true;
              requestUpdate();
            }}
          />
        </label>
        <label class="field" style="width: 100px; flex-shrink: 0;">
          <span>Emoji</span>
          <input
            type="text"
            .value=${overviewIdentity.emoji}
            placeholder="🤖"
            style="box-sizing: border-box; width: 100%; text-align: center; font-size: 18px;"
            @input=${(e: Event) => {
              overviewIdentity.emoji = (e.target as HTMLInputElement).value;
              overviewIdentity.dirty = true;
              requestUpdate();
            }}
          />
        </label>
      </div>
      ${identityDirty && params.onIdentityUpdate
        ? html`
          <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 8px;">
            <button class="btn btn--sm" @click=${() => {
              overviewIdentity.name = identityName !== "-" ? identityName : "";
              overviewIdentity.emoji = identityEmoji !== "-" ? identityEmoji : "";
              overviewIdentity.dirty = false;
              requestUpdate();
            }}>${t("agents.reset")}</button>
            <button class="btn btn--sm primary" @click=${async () => {
              const ok = await params.onIdentityUpdate!(agent.id, overviewIdentity.name.trim(), overviewIdentity.emoji.trim());
              if (ok) overviewIdentity.dirty = false;
              requestUpdate();
            }}>${t("agents.save")}</button>
          </div>
        `
        : nothing}
    </section>

    <!-- Card 2: Role Description (SOUL.md) -->
    <section class="card">
      <div class="card-title">${t("agents.soulTitle")}</div>
      <div class="card-sub">${t("agents.soulSub")}</div>
      ${!overviewSoul.loaded
        ? html`<div class="muted" style="margin-top: 12px;">${t("agents.loading")}</div>`
        : html`
          <label class="field" style="margin-top: 12px;">
            <textarea
              .value=${overviewSoul.draft}
              rows="8"
              placeholder=${t("agents.soulPlaceholder")}
              style="min-height: 120px; font-family: inherit; line-height: 1.6;"
              @input=${(e: Event) => {
                overviewSoul.draft = (e.target as HTMLTextAreaElement).value;
                overviewSoul.dirty = overviewSoul.draft !== overviewSoul.content;
                requestUpdate();
              }}
            ></textarea>
          </label>
          ${soulDirty && params.onSoulSave
            ? html`
              <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 8px;">
                <button class="btn btn--sm" @click=${() => {
                  overviewSoul.draft = overviewSoul.content;
                  overviewSoul.dirty = false;
                  requestUpdate();
                }}>${t("agents.reset")}</button>
                <button class="btn btn--sm primary" @click=${async () => {
                  const ok = await params.onSoulSave!(agent.id, overviewSoul.draft);
                  if (ok) {
                    overviewSoul.content = overviewSoul.draft;
                    overviewSoul.dirty = false;
                  }
                  requestUpdate();
                }}>${t("agents.save")}</button>
              </div>
            `
            : nothing}
        `}
    </section>

    <!-- Card 3: Model Selection -->
    <section class="card">
      <div class="card-title">${t("agents.modelSelection")}</div>
      <div class="card-sub">${t("agents.modelSelectionSub")}</div>
      <div class="row" style="gap: 12px; flex-wrap: wrap; margin-top: 12px;">
        <label class="field" style="min-width: 260px; flex: 1;">
          <span>${isDefault ? t("agents.primaryModelDefault") : t("agents.primaryModelLabel")}</span>
          <select
            .value=${effectivePrimary ?? ""}
            ?disabled=${!configForm || configLoading || configSaving}
            @change=${(e: Event) =>
              onModelChange(agent.id, (e.target as HTMLSelectElement).value || null)}
          >
            ${
              isDefault
                ? nothing
                : html`
                    <option value="">
                      ${defaultPrimary ? t("agents.inheritDefaultWithModel", { model: defaultPrimary }) : t("agents.inheritDefault")}
                    </option>
                  `
            }
            ${buildModelOptions(configForm, effectivePrimary ?? undefined)}
          </select>
        </label>
        <label class="field" style="min-width: 260px; flex: 1;">
          <span>${t("agents.fallbacks")}</span>
          <input
            .value=${fallbackText}
            ?disabled=${!configForm || configLoading || configSaving}
            placeholder="provider/model, provider/model"
            @input=${(e: Event) =>
              onModelFallbacksChange(
                agent.id,
                parseFallbackList((e.target as HTMLInputElement).value),
              )}
          />
        </label>
      </div>
      <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 8px;">
        <button class="btn btn--sm" ?disabled=${configLoading} @click=${onConfigReload}>
          ${t("agents.reloadConfig")}
        </button>
        <button
          class="btn btn--sm primary"
          ?disabled=${configSaving || !configDirty}
          @click=${onConfigSave}
        >
          ${configSaving ? t("agents.saving") : t("agents.save")}
        </button>
      </div>
    </section>

    <!-- Card 4: Advanced (collapsed by default) -->
    <section class="card">
      <button
        type="button"
        class="overview-advanced-toggle"
        @click=${() => { overviewAdvancedOpen = !overviewAdvancedOpen; requestUpdate(); }}
      >
        <span>${overviewAdvancedOpen ? "▾" : "▸"} ${t("agents.advancedTitle")}</span>
      </button>
      ${overviewAdvancedOpen
        ? html`
          <div class="card-sub" style="margin-top: 4px;">${t("agents.advancedSub")}</div>
          <div class="agents-overview-grid" style="margin-top: 12px;">
            <div class="agent-kv">
              <div class="label">${t("agents.workspace")}</div>
              <div class="mono">${workspace}</div>
            </div>
            <div class="agent-kv">
              <div class="label">${t("agents.primaryModel")}</div>
              <div class="mono">${model}</div>
            </div>
            <div class="agent-kv">
              <div class="label">${t("agents.default")}</div>
              <div>${isDefault ? t("agents.yes") : t("agents.no")}</div>
            </div>
            <div class="agent-kv">
              <div class="label">${t("agents.skillsFilter")}</div>
              <div>${skillFilter ? `${skillCount} ${t("agents.selectedSkills")}` : t("agents.allSkills")}</div>
            </div>
            <div class="agent-kv">
              <div class="label">${t("agents.sessionIsolation")}</div>
              <div>
                ${params.dmScopeStatus ? (() => { const k = `dmScope.label.${params.dmScopeStatus!.current}`; const v = (t as (k: string) => string)(k); return v !== k ? v : params.dmScopeStatus!.current; })() : "-"}
                ${params.dmScopeStatus?.shouldUpgrade ? html`<span class="agent-pill warn">${t("agents.dmScopeUpgradeNeeded")}</span>` : params.dmScopeStatus && params.dmScopeStatus.current !== "main" ? html`<span class="agent-pill">${t("agents.dmScopeOk")}</span>` : nothing}
              </div>
            </div>
          </div>
        `
        : nothing}
    </section>
  `;
}

/* ── ID format regex (must contain at least one alphanumeric) ── */
const AGENT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

/* ── Add-agent sidebar form ── */
function renderAddAgentForm(props: AgentsProps) {
  const toggle = () => {
    const next = !props.addFormOpen;
    if (!next) {
      addFormFields.id = "";
      addFormFields.name = "";
      addFormFields.workspace = "";
    }
    props.onToggleAddForm(next);
  };
  const idValid = AGENT_ID_RE.test(addFormFields.id.trim());
  const canSubmit =
    idValid &&
    addFormFields.name.trim().length > 0 &&
    addFormFields.workspace.trim().length > 0 &&
    !props.agentCreating;
  const handleSubmit = async () => {
    if (!canSubmit) return;
    const ok = await props.onCreateAgent(
      addFormFields.id.trim(),
      addFormFields.name.trim(),
      addFormFields.workspace.trim(),
    );
    if (ok) {
      addFormFields.id = "";
      addFormFields.name = "";
      addFormFields.workspace = "";
    }
  };
  const showIdHint =
    addFormFields.id.trim().length > 0 && !idValid;

  return html`
    <div style="margin-top: 12px;">
      <button
        class="btn btn--sm"
        style="width: 100%;"
        @click=${toggle}
      >
        ${props.addFormOpen ? "−" : "+"} ${t("agents.addAgent")}
      </button>
      ${props.addFormOpen
        ? html`
          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
            <label class="field">
              <span>${t("agents.addAgentId")}</span>
              <input
                type="text"
                .value=${addFormFields.id}
                placeholder=${t("agents.addAgentIdPlaceholder")}
                ?disabled=${props.agentCreating}
                @input=${(e: Event) => {
                  addFormFields.id = (e.target as HTMLInputElement).value;
                  props.onToggleAddForm(true);
                }}
              />
              ${showIdHint
                ? html`<div class="muted" style="font-size: 11px; margin-top: 2px;">${t("agents.addAgentIdHint")}</div>`
                : nothing}
            </label>
            <label class="field">
              <span>${t("agents.addAgentName")}</span>
              <input
                type="text"
                .value=${addFormFields.name}
                placeholder=${t("agents.addAgentNamePlaceholder")}
                ?disabled=${props.agentCreating}
                @input=${(e: Event) => { addFormFields.name = (e.target as HTMLInputElement).value; }}
              />
            </label>
            <label class="field">
              <span>${t("agents.addAgentWorkspace")}</span>
              <input
                type="text"
                .value=${addFormFields.workspace}
                placeholder=${t("agents.addAgentWorkspacePlaceholder")}
                ?disabled=${props.agentCreating}
                @input=${(e: Event) => { addFormFields.workspace = (e.target as HTMLInputElement).value; }}
              />
            </label>
            ${props.agentCreateError
              ? html`<div class="callout danger">${props.agentCreateError}</div>`
              : nothing}
            <button
              class="btn primary"
              ?disabled=${!canSubmit}
              @click=${handleSubmit}
            >
              ${props.agentCreating ? t("agents.creating") : t("agents.createBtn")}
            </button>
          </div>
        `
        : nothing}
    </div>
  `;
}

/* ── Multi-agent onboarding guide ── */
function renderMultiAgentGuide() {
  return html`
    <div class="callout info" style="margin-bottom: 16px;">
      <div style="font-weight: 600; margin-bottom: 6px;">${t("agents.guideTitle")}</div>
      <div style="margin-bottom: 8px;">${t("agents.guideIntro")}</div>
      <div style="margin-bottom: 4px;">1. ${t("agents.guideStep1")}</div>
      <div style="margin-bottom: 4px;">2. ${t("agents.guideStep2")}</div>
      <div style="margin-bottom: 8px;">3. ${t("agents.guideStep3")}</div>
      <div style="font-weight: 600; margin-bottom: 4px;">${t("agents.guideRoutingTitle")}</div>
      <div style="margin-bottom: 8px;">${t("agents.guideRoutingBody")}</div>
      <div class="muted mono" style="font-size: 12px;">${t("agents.guideCli")}</div>
    </div>
  `;
}
