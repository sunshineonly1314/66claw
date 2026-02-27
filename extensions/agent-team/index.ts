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
} from "./src/state.js";
import { generateProjectId } from "./src/project-id.js";
import {
  createInitialMemberHealth,
  recordMemberSuccess,
  recordMemberFailure,
  isRoutable,
} from "./src/member-health.js";
import { buildTeamContextBlock, isTeamMember } from "./src/system-prompt.js";
import { generateSupervisorSoul } from "./src/supervisor-soul.js";
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
import {
  createInitialMemberStats,
  recordMemberCall,
  computeAverageDuration,
} from "./src/member-stats.js";
import type { SharedCategory, MemberStats } from "./src/types.js";
import { rewriteOutboundMessage } from "./src/visibility-rewriter.js";

// ── In-Memory Cache ──────────────────────────────────────────────────────
// Hot-path lookup for before_agent_start hook (runs on every LLM call).

const projectCache = new Map<string, Project>();
const agentToProject = new Map<string, string>();
const healthCache = new Map<string, Map<string, MemberHealth>>();
const statsCache = new Map<string, Map<string, MemberStats>>();

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
  for (const [projectId, project] of projectCache) {
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
  version: "0.4.0",

  register(api: OpenClawCNPluginApi) {
    const logger = api.logger;
    logger.info("Agent Team plugin registering...");

    // ── Initialize state directory ────────────────────────────────────
    const stateDir = api.resolvePath("~/.openclawcn/agent-team");
    initProjectStateDir(stateDir);

    // ── Build gateway call function (lazy import, same as orchestrator) ──
    const callGateway: CallGatewayFn = async (method, params) => {
      const { callGateway: gwCall } = await import(
        "../../src/gateway/call.js"
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
      async (event, ctx) => {
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

        if (!result) return; // No deterministic match → Supervisor LLM

        // Build new session key pointing to the target member agent
        const newSessionKey = replaceAgentInSessionKey(
          event.sessionKey,
          result.agentId,
        );

        // Update affinity for sticky routing on follow-up messages
        setAffinity(
          project.projectId,
          ctx.peerId,
          result.agentId,
        );

        // Record peer→agent mapping for message_sending hook.
        // resolve_agent is the only hook with peerId (= ctx.From).
        // message_sending uses event.to which is the same peer address.
        setLastAgentForPeer(ctx.peerId, result.agentId);

        logger.info(
          `[FastPath] ${result.method}: ` +
            `"${result.matchedPattern ?? ""}" → ${result.agentId} ` +
            `(${(result.confidence * 100).toFixed(0)}%)`,
        );

        return {
          sessionKey: newSessionKey,
          reason: `fast-path:${result.method}`,
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
        }
        rebuildAgentIndex();
        logger.info(
          `Loaded ${projects.length} project(s) from disk.`,
        );
      } catch (err) {
        logger.error(`Failed to load projects on startup: ${err}`);
      }
    });

    // ═══════════════════════════════════════════════════════════════════
    // GATEWAY METHODS
    // ═══════════════════════════════════════════════════════════════════

    // ── team.project.list ─────────────────────────────────────────────
    api.registerGatewayMethod("team.project.list", ({ respond }) => {
      const projects = [...projectCache.values()].map((p) => ({
        projectId: p.projectId,
        name: p.name,
        description: p.description,
        status: p.status,
        memberCount: p.memberIds.length,
        memberIds: p.memberIds,
        supervisorId: p.supervisorId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        version: p.version,
      }));
      respond(true, { projects }, undefined);
    });

    // ── team.project.get ──────────────────────────────────────────────
    api.registerGatewayMethod(
      "team.project.get",
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

        try {
          const project = await createProjectFromPlan(callGateway, {
            planId,
            name: typeof p.name === "string" ? p.name : undefined,
            supervisorAgentId:
              typeof p.supervisorAgentId === "string"
                ? p.supervisorAgentId
                : undefined,
            constraints: p.constraints as TeamConstraints | undefined,
            orchestratorStateDir,
          });

          // Update caches
          projectCache.set(project.projectId, project);
          rebuildAgentIndex();
          getOrCreateHealthMap(
            project.projectId,
            project.memberIds,
          );

          respond(true, { project }, undefined);
        } catch (err) {
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

        const updated: Project = {
          ...project,
          name:
            typeof p.name === "string" ? p.name : project.name,
          description:
            typeof p.description === "string"
              ? p.description
              : project.description,
          constraints:
            p.constraints !== undefined
              ? extractConstraints(p.constraints)
              : project.constraints,
          memory: updatedMemory,
          coordination: { ...project.coordination, ...coordPatch },
          visibility: { ...project.visibility, ...visPatch },
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
          // Optionally delete member agents
          if (deleteAgents) {
            for (const memberId of project.memberIds) {
              try {
                await callGateway("agents.remove", {
                  agentId: memberId,
                });
              } catch {
                // Best-effort: some agents may already be deleted
              }
            }
          }

          // Remove from disk + cache + affinity + route table + peer mapping
          await deleteProject(projectId);
          projectCache.delete(projectId);
          healthCache.delete(projectId);
          statsCache.delete(projectId);
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
        respond(true, { project: updated }, undefined);
      },
    );

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
      `Agent Team plugin registered successfully (v0.4.0). ` +
        `Hooks: resolve_agent, before_agent_start, agent_end, message_sending, gateway_start. ` +
        `Methods: team.project.{list,get,create,createFromPlan,update,delete,pause,resume,health,stats}, ` +
        `team.shared-memory.{list,clear}. ` +
        `Tools: memory_share (read-shared mode). ` +
        `Service: agent-team-health. Fast Path Router: affinity+keyword.`,
    );
  },
};

export default plugin;
