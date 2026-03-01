/**
 * Agent Team Plugin — Entry Point
 *
 * Registers hooks, gateway methods, and background services for
 * project-level agent team management.
 *
 * Zero invasion: all team logic lives in this plugin.
 * The main codebase only needs BUNDLED_ENABLED_BY_DEFAULT entry.
 *
 * Pattern mirrors extensions/orchestrator/index.ts.
 */

import type {
  OpenClawCNPluginDefinition,
  OpenClawCNPluginApi,
} from "../../src/plugins/types.js";
import type {
  CallGatewayFn,
  FastPathConfig,
  MemberHealth,
  MemberInfo,
  Project,
  ProjectState,
  TeamConstraints,
} from "./src/types.js";
import {
  initProjectStateDir,
  saveProject,
  loadProject,
  deleteProject,
  listProjectIds,
  loadAllProjects,
  saveProjectState,
  loadProjectState,
  saveActivity,
  loadActivity,
} from "./src/state.js";
import { generateProjectId } from "./src/project-id.js";
import {
  createInitialMemberHealth,
  recordMemberSuccess,
  recordMemberFailure,
  isRoutable,
} from "./src/member-health.js";
import { buildTeamContextBlock, isSupervisor } from "./src/system-prompt.js";
import { generateSupervisorSoul } from "./src/supervisor-soul.js";
import { matchWorkflow, generateWorkflowInstructions } from "./src/task-coordinator.js";
import { createProjectFromPlan } from "./src/deploy-bridge.js";
import { buildRoutesFromMembers } from "./src/keyword-router.js";
import {
  routeMessage,
  setRouteTable,
  clearRouteTable,
} from "./src/fast-path-router.js";
import {
  setAffinity,
  clearProjectAffinities,
  purgeExpiredAffinities,
} from "./src/session-affinity.js";
import {
  readSharedProfile,
  writeSharedProfile,
  formatSharedProfileForPrompt,
  SHARED_MEMORY_MAX_PROMPT_CHARS,
} from "./src/shared-profile-store.js";
import { createMemoryShareTool } from "./src/memory-share-tool.js";
import { autoPromoteEntries } from "./src/auto-promote.js";
import { formatActivitySummary } from "./src/conversation-compactor.js";
import {
  createInitialMemberStats,
  recordMemberCall,
  computeAverageDuration,
} from "./src/member-stats.js";
import type { SharedCategory, MemberStats } from "./src/types.js";
import { rewriteOutboundMessage } from "./src/visibility-rewriter.js";
import {
  analyzeLearningOpportunities,
  applyAutoOptimizations,
  generateLearningHints,
  formatLearningReport,
  shouldTriggerLearning,
  LEARNING_CYCLE_THRESHOLD,
} from "./src/learning-engine.js";
import type { LearningAnalysis } from "./src/learning-engine.js";
import { buildSupervisorLearningContext } from "./src/soul-optimizer.js";

// ── In-Memory Cache ──────────────────────────────────────────────────────
// Hot-path lookup for before_agent_start hook (runs on every LLM call).

const projectCache = new Map<string, Project>();
const agentToProject = new Map<string, string>();
const healthCache = new Map<string, Map<string, MemberHealth>>();
const statsCache = new Map<string, Map<string, MemberStats>>();

/**
 * Readiness gate: resolves once gateway_start has finished loading projects
 * from disk. Gateway methods that read projectCache should await this to
 * avoid returning empty results due to a race condition.
 */
let cacheReadyResolve: () => void;
const cacheReady = new Promise<void>((r) => { cacheReadyResolve = r; });

/** Cached agentId → display name maps, rebuilt when project version changes. */
const memberNameMapCache = new Map<string, { version: number; map: Map<string, string> }>();

/** Learning analysis cache per project (keyed by projectId). */
const learningCache = new Map<string, LearningAnalysis>();
/** Events since last learning cycle per project. */
const eventsSinceLastLearning = new Map<string, number>();

/** Get or create a cached member name map for a project. */
function getMemberNameMap(project: Project): Map<string, string> {
  const cached = memberNameMapCache.get(project.projectId);
  if (cached && cached.version === project.version) return cached.map;
  const map = new Map<string, string>();
  for (const m of project.members) {
    map.set(m.id, m.emoji ? `${m.emoji} ${m.name}` : m.name);
  }
  memberNameMapCache.set(project.projectId, { version: project.version, map });
  return map;
}

// ── Activity Event Ring Buffer ──────────────────────────────────────────
// Records routing decisions and agent completion events for the UI activity feed.
// Keyed by projectId, each buffer holds the most recent MAX_ACTIVITY_EVENTS events.

const ACTIVITY_BUFFER_MAX = 100;

type ActivityEvent = {
  id: string;
  timestamp: number;
  agentId: string;
  peerId?: string;
  method: "affinity" | "keyword" | "supervisor-llm";
  confidence: number;
  matchedPattern?: string;
  durationMs?: number;
  success?: boolean;
  error?: string;
  replySummary?: string;
  /** Classified task type for supervisor visibility */
  taskType?: "routing" | "sub-task" | "direct-reply" | "fallback";
  /** Structured outcome (richer than boolean success) */
  outcome?: "success" | "failure" | "timeout" | "partial";
};

const activityBuffers = new Map<string, ActivityEvent[]>();
const activitySaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function pushActivityEvent(projectId: string, event: ActivityEvent): void {
  let buf = activityBuffers.get(projectId);
  if (!buf) {
    buf = [];
    activityBuffers.set(projectId, buf);
  }
  buf.push(event);
  if (buf.length > ACTIVITY_BUFFER_MAX) {
    buf.splice(0, buf.length - ACTIVITY_BUFFER_MAX);
  }
  // Debounced persist — write at most once every 2 seconds per project
  if (!activitySaveTimers.has(projectId)) {
    activitySaveTimers.set(
      projectId,
      setTimeout(() => {
        activitySaveTimers.delete(projectId);
        const current = activityBuffers.get(projectId);
        if (current) {
          saveActivity(projectId, current).catch(() => {/* best-effort */});
        }
      }, 2000),
    );
  }
}

/** Pending routing decisions awaiting agent_end completion. Key = agentId (most recent per agent). */
const pendingRouteEvents = new Map<string, { projectId: string; event: Omit<ActivityEvent, "durationMs" | "success" | "error" | "replySummary">; startTime: number }>();

/**
 * Caches the last user message seen by the supervisor's resolve_agent hook.
 * Key: supervisorId, Value: user message text.
 * Used by before_agent_start to match template workflows (zero-token decomposition).
 * Bounded: one entry per active supervisor, cleaned on project delete.
 */
const lastSupervisorMessage = new Map<string, string>();

let activityIdCounter = 0;
function nextActivityId(): string {
  return `act_${Date.now()}_${++activityIdCounter}`;
}

/**
 * Tracks the most recent agentId that handled a given peer.
 * Key: peerId, Value: agentId.
 * Used by message_sending hook to identify the responding agent.
 *
 * Bounded to MAX_PEER_AGENT_ENTRIES to prevent unbounded memory growth.
 * Oldest entries are evicted when the limit is reached (FIFO via insertion order).
 * Also cleaned up on project delete and by the periodic health check timer.
 */
const lastAgentForPeer = new Map<string, string>();
const MAX_PEER_AGENT_ENTRIES = 10_000;

function setLastAgentForPeer(peerId: string, agentId: string): void {
  // Evict oldest entries if at capacity (Map preserves insertion order)
  if (lastAgentForPeer.size >= MAX_PEER_AGENT_ENTRIES) {
    const firstKey = lastAgentForPeer.keys().next().value;
    if (firstKey !== undefined) lastAgentForPeer.delete(firstKey);
  }
  // Delete-then-set to move to end of insertion order (most recent)
  lastAgentForPeer.delete(peerId);
  lastAgentForPeer.set(peerId, agentId);
}

/**
 * Remove all peer-agent entries that reference agents in the given project.
 */
function clearPeerAgentEntriesForProject(project: Project): void {
  const memberSet = new Set(project.memberIds);
  for (const [peerId, agentId] of lastAgentForPeer) {
    if (memberSet.has(agentId)) {
      lastAgentForPeer.delete(peerId);
    }
  }
}

