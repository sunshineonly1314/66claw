import { html, nothing } from "lit";
import { t } from "../i18n/index.js";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
  SkillStatusReport,
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

export type AgentsPanel = "overview" | "files" | "tools" | "skills" | "channels" | "cron";

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

export function renderAgents(props: AgentsProps) {
  const agents = props.agentsList?.agents ?? [];
  const defaultId = props.agentsList?.defaultId ?? null;
  const selectedId = props.selectedAgentId ?? defaultId ?? agents[0]?.id ?? null;
  const selectedAgent = selectedId
    ? (agents.find((agent) => agent.id === selectedId) ?? null)
    : null;
  const isOnlyDefault = agents.length <= 1;

  return html`
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
        <div class="agent-list">
          ${
            agents.length === 0
              ? html`
                  <div class="muted">${t("agents.noAgents")}</div>
                `
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
        ${isOnlyDefault ? renderMultiAgentGuide() : nothing}
        ${
          !selectedAgent
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
              `
        }
      </section>
    </div>
  `;
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
    { id: "files", label: t("agents.tabFiles") },
    { id: "tools", label: t("agents.tabTools") },
    { id: "skills", label: t("agents.tabSkills") },
    { id: "channels", label: t("agents.tabChannels") },
    { id: "cron", label: t("agents.tabCron") },
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
  const identityStatus = agentIdentityLoading
    ? t("agents.loading")
    : agentIdentityError
      ? t("agents.unavailable")
      : "";
  const isDefault = Boolean(params.defaultId && agent.id === params.defaultId);

  return html`
    <section class="card">
      <div class="card-title">${t("agents.overviewTitle")}</div>
      <div class="card-sub">${t("agents.overviewSub")}</div>
      <div class="agents-overview-grid">
        <div class="agent-kv">
          <div class="label">${t("agents.workspace")}</div>
          <div class="mono">${workspace}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.primaryModel")}</div>
          <div class="mono">${model}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.identityName")}</div>
          <div>${identityName}</div>
          ${identityStatus ? html`<div class="agent-kv-sub muted">${identityStatus}</div>` : nothing}
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.default")}</div>
          <div>${isDefault ? t("agents.yes") : t("agents.no")}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.identityEmoji")}</div>
          <div>${identityEmoji}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.skillsFilter")}</div>
          <div>${skillFilter ? `${skillCount} ${t("agents.selectedSkills")}` : t("agents.allSkills")}</div>
        </div>
      </div>

      <div class="agent-model-select" style="margin-top: 16px;">
        <div class="label">${t("agents.modelSelection")}</div>
        <div class="row" style="gap: 12px; flex-wrap: wrap;">
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
        <div class="row" style="justify-content: flex-end; gap: 8px;">
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
      </div>
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