function rebuildAgentIndex(): void {
  agentToProject.clear();
  // Two-pass: federation meta-projects first, then regular projects.
  // Regular (non-federation) projects overwrite federation entries so that
  // a child supervisor maps to its own child project, not the federation.
  for (const [projectId, project] of projectCache) {
    if (!project.isFederation) continue;
    for (const memberId of project.memberIds) {
      agentToProject.set(memberId, projectId);
    }
  }
  for (const [projectId, project] of projectCache) {
    if (project.isFederation) continue;
    for (const memberId of project.memberIds) {
      agentToProject.set(memberId, projectId);
    }
  }
  // Also rebuild dependent indexes
  rebuildSupervisorIndex();
  buildAllRouteTables();
}

function findProjectByAgentId(agentId: string): Project | undefined {
  const projectId = agentToProject.get(agentId);
  if (!projectId) return undefined;
  return projectCache.get(projectId);
}

function getOrCreateHealthMap(
  projectId: string,
  memberIds: string[],
): Map<string, MemberHealth> {
  let map = healthCache.get(projectId);
  if (!map) {
    map = new Map();
    for (const id of memberIds) {
      map.set(id, createInitialMemberHealth(id));
    }
    healthCache.set(projectId, map);
  }
  return map;
}

function getOrCreateStatsMap(
  projectId: string,
  memberIds: string[],
): Map<string, MemberStats> {
  let map = statsCache.get(projectId);
  if (!map) {
    map = new Map();
    for (const id of memberIds) {
      map.set(id, createInitialMemberStats(id));
    }
    statsCache.set(projectId, map);
  }
  return map;
}

// ── Supervisor-to-Project Index ──────────────────────────────────────────

const supervisorToProject = new Map<string, string>();

function rebuildSupervisorIndex(): void {
  supervisorToProject.clear();
  for (const [projectId, project] of projectCache) {
    supervisorToProject.set(project.supervisorId, projectId);
  }
}

function findProjectBySupervisorId(
  supervisorId: string,
): Project | undefined {
  const projectId = supervisorToProject.get(supervisorId);
  if (!projectId) return undefined;
  return projectCache.get(projectId);
}

// ── Session Key Helpers ─────────────────────────────────────────────────

/**
 * Extract the agentId from a session key.
 * Session key format: `agent:<agentId>:<rest>`
 */
function extractAgentIdFromSessionKey(
  sessionKey: string,
): string | null {
  const parts = sessionKey.split(":");
  if (parts.length < 3 || parts[0] !== "agent") return null;
  return parts[1] || null;
}

/**
 * Replace the agentId portion of a session key.
 * `agent:old-agent:rest` → `agent:new-agent:rest`
 */
function replaceAgentInSessionKey(
  sessionKey: string,
  newAgentId: string,
): string {
  const parts = sessionKey.split(":");
  if (parts.length < 3 || parts[0] !== "agent") {
    // Not a standard session key — construct a minimal one
    return `agent:${newAgentId}:main`;
  }
  parts[1] = newAgentId;
  return parts.join(":");
}

/**
 * Build route tables for all active projects from their member info.
 */
function buildAllRouteTables(): void {
  for (const [projectId, project] of projectCache) {
    if (project.status !== "active") continue;
    const nonSupervisor = project.members.filter(
      (m) => m.id !== project.supervisorId,
    );
    const routes = buildRoutesFromMembers(nonSupervisor);
    setRouteTable(projectId, routes);
  }
}

/**
 * Explicitly extract allowed constraint fields to prevent prototype pollution.
 */
function extractConstraints(raw: unknown): TeamConstraints | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const brandRules = c.brandRules;
  if (!brandRules || typeof brandRules !== "object") return undefined;
  const br = brandRules as Record<string, unknown>;
  const result: TeamConstraints = { brandRules: {} };
  if (typeof br.userAddress === "string") {
    result.brandRules!.userAddress = br.userAddress;
  }
  if (Array.isArray(br.forbidden)) {
    result.brandRules!.forbidden = br.forbidden.filter((v): v is string => typeof v === "string");
  }
  if (Array.isArray(br.safetyRules)) {
    result.brandRules!.safetyRules = br.safetyRules.filter((v): v is string => typeof v === "string");
  }
  return result;
}

// ── Plugin Definition ────────────────────────────────────────────────────

const plugin: OpenClawCNPluginDefinition = {
  id: "agent-team",
  name: "Agent Team Manager",
  description: "Project-level agent team management.",
  version: "0.5.0",

  register(api: OpenClawCNPluginApi) {
    const logger = api.logger;
    logger.info("Agent Team plugin registering...");

    // ── Initialize state directory ────────────────────────────────────
    const stateDir = api.resolvePath("~/.openclawcn/agent-team");
    initProjectStateDir(stateDir);

    // ── Build gateway call function (lazy import, same as orchestrator) ──
    const callGateway: CallGatewayFn = async (method, params) => {
      const { callGateway: gwCall } = await import(
        "../../dist/gateway/call.js"
      );
      return gwCall({
        method,
        params,
        timeoutMs: 30_000,
        clientName: "gateway-client" as never,
        clientDisplayName: "AgentTeam",
        mode: "backend" as never,
      });
    };

    // Orchestrator state dir for reading plans
    const orchestratorStateDir = api.resolvePath(
      "~/.openclawcn/orchestrator",
    );

    // ═══════════════════════════════════════════════════════════════════
    // HOOKS
    // ═══════════════════════════════════════════════════════════════════

    // ── resolve_agent: Fast Path Router ─────────────────────────────
    // Intercepts before agent selection. If the message is addressed to
    // a Supervisor agent that belongs to an active project, attempt
    // deterministic routing to a team member (affinity → keyword → null).
    // Returns null to let the message proceed to the Supervisor's LLM.
    api.on(
      "resolve_agent",
      async (event: { message: string; sessionKey: string }, ctx: { channelId?: string; accountId?: string; peerId?: string }) => {
        if (!event.message || !event.sessionKey) return;

        // Without peerId we cannot do deterministic routing — affinity
        // would be shared across all anonymous users, causing cross-user
        // routing contamination. Skip fast path and let Supervisor LLM handle.
        if (!ctx.peerId) return;

        // Extract current agent from session key
        const currentAgentId = extractAgentIdFromSessionKey(
          event.sessionKey,
        );
        if (!currentAgentId) return;

        // Only intercept if the current agent is a Supervisor
        const project = findProjectBySupervisorId(currentAgentId);
        if (!project || project.status !== "active") return;

        // Run the Fast Path Router
        const healthMap = getOrCreateHealthMap(
          project.projectId,
          project.memberIds,
        );
        const result = routeMessage({
          message: event.message,
          project,
          peerId: ctx.peerId,
          healthMap,
        });

        if (!result) {
          // No deterministic match → Supervisor LLM handles the message.
          // Cache the message so before_agent_start can match template workflows.
          // Only cache if template workflows are enabled (avoids orphaned entries).
          if (project.taskCoordination?.templateWorkflowsEnabled !== false) {
            lastSupervisorMessage.set(currentAgentId, event.message);
          }
          return;
        }

        // ── Federation: two-level cascade ──────────────────────────────
        // If the first-level result points to an agent that is ALSO a
        // supervisor of another project, attempt a second routing pass
        // to reach the final member agent directly (zero extra LLM cost).
        let finalResult = result;
        const childProject = findProjectBySupervisorId(result.agentId);
        if (childProject && childProject.status === "active") {
          const childHealthMap = getOrCreateHealthMap(
            childProject.projectId,
            childProject.memberIds,
          );
          const innerResult = routeMessage({
            message: event.message,
            project: childProject,
            peerId: ctx.peerId,
            healthMap: childHealthMap,
          });
          if (innerResult) {
            // Record affinity at the child project level too
            setAffinity(
              childProject.projectId,
              ctx.peerId,
              innerResult.agentId,
            );
            logger.info(
              `[FastPath] federation cascade: ` +
                `${result.agentId} → ${innerResult.agentId} ` +
                `(${innerResult.method}, ${(innerResult.confidence * 100).toFixed(0)}%)`,
            );
            finalResult = innerResult;
          }
          // If innerResult is null, message goes to child supervisor LLM — correct
        }

        // Build new session key pointing to the target member agent
        const newSessionKey = replaceAgentInSessionKey(
          event.sessionKey,
          finalResult.agentId,
        );

        // Update affinity for sticky routing on follow-up messages.
        // For federation: store the child supervisor ID (result.agentId) at the
        // meta-project level, not the final member ID. The meta-project's
        // routableMembers only contains child supervisors, so storing a final
        // member ID would never match on subsequent affinity lookups.
        setAffinity(
          project.projectId,
          ctx.peerId,
          result.agentId,
        );

        // Record peer→agent mapping for message_sending hook.
        // resolve_agent is the only hook with peerId (= ctx.From).
        // message_sending uses event.to which is the same peer address.
        setLastAgentForPeer(ctx.peerId, finalResult.agentId);

        logger.info(
          `[FastPath] ${finalResult.method}: ` +
            `"${finalResult.matchedPattern ?? ""}" → ${finalResult.agentId} ` +
            `(${(finalResult.confidence * 100).toFixed(0)}%)`,
        );

        // Record routing decision for the activity feed.
        // Store as pending — agent_end will finalize with duration/success.
        const routeEvent = {
          id: nextActivityId(),
          timestamp: Date.now(),
          agentId: finalResult.agentId,
          peerId: ctx.peerId,
          method: finalResult.method as ActivityEvent["method"],
          confidence: finalResult.confidence,
          matchedPattern: finalResult.matchedPattern,
        };
        pendingRouteEvents.set(finalResult.agentId, {
          projectId: project.projectId,
          event: routeEvent,
          startTime: Date.now(),
        });

        return {
          sessionKey: newSessionKey,
          reason: `fast-path:${finalResult.method}`,
        };
      },
      { priority: 100 },
    );

    // ── before_agent_start: inject team context + shared memory ────────
    api.on(
      "before_agent_start",
      async (_event, ctx) => {
        if (!ctx.agentId) return;

        const project = findProjectByAgentId(ctx.agentId);
        if (!project) return;
        if (project.status !== "active") return;

        // NOTE: PluginHookAgentContext does NOT include peerId —
        // peer→agent mapping is maintained by resolve_agent (which has peerId)
        // and consumed by message_sending (which has event.to = same peer address).

        const parts: string[] = [];

        // 1. Team context (always)
        const context = buildTeamContextBlock(project, ctx.agentId);
        if (context) parts.push(context);

        // NOTE: Budget soft guard (project.budget.maxCostPerConversation)
        // is deferred to Phase 5. Accurate per-conversation budget requires
        // conversationId-scoped stats, but agent_end currently lacks
        // conversationId and token/cost data. The global totalDurationMs
        // cannot be used because it is cumulative across all conversations,
        // causing the hint to fire permanently once the lifetime threshold
        // is exceeded. Phase 5 will implement conversation-level tracking
        // when the upstream hook API exposes usage/conversationId.

        // 2. Shared memory (only for read-shared mode)
        if (project.memory.mode === "read-shared") {
          try {
            const sharedProfile = readSharedProfile(project.projectId);
            if (sharedProfile.entries.length > 0) {
              const sharedBlock = formatSharedProfileForPrompt(
                sharedProfile,
                SHARED_MEMORY_MAX_PROMPT_CHARS,
                ctx.agentId, // Exclude entries written by this agent
              );
              if (sharedBlock) {
                parts.push(
                  `<team-shared-memory>\n${sharedBlock}\n</team-shared-memory>`,
                );
              }
            }
          } catch (err) {
            logger.warn?.(
              `[SharedMemory] Failed to read shared profile: ${err}`,
            );
          }
        }

        // 3. Activity summary for supervisor (team situational awareness)
        // Injected before workflow instructions so supervisor sees team
        // state before deciding on decomposition strategy.
        if (isSupervisor(project, ctx.agentId)) {
          const buf = activityBuffers.get(project.projectId);
          if (buf && buf.length > 0) {
            const nameMap = getMemberNameMap(project);
            const summary = formatActivitySummary(buf, nameMap);
            if (summary) {
              parts.push(`<team-status>\n${summary}\n</team-status>`);
            }
          }
        }

        // 4. Learning context for supervisor (data-driven routing guidance)
        if (isSupervisor(project, ctx.agentId)) {
          const analysis = learningCache.get(project.projectId);
          const sMap = getOrCreateStatsMap(project.projectId, project.memberIds);
          const hMap = getOrCreateHealthMap(project.projectId, project.memberIds);
          const learningCtx = buildSupervisorLearningContext(project, analysis, sMap, hMap);
          if (learningCtx) {
            parts.push(`<team-learning>\n${learningCtx}\n</team-learning>`);
          }
        }

        // 5. Template workflow detection (supervisor only)
        // When the supervisor's resolve_agent saw no fast-path match,
        // it cached the user message. If it matches a template workflow,
        // inject decomposition instructions (zero LLM cost for recognition).
        if (
          isSupervisor(project, ctx.agentId) &&
          (project.taskCoordination?.templateWorkflowsEnabled !== false)
        ) {
          const cachedMessage = lastSupervisorMessage.get(ctx.agentId);
          if (cachedMessage) {
            lastSupervisorMessage.delete(ctx.agentId); // Consume once
            const workflow = matchWorkflow(cachedMessage);
            if (workflow) {
              const nonSupervisorMembers = project.members.filter(
                (m) => m.id !== project.supervisorId,
              );
              const instructions = generateWorkflowInstructions(
                workflow,
                nonSupervisorMembers,
              );
              parts.push(instructions);
              logger.info?.(
                `[TaskCoordinator] Matched workflow "${workflow.id}" for supervisor ${ctx.agentId}`,
              );
            }
          }
        }

        if (parts.length === 0) return;
        return { prependContext: parts.join("\n\n") };
      },
      { priority: 50 },
    );

    // ── agent_end: track member health + auto-promote shared memory ────
    api.on("agent_end", async (event, ctx) => {
      if (!ctx.agentId) return;

      const project = findProjectByAgentId(ctx.agentId);
      if (!project) return;

      const healthMap = getOrCreateHealthMap(
        project.projectId,
        project.memberIds,
      );
      const current = healthMap.get(ctx.agentId);
      if (!current) return;

      const updated = event.success
        ? recordMemberSuccess(current)
        : recordMemberFailure(current, event.error);

      healthMap.set(ctx.agentId, updated);

      // Track stats
      const sMap = getOrCreateStatsMap(project.projectId, project.memberIds);
      const currentStats = sMap.get(ctx.agentId);
      if (currentStats) {
        sMap.set(ctx.agentId, recordMemberCall(currentStats, event.durationMs));
      }

      // NOTE: PluginHookAgentContext does NOT include peerId.
      // Peer→agent mapping is maintained by resolve_agent hook.

      // Finalize pending activity event from resolve_agent
      const pending = pendingRouteEvents.get(ctx.agentId);
      const isSuccess = event.success ?? true;
      const outcome: ActivityEvent["outcome"] = isSuccess
        ? "success"
        : (event.durationMs != null &&
            event.durationMs >= (project.coordination.memberTimeoutSeconds * 1000))
          ? "timeout"
          : "failure";

      if (pending) {
        pendingRouteEvents.delete(ctx.agentId);
        const finalEvent: ActivityEvent = {
          ...pending.event,
          durationMs: Date.now() - pending.startTime,
          success: isSuccess,
          error: event.error,
          replySummary: undefined,
          taskType: "routing",
          outcome,
        };
        pushActivityEvent(pending.projectId, finalEvent);
      } else {
        // Supervisor LLM fallback — no fast-path routing happened
        const isSup = isSupervisor(project, ctx.agentId);
        pushActivityEvent(project.projectId, {
          id: nextActivityId(),
          timestamp: Date.now(),
          agentId: ctx.agentId,
          method: "supervisor-llm",
          confidence: 1,
          durationMs: event.durationMs,
          success: isSuccess,
          error: event.error,
          replySummary: undefined,
          taskType: isSup ? "direct-reply" : "fallback",
          outcome,
        });
      }

      // Persist state asynchronously (best-effort)
      const state: ProjectState = {
        projectId: project.projectId,
        memberHealth: [...healthMap.values()],
        memberStats: [...sMap.values()],
        activeSessions: 0,
        lastActivityAt: new Date().toISOString(),
      };
      saveProjectState(state).catch((err) => {
        logger.warn?.(`Failed to persist health state: ${err}`);
      });

      // Auto-promote high-hit private entries to shared pool (fire-and-forget)
      if (
        project.status === "active" &&
        project.memory.mode === "read-shared" &&
        event.success &&
        ctx.workspaceDir
      ) {
        autoPromoteEntries({
          projectId: project.projectId,
          agentId: ctx.agentId,
          workspaceDir: ctx.workspaceDir,
          sharedCategories: project.memory
            .sharedCategories as SharedCategory[] | undefined,
        }).catch((err) => {
          logger.warn?.(
            `[SharedMemory] Auto-promote failed: ${err}`,
          );
        });
      }

      // Learning cycle trigger (fire-and-forget)
      if (project.status === "active") {
        const count = (eventsSinceLastLearning.get(project.projectId) ?? 0) + 1;
        eventsSinceLastLearning.set(project.projectId, count);

        if (shouldTriggerLearning(count)) {
          try {
            // Snapshot the buffer to avoid concurrent mutation during analysis
            const buf = [...(activityBuffers.get(project.projectId) ?? [])];
            const analysis = analyzeLearningOpportunities(
              project.projectId,
              buf,
              healthMap,
              sMap,
              project,
            );
            learningCache.set(project.projectId, analysis);

            // Apply safe auto-optimizations (keyword routing only)
            if (analysis.insights.length > 0) {
              const { updatedProject, appliedChanges } = applyAutoOptimizations(project, analysis);
              if (appliedChanges.length > 0) {
                await saveProject(updatedProject);
                projectCache.set(project.projectId, updatedProject);
                logger.info?.(
                  `[Learning] Auto-optimized "${project.name}": ${appliedChanges.join("; ")}`,
                );
              }
            }
          } catch (err) {
            logger.warn?.(`[Learning] Analysis failed for "${project.name}": ${err}`);
          } finally {
            // Reset counter in finally — ensures reset even if analysis throws
            eventsSinceLastLearning.set(project.projectId, 0);
          }
        }
      }
    });

    // ── message_sending: rewrite outbound messages for visibility mode ──
    // Peer→agent mapping is set by resolve_agent hook (the only hook with peerId).
    // When fast path routes a message, resolve_agent records peerId→agentId.
    // message_sending then uses event.to (= same peer address) to look up the agent.
    // When resolve_agent doesn't fire (Supervisor LLM fallback), no mapping exists
    // and the hook is a no-op — acceptable since Supervisor handles its own responses.
    api.on(
      "message_sending",
      async (event, _ctx) => {
        // Identify the agent via peer mapping.
        // event.to is the destination channel address (= peerId/From in resolve_agent).
        // PluginHookMessageContext does NOT include peerId, so we rely on event.to.
        const peerId = event.to;
        if (!peerId) return;

        const agentId = lastAgentForPeer.get(peerId);
        if (!agentId) return;

        const project = findProjectByAgentId(agentId);
        if (!project || project.status !== "active") return;

        // Only rewrite if the project uses a non-default visibility
        // (team mode without displayName is pass-through, skip rewrite)
        if (
          project.visibility.mode === "team" &&
          !project.visibility.displayName
        ) {
          return;
        }

        const result = rewriteOutboundMessage({
          content: event.content ?? "",
          project,
          agentId,
        });

        if (result.cancel) return { cancel: true };
        if (result.content !== (event.content ?? "")) {
          return { content: result.content };
        }
      },
      { priority: 40 },
    );

    // ── memory_share tool: available to agents in read-shared projects ──
    api.registerTool(
      (ctx) => {
        if (!ctx.agentId) return null;
        const project = findProjectByAgentId(ctx.agentId);
        if (!project || project.status !== "active") return null;
        if (project.memory.mode !== "read-shared") return null;
        return createMemoryShareTool({
          projectId: project.projectId,
          agentId: ctx.agentId,
        });
      },
      { name: "memory_share", optional: true },
    );

    // ── gateway_start: load projects from disk ────────────────────────
    api.on("gateway_start", async () => {
      try {
        const projects = await loadAllProjects();
        for (const p of projects) {
          projectCache.set(p.projectId, p);

          // Restore health + stats state from disk
          const state = await loadProjectState(p.projectId);
          if (state?.memberHealth) {
            const map = new Map<string, MemberHealth>();
            for (const h of state.memberHealth) {
              map.set(h.agentId, h);
            }
            healthCache.set(p.projectId, map);
          }
          if (state?.memberStats) {
            const sMap = new Map<string, MemberStats>();
            for (const s of state.memberStats) {
              sMap.set(s.agentId, s);
            }
            statsCache.set(p.projectId, sMap);
          }

          // Restore persisted activity events
          const saved = await loadActivity(p.projectId);
          if (saved.length > 0) {
            activityBuffers.set(p.projectId, saved as ActivityEvent[]);
          }
        }
        rebuildAgentIndex();
        logger.info(
          `Loaded ${projects.length} project(s) from disk.`,
        );
      } catch (err) {
        logger.error(`Failed to load projects on startup: ${err}`);
      } finally {
        // Signal that projectCache is populated — gateway methods can proceed.
        cacheReadyResolve();
      }
    });

    // ═══════════════════════════════════════════════════════════════════
    // GATEWAY METHODS
    // ═══════════════════════════════════════════════════════════════════

    // ── team.project.list ─────────────────────────────────────────────
    api.registerGatewayMethod("team.project.list", async ({ respond }) => {
      await cacheReady;
      const projects = [...projectCache.values()].map((p) => ({
        projectId: p.projectId,
        name: p.name,
        description: p.description,
        status: p.status,
        memberCount: p.memberIds.length,
        memberIds: p.memberIds,
        supervisorId: p.supervisorId,
        autoSupervisor: p.autoSupervisor ?? false,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        version: p.version,
        bindings: p.bindings,
        isFederation: p.isFederation ?? false,
        parentProjectId: p.parentProjectId,
      }));
      respond(true, { projects }, undefined);
    });

    // ── team.project.get ──────────────────────────────────────────────
    api.registerGatewayMethod(
      "team.project.get",
      async ({ params, respond }) => {
        await cacheReady;
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");

        let project = projectCache.get(projectId);

        // Fallback: try loading from disk if not in cache (e.g. newly deployed)
        if (!project) {
          const fromDisk = await loadProject(projectId);
          if (fromDisk) {
            projectCache.set(fromDisk.projectId, fromDisk);
            rebuildAgentIndex();
            project = fromDisk;
          }
        }

        if (!project) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`,
          });
          return;
        }

        const state = await loadProjectState(projectId);
        respond(true, { project, state }, undefined);
      },
    );

    // ── team.project.create ───────────────────────────────────────────
    api.registerGatewayMethod(
      "team.project.create",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;

        const name = String(p.name ?? "").trim();
        const description = String(p.description ?? "").trim();
        const supervisorId = String(p.supervisorId ?? "").trim();
        const memberIds = Array.isArray(p.memberIds)
          ? (p.memberIds as unknown[]).filter((v): v is string => typeof v === "string" && v.trim() !== "").map(s => s.trim())
          : [];
        const members = Array.isArray(p.members)
          ? (p.members as unknown[])
              .filter((m): m is MemberInfo =>
                typeof m === "object" && m !== null &&
                typeof (m as Record<string, unknown>).id === "string" &&
                typeof (m as Record<string, unknown>).name === "string" &&
                typeof (m as Record<string, unknown>).role === "string",
              )
              .map(m => ({ id: m.id, name: m.name, role: m.role, ...(typeof m.emoji === "string" ? { emoji: m.emoji } : {}) }))
          : memberIds.map((id) => ({
              id,
              name: id,
              role: "",
            }));

        if (!name || !supervisorId || memberIds.length === 0) {
          respond(false, undefined, {
            code: "INVALID_PARAMS",
            message:
              "Required: name, supervisorId, memberIds (non-empty array)",
          });
          return;
        }

        // Ensure supervisor is in memberIds
        if (!memberIds.includes(supervisorId)) {
          memberIds.unshift(supervisorId);
        }

        // Enforce maxMembers limit
        const MAX_MEMBERS = 8;
        if (memberIds.length > MAX_MEMBERS) {
          respond(false, undefined, {
            code: "INVALID_PARAMS",
            message: `Too many members (${memberIds.length}). Maximum is ${MAX_MEMBERS}.`,
          });
          return;
        }

        const now = new Date().toISOString();
        const project: Project = {
          projectId: generateProjectId(),
          name,
          description: description || name,
          status: "active",
          version: 1,
          createdAt: now,
          updatedAt: now,
          supervisorId,
          memberIds,
          members,
          memory: {
            mode: (p.memoryMode === "read-shared" ? "read-shared" : "isolated"),
            ...(Array.isArray(p.sharedCategories)
              ? {
                  sharedCategories: (p.sharedCategories as string[]).filter(
                    (c): c is SharedCategory =>
                      c === "fact" || c === "identity" || c === "preference",
                  ),
                }
              : {}),
          },
          coordination: {
            supervisorStyle:
              p.supervisorStyle === "delegate-only"
                ? "delegate-only"
                : "concierge",
            maxMembers: 8,
            hopLimit: 5,
            memberTimeoutSeconds: 30,
            supervisorFallbackEnabled: true,
            ...(p.handoffStyle === "silent" ||
            p.handoffStyle === "notify" ||
            p.handoffStyle === "introduce"
              ? { handoffStyle: p.handoffStyle }
              : {}),
          },
          visibility: {
            mode:
              p.visibilityMode === "unified"
                ? "unified"
                : p.visibilityMode === "transparent"
                  ? "transparent"
                  : "team",
            ...(typeof p.displayName === "string"
              ? { displayName: p.displayName }
              : {}),
          },
          constraints: extractConstraints(p.constraints),
          bindings: [],
        };

        try {
          await saveProject(project);

          // Update caches
          projectCache.set(project.projectId, project);
          rebuildAgentIndex();

          // Initialize health
          getOrCreateHealthMap(project.projectId, memberIds);

          // Write supervisor SOUL.md
          const nonSupervisor = members.filter(
            (m) => m.id !== supervisorId,
          );
          const soul = generateSupervisorSoul(project, nonSupervisor);
          try {
            await callGateway("agents.files.set", {
              agentId: supervisorId,
              name: "SOUL.md",
              content: soul,
            });
          } catch {
            // Non-fatal
          }

          respond(true, { project }, undefined);
        } catch (err) {
          respond(false, undefined, {
            code: "CREATE_FAILED",
            message:
              err instanceof Error ? err.message : String(err),
          });
        }
      },
    );

    // ── team.project.createFromPlan ───────────────────────────────────
    api.registerGatewayMethod(
      "team.project.createFromPlan",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;
        const planId = String(p.planId ?? "").trim();

        if (!planId) {
          respond(false, undefined, {
            code: "INVALID_PARAMS",
            message: "Required: planId",
          });
          return;
        }

        // Idempotency: check if a project with this sourcePlanId already exists
        const existingProject = [...projectCache.values()].find(
          (proj) => proj.sourcePlanId === planId,
        );
        if (existingProject) {
          respond(true, { project: existingProject, deduplicated: true }, undefined);
          return;
        }

        try {
          console.log(`[agent-team] createFromPlan called with planId="${planId}", orchestratorStateDir="${orchestratorStateDir}"`);
          const { project, report } = await createProjectFromPlan(callGateway, {
            planId,
            name: typeof p.name === "string" ? p.name : undefined,
            constraints: extractConstraints(p.constraints),
            orchestratorStateDir,
          });
          console.log(`[agent-team] createFromPlan SUCCESS: projectId="${project.projectId}", members=${project.memberIds.length}`);

          // Update caches
          projectCache.set(project.projectId, project);
          rebuildAgentIndex();
          getOrCreateHealthMap(
            project.projectId,
            project.memberIds,
          );

          respond(true, { project, report }, undefined);
        } catch (err) {
          console.error(`[agent-team] createFromPlan FAILED: ${err instanceof Error ? err.message : String(err)}`);
          console.error(`[agent-team] createFromPlan stack:`, err instanceof Error ? err.stack : "no stack");
          respond(false, undefined, {
            code: "CREATE_FROM_PLAN_FAILED",
            message:
              err instanceof Error ? err.message : String(err),
          });
        }
      },
    );

    // ── team.project.update ───────────────────────────────────────────
    api.registerGatewayMethod(
      "team.project.update",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`,
          });
          return;
        }

        // Apply partial update
        const updatedMemory = { ...project.memory };
        if (p.memoryMode === "read-shared" || p.memoryMode === "isolated") {
          updatedMemory.mode = p.memoryMode;
        }
        if (Array.isArray(p.sharedCategories)) {
          updatedMemory.sharedCategories = (p.sharedCategories as string[]).filter(
            (c): c is SharedCategory =>
              c === "fact" || c === "identity" || c === "preference",
          );
        }

        // Explicitly extract allowed coordination fields to prevent
        // injection of arbitrary keys (e.g. prototype pollution payloads).
        const coordPatch: Partial<Project["coordination"]> = {};
        if (typeof p.coordination === "object" && p.coordination) {
          const c = p.coordination as Record<string, unknown>;
          if (c.supervisorStyle === "concierge" || c.supervisorStyle === "delegate-only") {
            coordPatch.supervisorStyle = c.supervisorStyle;
          }
          if (typeof c.hopLimit === "number" && c.hopLimit > 0) {
            coordPatch.hopLimit = Math.min(c.hopLimit, 20);
          }
          if (typeof c.memberTimeoutSeconds === "number" && c.memberTimeoutSeconds > 0) {
            coordPatch.memberTimeoutSeconds = Math.min(c.memberTimeoutSeconds, 300);
          }
          if (typeof c.supervisorFallbackEnabled === "boolean") {
            coordPatch.supervisorFallbackEnabled = c.supervisorFallbackEnabled;
          }
          if (c.handoffStyle === "silent" || c.handoffStyle === "notify" || c.handoffStyle === "introduce") {
            coordPatch.handoffStyle = c.handoffStyle;
          }
          // FastPath sub-object
          if (typeof c.fastPath === "object" && c.fastPath) {
            const fp = c.fastPath as Record<string, unknown>;
            const existingFp: FastPathConfig = project.coordination.fastPath ?? {
              sessionAffinityEnabled: false,
              affinityTimeoutMinutes: 30,
              keywordConfidenceThreshold: 0.6,
            };
            const fpPatch: FastPathConfig = { ...existingFp };
            if (typeof fp.sessionAffinityEnabled === "boolean") {
              fpPatch.sessionAffinityEnabled = fp.sessionAffinityEnabled;
            }
            if (typeof fp.affinityTimeoutMinutes === "number" && fp.affinityTimeoutMinutes > 0) {
              fpPatch.affinityTimeoutMinutes = Math.min(fp.affinityTimeoutMinutes, 1440);
            }
            if (typeof fp.keywordConfidenceThreshold === "number") {
              fpPatch.keywordConfidenceThreshold = Math.max(0, Math.min(1, fp.keywordConfidenceThreshold));
            }
            coordPatch.fastPath = fpPatch;
          }
        }

        // Explicitly extract allowed visibility fields
        const visPatch: Partial<Project["visibility"]> = {};
        if (typeof p.visibility === "object" && p.visibility) {
          const v = p.visibility as Record<string, unknown>;
          if (v.mode === "unified" || v.mode === "team" || v.mode === "transparent") {
            visPatch.mode = v.mode;
          }
          if (typeof v.displayName === "string") {
            visPatch.displayName = v.displayName;
          }
          if (typeof v.displayEmoji === "string") {
            visPatch.displayEmoji = v.displayEmoji;
          }
        }

        // Bindings update (channel-to-project routing)
        let updatedBindings = project.bindings;
        if (Array.isArray(p.bindings)) {
          updatedBindings = (p.bindings as Array<Record<string, unknown>>)
            .filter(
              (b) => typeof b.channel === "string" && b.channel.length > 0,
            )
            .map((b) => ({
              channel: String(b.channel),
              ...(typeof b.accountId === "string"
                ? { accountId: b.accountId }
                : {}),
              ...(typeof b.peer === "string" ? { peer: b.peer } : {}),
            }));
        }

        // supervisorId update (must be a valid member)
        let updatedSupervisorId = project.supervisorId;
        if (typeof p.supervisorId === "string" && p.supervisorId.length > 0) {
          const memberIds = Array.isArray(p.memberIds)
            ? (p.memberIds as string[])
            : project.memberIds;
          if (memberIds.includes(p.supervisorId)) {
            updatedSupervisorId = p.supervisorId;
          }
        }

        // Merge constraints instead of replacing — so updating one field
        // (e.g. userAddress) doesn't erase the others (forbidden, safetyRules).
        let updatedConstraints = project.constraints;
        if (p.constraints !== undefined) {
          const patch = extractConstraints(p.constraints);
          if (patch) {
            const existingBr = project.constraints?.brandRules ?? {};
            updatedConstraints = {
              brandRules: { ...existingBr, ...patch.brandRules },
            };
          }
        }

        // memberIds / members update (used by addProjectMember / removeProjectMember)
        let updatedMemberIds = project.memberIds;
        let updatedMembers = project.members;
        if (Array.isArray(p.memberIds)) {
          updatedMemberIds = (p.memberIds as string[]).filter(
            (v) => typeof v === "string" && v.trim() !== "",
          );
        }
        if (Array.isArray(p.members)) {
          updatedMembers = (p.members as MemberInfo[]);
        }

        const updated: Project = {
          ...project,
          name:
            typeof p.name === "string" ? p.name : project.name,
          description:
            typeof p.description === "string"
              ? p.description
              : project.description,
          memberIds: updatedMemberIds,
          members: updatedMembers,
          supervisorId: updatedSupervisorId,
          constraints: updatedConstraints,
          memory: updatedMemory,
          coordination: { ...project.coordination, ...coordPatch },
          visibility: { ...project.visibility, ...visPatch },
          bindings: updatedBindings,
          version: project.version + 1,
          updatedAt: new Date().toISOString(),
        };

        try {
          await saveProject(updated);
          projectCache.set(projectId, updated);
          rebuildAgentIndex();

          // Regenerate SOUL if relevant fields changed
          const soulAffected =
            updated.supervisorId !== project.supervisorId ||
            JSON.stringify(updated.members) !== JSON.stringify(project.members) ||
            JSON.stringify(updated.constraints) !== JSON.stringify(project.constraints) ||
            updated.coordination.supervisorStyle !== project.coordination.supervisorStyle ||
            updated.coordination.hopLimit !== project.coordination.hopLimit ||
            updated.coordination.handoffStyle !== project.coordination.handoffStyle ||
            updated.visibility.mode !== project.visibility.mode ||
            updated.visibility.displayName !== project.visibility.displayName;

          if (soulAffected) {
            const nonSupervisor = updated.members.filter(
              (m) => m.id !== updated.supervisorId,
            );
            const soul = generateSupervisorSoul(updated, nonSupervisor);
            callGateway("agents.files.set", {
              agentId: updated.supervisorId,
              name: "SOUL.md",
              content: soul,
            }).catch((err) =>
              logger.warn?.(`[agent-team] SOUL regen failed: ${err}`),
            );
          }

          respond(true, { project: updated }, undefined);
        } catch (err) {
          respond(false, undefined, {
            code: "UPDATE_FAILED",
            message:
              err instanceof Error ? err.message : String(err),
          });
        }
      },
    );

    // ── team.project.delete ───────────────────────────────────────────
    api.registerGatewayMethod(
      "team.project.delete",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");
        const deleteAgents = p.deleteAgents === true;

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`,
          });
          return;
        }

        try {
          // Always delete auto-created supervisor (it was created by deploy-bridge,
          // not by the user). User-created worker agents are only deleted if requested.
          if (project.autoSupervisor) {
            try {
              await callGateway("agents.remove", {
                agentId: project.supervisorId,
              });
            } catch {
              // Best-effort: supervisor may already be deleted
            }
          }

          // Optionally delete member agents (worker agents)
          if (deleteAgents) {
            for (const memberId of project.memberIds) {
              // Skip supervisor if already deleted above
              if (project.autoSupervisor && memberId === project.supervisorId) continue;
              try {
                await callGateway("agents.remove", {
                  agentId: memberId,
                });
              } catch {
                // Best-effort: some agents may already be deleted
              }
            }
          }

          // ── Clean up federation cross-references ──────────────────
          // If this is a child in a federation: remove from parent's childProjectIds + members
          if (project.parentProjectId) {
            const parent = projectCache.get(project.parentProjectId);
            if (parent && parent.isFederation) {
              const updatedParent: Project = {
                ...parent,
                childProjectIds: (parent.childProjectIds ?? []).filter(
                  (id) => id !== projectId,
                ),
                memberIds: parent.memberIds.filter(
                  (id) => id !== project.supervisorId,
                ),
                members: parent.members.filter(
                  (m) => m.id !== project.supervisorId,
                ),
                version: parent.version + 1,
                updatedAt: new Date().toISOString(),
              };
              await saveProject(updatedParent);
              projectCache.set(parent.projectId, updatedParent);
              // Regenerate parent supervisor SOUL with updated member list
              const parentMembers = updatedParent.members.filter(
                (m) => m.id !== updatedParent.supervisorId,
              );
              const soul = generateSupervisorSoul(updatedParent, parentMembers);
              callGateway("agents.files.set", {
                agentId: updatedParent.supervisorId,
                name: "SOUL.md",
                content: soul,
              }).catch(() => {});
            }
          }

          // If this is a federation: clear parentProjectId on all child projects
          if (project.isFederation && project.childProjectIds?.length) {
            for (const childId of project.childProjectIds) {
              const child = projectCache.get(childId);
              if (child && child.parentProjectId === projectId) {
                const updatedChild: Project = {
                  ...child,
                  parentProjectId: undefined,
                  version: child.version + 1,
                  updatedAt: new Date().toISOString(),
                };
                await saveProject(updatedChild);
                projectCache.set(childId, updatedChild);
              }
            }
          }

          // Remove from disk + cache + affinity + route table + peer mapping + activity
          await deleteProject(projectId);
          projectCache.delete(projectId);
          healthCache.delete(projectId);
          statsCache.delete(projectId);
          memberNameMapCache.delete(projectId);
          activityBuffers.delete(projectId);
          const pendingSaveTimer = activitySaveTimers.get(projectId);
          if (pendingSaveTimer) {
            clearTimeout(pendingSaveTimer);
            activitySaveTimers.delete(projectId);
          }
          // Clean pendingRouteEvents for agents belonging to this project
          for (const [key, val] of pendingRouteEvents) {
            if (val.projectId === projectId) pendingRouteEvents.delete(key);
          }
          // Clean cached supervisor message
          lastSupervisorMessage.delete(project.supervisorId);
          clearPeerAgentEntriesForProject(project);
          clearProjectAffinities(projectId);
          clearRouteTable(projectId);
          rebuildAgentIndex();

          respond(true, { success: true }, undefined);
        } catch (err) {
          respond(false, undefined, {
            code: "DELETE_FAILED",
            message:
              err instanceof Error ? err.message : String(err),
          });
        }
      },
    );

    // ── team.federation.create ───────────────────────────────────────
    // Creates a federation meta-project from existing child projects.
    // The meta-supervisor routes to child project supervisors via fast-path,
    // and child supervisors route to their members — two-level zero-token cascade.
    api.registerGatewayMethod(
      "team.federation.create",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;

        const name = String(p.name ?? "").trim();
        const description = String(p.description ?? "").trim();
        const metaSupervisorId = String(p.metaSupervisorId ?? "").trim();
        const childProjectIds = Array.isArray(p.childProjectIds)
          ? (p.childProjectIds as unknown[])
              .filter((v): v is string => typeof v === "string" && v.trim() !== "")
              .map((s) => s.trim())
          : [];

        if (!name || !metaSupervisorId || childProjectIds.length === 0) {
          respond(false, undefined, {
            code: "INVALID_PARAMS",
            message: "Required: name, metaSupervisorId, childProjectIds (non-empty array)",
          });
          return;
        }

        // Validate all child projects exist and are active
        const childProjects: Project[] = [];
        for (const cid of childProjectIds) {
          const cp = projectCache.get(cid);
          if (!cp) {
            respond(false, undefined, {
              code: "NOT_FOUND",
              message: `Child project "${cid}" not found`,
            });
            return;
          }
          if (cp.status !== "active") {
            respond(false, undefined, {
              code: "INVALID_STATE",
              message: `Child project "${cid}" is not active (status: ${cp.status})`,
            });
            return;
          }
          childProjects.push(cp);
        }

        // ── Federation integrity guards ──────────────────────────────
        // Guard: metaSupervisorId must not be a supervisor of any child project
        for (const cp of childProjects) {
          if (cp.supervisorId === metaSupervisorId) {
            respond(false, undefined, {
              code: "INVALID_PARAMS",
              message: `metaSupervisorId "${metaSupervisorId}" is already the supervisor of child project "${cp.projectId}". Use a dedicated agent as meta-supervisor.`,
            });
            return;
          }
        }

        // Guard: child project must not already belong to another federation
        for (const cp of childProjects) {
          if (cp.parentProjectId) {
            respond(false, undefined, {
              code: "INVALID_STATE",
              message: `Child project "${cp.projectId}" already belongs to federation "${cp.parentProjectId}"`,
            });
            return;
          }
        }

        // Guard: child project must not itself be a federation (no nested federations)
        for (const cp of childProjects) {
          if (cp.isFederation) {
            respond(false, undefined, {
              code: "INVALID_STATE",
              message: `Child project "${cp.projectId}" is itself a federation. Nested federations are not supported.`,
            });
            return;
          }
        }

        // Build members from child project supervisors
        // Each child supervisor becomes a "member" of the federation,
        // with role = child project description (for keyword routing).
        // Dedup by supervisor ID: if two child projects share a supervisor,
        // merge their descriptions into one role string.
        const memberIds = [metaSupervisorId];
        const members: MemberInfo[] = [];
        for (const cp of childProjects) {
          if (!memberIds.includes(cp.supervisorId)) {
            memberIds.push(cp.supervisorId);
          }
          // Find supervisor info from child project's members list
          const supervisorInfo = cp.members.find(
            (m) => m.id === cp.supervisorId,
          );
          const existing = members.find((m) => m.id === cp.supervisorId);
          if (existing) {
            // Shared supervisor: merge role descriptions
            existing.role += `; ${cp.description}`;
            existing.name += ` / ${cp.name}`;
          } else {
            members.push({
              id: cp.supervisorId,
              name: cp.name, // Use project name, not agent name
              role: cp.description, // Key: project description drives keyword routing
              emoji: supervisorInfo?.emoji,
            });
          }
        }

        const now = new Date().toISOString();
        const project: Project = {
          projectId: generateProjectId(),
          name,
          description: description || name,
          status: "active",
          version: 1,
          createdAt: now,
          updatedAt: now,
          supervisorId: metaSupervisorId,
          memberIds,
          members,
          memory: { mode: "isolated" },
          coordination: {
            supervisorStyle: "delegate-only", // Meta-supervisor always delegates
            maxMembers: 20, // Federations can be larger
            hopLimit: 3, // meta-sup → child-sup → member = 2 hops max
            memberTimeoutSeconds: 30,
            supervisorFallbackEnabled: true,
          },
          visibility: {
            mode: "unified", // Federation is invisible to end users
            displayName: typeof p.displayName === "string" ? p.displayName : undefined,
          },
          constraints: extractConstraints(p.constraints),
          bindings: [],
          isFederation: true,
          childProjectIds,
        };

        try {
          await saveProject(project);

          // Mark child projects as belonging to this federation
          for (const cp of childProjects) {
            const updated: Project = {
              ...cp,
              parentProjectId: project.projectId,
              version: cp.version + 1,
              updatedAt: now,
            };
            await saveProject(updated);
            projectCache.set(cp.projectId, updated);
          }

          // Update caches
          projectCache.set(project.projectId, project);
          rebuildAgentIndex();
          getOrCreateHealthMap(project.projectId, memberIds);

          // Generate meta-supervisor SOUL.md
          // members here are child project supervisors with role = project description
          const soul = generateSupervisorSoul(project, members);
          try {
            await callGateway("agents.files.set", {
              agentId: metaSupervisorId,
              name: "SOUL.md",
              content: soul,
            });
          } catch {
            // Non-fatal
          }

          const warnings: string[] = [];
          if (project.bindings.length === 0) {
            warnings.push(
              "Federation created with no channel bindings. " +
              "Use team.project.update to add bindings, or assign the " +
              "meta-supervisor agent directly to a channel.",
            );
          }

          respond(true, { project, warnings }, undefined);
        } catch (err) {
          respond(false, undefined, {
            code: "CREATE_FEDERATION_FAILED",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      },
    );

    // ── team.shared-memory.list ────────────────────────────────────────
    api.registerGatewayMethod(
      "team.shared-memory.list",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`,
          });
          return;
        }

        if (project.memory.mode !== "read-shared") {
          respond(false, undefined, {
            code: "NOT_SHARED",
            message: `Project "${projectId}" is not in read-shared memory mode`,
          });
          return;
        }

        const sharedProfile = readSharedProfile(projectId);
        respond(
          true,
          { entries: sharedProfile.entries, count: sharedProfile.entries.length },
          undefined,
        );
      },
    );

    // ── team.shared-memory.clear ────────────────────────────────────────
    api.registerGatewayMethod(
      "team.shared-memory.clear",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`,
          });
          return;
        }

        if (project.memory.mode !== "read-shared") {
          respond(false, undefined, {
            code: "NOT_SHARED",
            message: `Project "${projectId}" is not in read-shared memory mode`,
          });
          return;
        }

        try {
          writeSharedProfile(projectId, { version: 1, entries: [] });
          respond(true, { success: true }, undefined);
        } catch (err) {
          respond(false, undefined, {
            code: "CLEAR_FAILED",
            message:
              err instanceof Error ? err.message : String(err),
          });
        }
      },
    );

    // ── team.project.health ────────────────────────────────────────────
    api.registerGatewayMethod(
      "team.project.health",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`,
          });
          return;
        }

        const healthMap = getOrCreateHealthMap(
          projectId,
          project.memberIds,
        );
        const members = [...healthMap.values()].map((h) => ({
          agentId: h.agentId,
          state: h.state,
          totalSuccesses: h.totalSuccesses,
          totalFailures: h.totalFailures,
          lastError: h.lastError ?? null,
          lastSuccessAt: h.lastSuccessAt ?? null,
          lastFailureAt: h.lastFailureAt ?? null,
        }));

        respond(
          true,
          { projectId, status: project.status, members },
          undefined,
        );
      },
    );

    // ── team.project.stats ──────────────────────────────────────────────
    api.registerGatewayMethod(
      "team.project.stats",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`,
          });
          return;
        }

        const sMap = getOrCreateStatsMap(projectId, project.memberIds);
        const members = [...sMap.values()].map((s) => ({
          agentId: s.agentId,
          callCount: s.callCount,
          totalDurationMs: s.totalDurationMs,
          avgDurationMs: computeAverageDuration(s),
          lastCallAt: s.lastCallAt ?? null,
        }));

        const totalCalls = members.reduce((sum, m) => sum + m.callCount, 0);
        const totalDuration = members.reduce(
          (sum, m) => sum + m.totalDurationMs,
          0,
        );

        respond(
          true,
          {
            projectId,
            members,
            totalCalls,
            avgDurationMs:
              totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
          },
          undefined,
        );
      },
    );

    // ── team.project.activity ──────────────────────────────────────────
    api.registerGatewayMethod(
      "team.project.activity",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");
        const limit = Math.min(Number(p.limit ?? 50), ACTIVITY_BUFFER_MAX);

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`,
          });
          return;
        }

        const buf = activityBuffers.get(projectId) ?? [];
        // Return latest events first (newest at index 0)
        const events = buf.slice(-limit).reverse();

        // Enrich events with agent names from the project's members list
        const enriched = events.map((ev) => {
          const member = project.members?.find((m) => m.id === ev.agentId);
          return {
            ...ev,
            agentName: member?.name ?? ev.agentId,
            agentEmoji: member?.emoji,
          };
        });

        respond(true, { projectId, events: enriched }, undefined);
      },
    );

    // ── team.project.files.list ──────────────────────────────────────
    api.registerGatewayMethod(
      "team.project.files.list",
      async ({ params, respond }) => {
        await cacheReady;
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`,
          });
          return;
        }

        // Top-level imports (cached by Node module system after first call)
        const fsP = await import("node:fs/promises");
        const pathMod = await import("node:path");

        const SCAN_EXTENSIONS = new Set([
          ".md", ".csv", ".json", ".txt", ".png", ".jpg", ".jpeg",
          ".html", ".pdf", ".xlsx", ".docx", ".log",
        ]);
        const SYSTEM_FILES = new Set([
          "SOUL.md", "IDENTITY.md", "MEMORY.md", "MEMORY.jsonl",
          "CONFIG.yaml", "CONFIG.json",
        ]);
        const MAX_FILES_PER_AGENT = 50;
        const MAX_DEPTH = 2;

        type FileEntry = { name: string; size?: number; updatedAtMs?: number };

        /** Recursively scan a directory for user-created files. */
        const scanWorkspace = async (workspaceDir: string): Promise<FileEntry[]> => {
          const files: FileEntry[] = [];
          const scanDir = async (dir: string, depth: number) => {
            if (depth >= MAX_DEPTH || files.length >= MAX_FILES_PER_AGENT) return;
            let entries;
            try { entries = await fsP.readdir(dir, { withFileTypes: true }); } catch { return; }
            for (const entry of entries) {
              if (files.length >= MAX_FILES_PER_AGENT) break;
              // Skip symlinks to prevent infinite loops
              if (entry.isSymbolicLink()) continue;
              const fullPath = pathMod.join(dir, entry.name);
              if (entry.isDirectory()) {
                if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
                await scanDir(fullPath, depth + 1);
              } else if (entry.isFile()) {
                const ext = pathMod.extname(entry.name).toLowerCase();
                if (depth === 0 && (SYSTEM_FILES.has(entry.name) || entry.name.startsWith("."))) continue;
                if (SCAN_EXTENSIONS.has(ext)) {
                  try {
                    const st = await fsP.stat(fullPath);
                    files.push({
                      name: depth === 0 ? entry.name : pathMod.relative(workspaceDir, fullPath).replace(/\\/g, "/"),
                      size: st.size,
                      updatedAtMs: st.mtimeMs,
                    });
                  } catch {
                    files.push({ name: entry.name });
                  }
                }
              }
            }
          };
          await scanDir(workspaceDir, 0);
          files.sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0));
          return files;
        };

        // Scan all members in parallel
        const members = await Promise.all(
          project.members.map(async (member) => {
            let files: FileEntry[] = [];
            try {
              const res = (await callGateway("agents.files.list", { agentId: member.id })) as
                | { workspace?: string }
                | undefined;
              const workspaceDir = res?.workspace;
              if (workspaceDir && typeof workspaceDir === "string") {
                files = await scanWorkspace(workspaceDir);
              }
            } catch {
              // Graceful degradation — member shows with empty files
            }
            return {
              agentId: member.id,
              agentName: member.name,
              agentEmoji: member.emoji,
              files,
            };
          }),
        );

        respond(true, { projectId, members }, undefined);
      },
    );

    // ── team.project.pause ────────────────────────────────────────────
    api.registerGatewayMethod(
      "team.project.pause",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`,
          });
          return;
        }

        const updated: Project = {
          ...project,
          status: "paused",
          version: project.version + 1,
          updatedAt: new Date().toISOString(),
        };

        await saveProject(updated);
        projectCache.set(projectId, updated);
        rebuildAgentIndex();
        respond(true, { project: updated }, undefined);
      },
    );

    // ── team.project.resume ───────────────────────────────────────────
    api.registerGatewayMethod(
      "team.project.resume",
      async ({ params, respond }) => {
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`,
          });
          return;
        }

        const updated: Project = {
          ...project,
          status: "active",
          version: project.version + 1,
          updatedAt: new Date().toISOString(),
        };

        await saveProject(updated);
        projectCache.set(projectId, updated);
        rebuildAgentIndex();
        respond(true, { project: updated }, undefined);
      },
    );

    // ── team.project.learning ───────────────────────────────────────
    // Returns learning analysis for a project (insights, routing patterns, specializations).
    api.registerGatewayMethod(
      "team.project.learning",
      async ({ params, respond }) => {
        await cacheReady;
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");
        if (!projectId) {
          respond(false, undefined, { code: "INVALID_PARAMS", message: "projectId is required" });
          return;
        }

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, { code: "NOT_FOUND", message: `Project "${projectId}" not found` });
          return;
        }

        // Use cached analysis or run fresh one
        let analysis = learningCache.get(projectId);
        if (!analysis) {
          const buf = activityBuffers.get(projectId) ?? [];
          const hMap = getOrCreateHealthMap(projectId, project.memberIds);
          const sMap = getOrCreateStatsMap(projectId, project.memberIds);
          analysis = analyzeLearningOpportunities(projectId, buf, hMap, sMap, project);
          learningCache.set(projectId, analysis);
        }

        respond(true, {
          analysis,
          report: formatLearningReport(analysis),
        }, undefined);
      },
    );

    // ── team.project.optimize ────────────────────────────────────────
    // Manually trigger a learning cycle and apply safe optimizations.
    api.registerGatewayMethod(
      "team.project.optimize",
      async ({ params, respond }) => {
        await cacheReady;
        const p = params as Record<string, unknown>;
        const projectId = String(p.projectId ?? "");
        if (!projectId) {
          respond(false, undefined, { code: "INVALID_PARAMS", message: "projectId is required" });
          return;
        }

        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, undefined, { code: "NOT_FOUND", message: `Project "${projectId}" not found` });
          return;
        }

        const buf = activityBuffers.get(projectId) ?? [];
        const hMap = getOrCreateHealthMap(projectId, project.memberIds);
        const sMap = getOrCreateStatsMap(projectId, project.memberIds);

        const analysis = analyzeLearningOpportunities(projectId, buf, hMap, sMap, project);
        learningCache.set(projectId, analysis);
        eventsSinceLastLearning.set(projectId, 0);

        // Apply safe auto-optimizations
        const { updatedProject, appliedChanges } = applyAutoOptimizations(project, analysis);

        if (appliedChanges.length > 0) {
          await saveProject(updatedProject);
          projectCache.set(projectId, updatedProject);
          rebuildAgentIndex();
          logger.info?.(
            `[Learning] Manual optimize "${project.name}": ${appliedChanges.join("; ")}`,
          );
        }

        respond(true, {
          analysis,
          report: formatLearningReport(analysis),
          appliedChanges,
        }, undefined);
      },
    );

    // ── team.route.summary ─────────────────────────────────────────
    // Aggregated view: for each project binding, return channel → project mapping.
    // Used by the Channels page to show which project handles each channel.
    api.registerGatewayMethod("team.route.summary", ({ respond }) => {
      const routes: Array<{
        channel: string;
        accountId?: string;
        targetType: "project";
        targetId: string;
        targetName: string;
      }> = [];

      for (const project of projectCache.values()) {
        if (project.status !== "active") continue;
        for (const binding of project.bindings) {
          routes.push({
            channel: binding.channel,
            ...(binding.accountId ? { accountId: binding.accountId } : {}),
            targetType: "project",
            targetId: project.projectId,
            targetName: project.name,
          });
        }
      }

      respond(true, { routes }, undefined);
    });

    // ═══════════════════════════════════════════════════════════════════
    // BACKGROUND SERVICE: Health Checker
    // ═══════════════════════════════════════════════════════════════════

    let healthTimer: ReturnType<typeof setInterval> | undefined;

    api.registerService({
      id: "agent-team-health",

      start: async () => {
        const INTERVAL_MS = 5 * 60_000; // 5 minutes

        healthTimer = setInterval(async () => {
          // Fetch agents list once and reuse across all projects
          let existingIds: Set<string> | undefined;
          try {
            const agentsList = (await callGateway("agents.list", {})) as
              | Array<{ id: string }>
              | undefined;
            if (Array.isArray(agentsList)) {
              existingIds = new Set(agentsList.map((a) => a.id));
            }
          } catch {
            // Gateway unavailable, skip health check entirely
          }

          if (existingIds) {
            for (const [projectId, project] of projectCache) {
              if (project.status !== "active") continue;

              for (const memberId of project.memberIds) {
                if (!existingIds.has(memberId)) {
                  logger.warn?.(
                    `[agent-team] Project "${project.name}": member "${memberId}" missing from agents.list`,
                  );
                  // If supervisor is missing, mark project as error
                  if (memberId === project.supervisorId) {
                    const updated = {
                      ...project,
                      status: "error" as const,
                      updatedAt: new Date().toISOString(),
                    };
                    projectCache.set(projectId, updated);
                    saveProject(updated).catch((err) =>
                      logger.warn?.(`[agent-team] Failed to persist error state: ${err}`),
                    );
                  }
                }
              }
            }
          }

          // Purge expired session affinities using the minimum timeout
          // across all active projects (conservative: expire sooner rather than later)
          let minTimeout = 30; // default fallback
          for (const [, proj] of projectCache) {
            if (proj.status === "active" && proj.coordination.fastPath?.affinityTimeoutMinutes != null) {
              minTimeout = Math.min(minTimeout, proj.coordination.fastPath.affinityTimeoutMinutes);
            }
          }
          const purged = purgeExpiredAffinities(Math.max(minTimeout, 1));
          if (purged > 0) {
            logger.info?.(`[agent-team] Purged ${purged} expired affinity record(s).`);
          }
        }, INTERVAL_MS);
      },

      stop: async () => {
        if (healthTimer) {
          clearInterval(healthTimer);
          healthTimer = undefined;
        }
      },
    });

    logger.info(
      `Agent Team plugin registered successfully (v0.5.0). ` +
        `Hooks: resolve_agent (federation cascade), before_agent_start, agent_end, message_sending, gateway_start. ` +
        `Methods: team.project.{list,get,create,createFromPlan,update,delete,pause,resume,health,stats,activity}, ` +
        `team.federation.create, team.shared-memory.{list,clear}. ` +
        `Tools: memory_share (read-shared mode). ` +
        `Service: agent-team-health. Fast Path Router: affinity+keyword+federation.`,
    );
  },
};

export default plugin;
