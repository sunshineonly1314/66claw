import {
  initProjectStateDir,
  saveProject,
  loadProject,
  deleteProject,
  loadAllProjects,
  saveProjectState,
  loadProjectState,
  saveActivity,
  loadActivity
} from "./src/state.js";
import { generateProjectId } from "./src/project-id.js";
import {
  createInitialMemberHealth,
  recordMemberSuccess,
  recordMemberFailure
} from "./src/member-health.js";
import { buildTeamContextBlock, isSupervisor } from "./src/system-prompt.js";
import { generateSupervisorSoul } from "./src/supervisor-soul.js";
import { matchWorkflow, generateWorkflowInstructions } from "./src/task-coordinator.js";
import { createProjectFromPlan } from "./src/deploy-bridge.js";
import { buildRoutesFromMembers } from "./src/keyword-router.js";
import {
  routeMessage,
  setRouteTable,
  clearRouteTable
} from "./src/fast-path-router.js";
import {
  setAffinity,
  clearProjectAffinities,
  purgeExpiredAffinities
} from "./src/session-affinity.js";
import {
  readSharedProfile,
  writeSharedProfile,
  formatSharedProfileForPrompt,
  SHARED_MEMORY_MAX_PROMPT_CHARS
} from "./src/shared-profile-store.js";
import { createMemoryShareTool } from "./src/memory-share-tool.js";
import { autoPromoteEntries } from "./src/auto-promote.js";
import { formatActivitySummary } from "./src/conversation-compactor.js";
import {
  createInitialMemberStats,
  recordMemberCall,
  computeAverageDuration
} from "./src/member-stats.js";
import { rewriteOutboundMessage } from "./src/visibility-rewriter.js";
import {
  analyzeLearningOpportunities,
  applyAutoOptimizations,
  formatLearningReport,
  shouldTriggerLearning
} from "./src/learning-engine.js";
import { buildSupervisorLearningContext } from "./src/soul-optimizer.js";
const projectCache = /* @__PURE__ */ new Map();
const agentToProject = /* @__PURE__ */ new Map();
const healthCache = /* @__PURE__ */ new Map();
const statsCache = /* @__PURE__ */ new Map();
let cacheReadyResolve;
const cacheReady = new Promise((r) => {
  cacheReadyResolve = r;
});
const memberNameMapCache = /* @__PURE__ */ new Map();
const learningCache = /* @__PURE__ */ new Map();
const eventsSinceLastLearning = /* @__PURE__ */ new Map();
function getMemberNameMap(project) {
  const cached = memberNameMapCache.get(project.projectId);
  if (cached && cached.version === project.version) return cached.map;
  const map = /* @__PURE__ */ new Map();
  for (const m of project.members) {
    map.set(m.id, m.emoji ? `${m.emoji} ${m.name}` : m.name);
  }
  memberNameMapCache.set(project.projectId, { version: project.version, map });
  return map;
}
const ACTIVITY_BUFFER_MAX = 100;
const activityBuffers = /* @__PURE__ */ new Map();
const activitySaveTimers = /* @__PURE__ */ new Map();
function pushActivityEvent(projectId, event) {
  let buf = activityBuffers.get(projectId);
  if (!buf) {
    buf = [];
    activityBuffers.set(projectId, buf);
  }
  buf.push(event);
  if (buf.length > ACTIVITY_BUFFER_MAX) {
    buf.splice(0, buf.length - ACTIVITY_BUFFER_MAX);
  }
  if (!activitySaveTimers.has(projectId)) {
    activitySaveTimers.set(
      projectId,
      setTimeout(() => {
        activitySaveTimers.delete(projectId);
        const current = activityBuffers.get(projectId);
        if (current) {
          saveActivity(projectId, current).catch(() => {
          });
        }
      }, 2e3)
    );
  }
}
const pendingRouteEvents = /* @__PURE__ */ new Map();
const lastSupervisorMessage = /* @__PURE__ */ new Map();
let activityIdCounter = 0;
function nextActivityId() {
  return `act_${Date.now()}_${++activityIdCounter}`;
}
const lastAgentForPeer = /* @__PURE__ */ new Map();
const MAX_PEER_AGENT_ENTRIES = 1e4;
function setLastAgentForPeer(peerId, agentId) {
  if (lastAgentForPeer.size >= MAX_PEER_AGENT_ENTRIES) {
    const firstKey = lastAgentForPeer.keys().next().value;
    if (firstKey !== void 0) lastAgentForPeer.delete(firstKey);
  }
  lastAgentForPeer.delete(peerId);
  lastAgentForPeer.set(peerId, agentId);
}
function clearPeerAgentEntriesForProject(project) {
  const memberSet = new Set(project.memberIds);
  for (const [peerId, agentId] of lastAgentForPeer) {
    if (memberSet.has(agentId)) {
      lastAgentForPeer.delete(peerId);
    }
  }
}
function rebuildAgentIndex() {
  agentToProject.clear();
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
  rebuildSupervisorIndex();
  buildAllRouteTables();
}
function findProjectByAgentId(agentId) {
  const projectId = agentToProject.get(agentId);
  if (!projectId) return void 0;
  return projectCache.get(projectId);
}
function getOrCreateHealthMap(projectId, memberIds) {
  let map = healthCache.get(projectId);
  if (!map) {
    map = /* @__PURE__ */ new Map();
    for (const id of memberIds) {
      map.set(id, createInitialMemberHealth(id));
    }
    healthCache.set(projectId, map);
  }
  return map;
}
function getOrCreateStatsMap(projectId, memberIds) {
  let map = statsCache.get(projectId);
  if (!map) {
    map = /* @__PURE__ */ new Map();
    for (const id of memberIds) {
      map.set(id, createInitialMemberStats(id));
    }
    statsCache.set(projectId, map);
  }
  return map;
}
const supervisorToProject = /* @__PURE__ */ new Map();
function rebuildSupervisorIndex() {
  supervisorToProject.clear();
  for (const [projectId, project] of projectCache) {
    supervisorToProject.set(project.supervisorId, projectId);
  }
}
function findProjectBySupervisorId(supervisorId) {
  const projectId = supervisorToProject.get(supervisorId);
  if (!projectId) return void 0;
  return projectCache.get(projectId);
}
function extractAgentIdFromSessionKey(sessionKey) {
  const parts = sessionKey.split(":");
  if (parts.length < 3 || parts[0] !== "agent") return null;
  return parts[1] || null;
}
function replaceAgentInSessionKey(sessionKey, newAgentId) {
  const parts = sessionKey.split(":");
  if (parts.length < 3 || parts[0] !== "agent") {
    return `agent:${newAgentId}:main`;
  }
  parts[1] = newAgentId;
  return parts.join(":");
}
function buildAllRouteTables() {
  for (const [projectId, project] of projectCache) {
    if (project.status !== "active") continue;
    const nonSupervisor = project.members.filter(
      (m) => m.id !== project.supervisorId
    );
    const routes = buildRoutesFromMembers(nonSupervisor);
    setRouteTable(projectId, routes);
  }
}
function extractConstraints(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const c = raw;
  const brandRules = c.brandRules;
  if (!brandRules || typeof brandRules !== "object") return void 0;
  const br = brandRules;
  const result = { brandRules: {} };
  if (typeof br.userAddress === "string") {
    result.brandRules.userAddress = br.userAddress;
  }
  if (Array.isArray(br.forbidden)) {
    result.brandRules.forbidden = br.forbidden.filter((v) => typeof v === "string");
  }
  if (Array.isArray(br.safetyRules)) {
    result.brandRules.safetyRules = br.safetyRules.filter((v) => typeof v === "string");
  }
  return result;
}
const plugin = {
  id: "agent-team",
  name: "Agent Team Manager",
  description: "Project-level agent team management.",
  version: "0.5.0",
  register(api) {
    const logger = api.logger;
    logger.info("Agent Team plugin registering...");
    const stateDir = api.resolvePath("~/.openclawcn/agent-team");
    initProjectStateDir(stateDir);
    const callGateway = async (method, params) => {
      const { callGateway: gwCall } = await import("../../dist/gateway/call.js");
      return gwCall({
        method,
        params,
        timeoutMs: 3e4,
        clientName: "gateway-client",
        clientDisplayName: "AgentTeam",
        mode: "backend"
      });
    };
    const orchestratorStateDir = api.resolvePath(
      "~/.openclawcn/orchestrator"
    );
    api.on(
      "resolve_agent",
      async (event, ctx) => {
        if (!event.message || !event.sessionKey) return;
        if (!ctx.peerId) return;
        const currentAgentId = extractAgentIdFromSessionKey(
          event.sessionKey
        );
        if (!currentAgentId) return;
        const project = findProjectBySupervisorId(currentAgentId);
        if (!project || project.status !== "active") return;
        const healthMap = getOrCreateHealthMap(
          project.projectId,
          project.memberIds
        );
        const result = routeMessage({
          message: event.message,
          project,
          peerId: ctx.peerId,
          healthMap
        });
        if (!result) {
          if (project.taskCoordination?.templateWorkflowsEnabled !== false) {
            lastSupervisorMessage.set(currentAgentId, event.message);
          }
          return;
        }
        let finalResult = result;
        const childProject = findProjectBySupervisorId(result.agentId);
        if (childProject && childProject.status === "active") {
          const childHealthMap = getOrCreateHealthMap(
            childProject.projectId,
            childProject.memberIds
          );
          const innerResult = routeMessage({
            message: event.message,
            project: childProject,
            peerId: ctx.peerId,
            healthMap: childHealthMap
          });
          if (innerResult) {
            setAffinity(
              childProject.projectId,
              ctx.peerId,
              innerResult.agentId
            );
            logger.info(
              `[FastPath] federation cascade: ${result.agentId} \u2192 ${innerResult.agentId} (${innerResult.method}, ${(innerResult.confidence * 100).toFixed(0)}%)`
            );
            finalResult = innerResult;
          }
        }
        const newSessionKey = replaceAgentInSessionKey(
          event.sessionKey,
          finalResult.agentId
        );
        setAffinity(
          project.projectId,
          ctx.peerId,
          result.agentId
        );
        setLastAgentForPeer(ctx.peerId, finalResult.agentId);
        logger.info(
          `[FastPath] ${finalResult.method}: "${finalResult.matchedPattern ?? ""}" \u2192 ${finalResult.agentId} (${(finalResult.confidence * 100).toFixed(0)}%)`
        );
        const routeEvent = {
          id: nextActivityId(),
          timestamp: Date.now(),
          agentId: finalResult.agentId,
          peerId: ctx.peerId,
          method: finalResult.method,
          confidence: finalResult.confidence,
          matchedPattern: finalResult.matchedPattern
        };
        pendingRouteEvents.set(finalResult.agentId, {
          projectId: project.projectId,
          event: routeEvent,
          startTime: Date.now()
        });
        return {
          sessionKey: newSessionKey,
          reason: `fast-path:${finalResult.method}`
        };
      },
      { priority: 100 }
    );
    api.on(
      "before_agent_start",
      async (_event, ctx) => {
        if (!ctx.agentId) return;
        const project = findProjectByAgentId(ctx.agentId);
        if (!project) return;
        if (project.status !== "active") return;
        const parts = [];
        const context = buildTeamContextBlock(project, ctx.agentId);
        if (context) parts.push(context);
        if (project.memory.mode === "read-shared") {
          try {
            const sharedProfile = readSharedProfile(project.projectId);
            if (sharedProfile.entries.length > 0) {
              const sharedBlock = formatSharedProfileForPrompt(
                sharedProfile,
                SHARED_MEMORY_MAX_PROMPT_CHARS,
                ctx.agentId
                // Exclude entries written by this agent
              );
              if (sharedBlock) {
                parts.push(
                  `<team-shared-memory>
${sharedBlock}
</team-shared-memory>`
                );
              }
            }
          } catch (err) {
            logger.warn?.(
              `[SharedMemory] Failed to read shared profile: ${err}`
            );
          }
        }
        if (isSupervisor(project, ctx.agentId)) {
          const buf = activityBuffers.get(project.projectId);
          if (buf && buf.length > 0) {
            const nameMap = getMemberNameMap(project);
            const summary = formatActivitySummary(buf, nameMap);
            if (summary) {
              parts.push(`<team-status>
${summary}
</team-status>`);
            }
          }
        }
        if (isSupervisor(project, ctx.agentId)) {
          const analysis = learningCache.get(project.projectId);
          const sMap = getOrCreateStatsMap(project.projectId, project.memberIds);
          const hMap = getOrCreateHealthMap(project.projectId, project.memberIds);
          const learningCtx = buildSupervisorLearningContext(project, analysis, sMap, hMap);
          if (learningCtx) {
            parts.push(`<team-learning>
${learningCtx}
</team-learning>`);
          }
        }
        if (isSupervisor(project, ctx.agentId) && project.taskCoordination?.templateWorkflowsEnabled !== false) {
          const cachedMessage = lastSupervisorMessage.get(ctx.agentId);
          if (cachedMessage) {
            lastSupervisorMessage.delete(ctx.agentId);
            const workflow = matchWorkflow(cachedMessage);
            if (workflow) {
              const nonSupervisorMembers = project.members.filter(
                (m) => m.id !== project.supervisorId
              );
              const instructions = generateWorkflowInstructions(
                workflow,
                nonSupervisorMembers
              );
              parts.push(instructions);
              logger.info?.(
                `[TaskCoordinator] Matched workflow "${workflow.id}" for supervisor ${ctx.agentId}`
              );
            }
          }
        }
        if (parts.length === 0) return;
        return { prependContext: parts.join("\n\n") };
      },
      { priority: 50 }
    );
    api.on("agent_end", async (event, ctx) => {
      if (!ctx.agentId) return;
      const project = findProjectByAgentId(ctx.agentId);
      if (!project) return;
      const healthMap = getOrCreateHealthMap(
        project.projectId,
        project.memberIds
      );
      const current = healthMap.get(ctx.agentId);
      if (!current) return;
      const updated = event.success ? recordMemberSuccess(current) : recordMemberFailure(current, event.error);
      healthMap.set(ctx.agentId, updated);
      const sMap = getOrCreateStatsMap(project.projectId, project.memberIds);
      const currentStats = sMap.get(ctx.agentId);
      if (currentStats) {
        sMap.set(ctx.agentId, recordMemberCall(currentStats, event.durationMs));
      }
      const pending = pendingRouteEvents.get(ctx.agentId);
      const isSuccess = event.success ?? true;
      const outcome = isSuccess ? "success" : event.durationMs != null && event.durationMs >= project.coordination.memberTimeoutSeconds * 1e3 ? "timeout" : "failure";
      if (pending) {
        pendingRouteEvents.delete(ctx.agentId);
        const finalEvent = {
          ...pending.event,
          durationMs: Date.now() - pending.startTime,
          success: isSuccess,
          error: event.error,
          replySummary: void 0,
          taskType: "routing",
          outcome
        };
        pushActivityEvent(pending.projectId, finalEvent);
      } else {
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
          replySummary: void 0,
          taskType: isSup ? "direct-reply" : "fallback",
          outcome
        });
      }
      const state = {
        projectId: project.projectId,
        memberHealth: [...healthMap.values()],
        memberStats: [...sMap.values()],
        activeSessions: 0,
        lastActivityAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      saveProjectState(state).catch((err) => {
        logger.warn?.(`Failed to persist health state: ${err}`);
      });
      if (project.status === "active" && project.memory.mode === "read-shared" && event.success && ctx.workspaceDir) {
        autoPromoteEntries({
          projectId: project.projectId,
          agentId: ctx.agentId,
          workspaceDir: ctx.workspaceDir,
          sharedCategories: project.memory.sharedCategories
        }).catch((err) => {
          logger.warn?.(
            `[SharedMemory] Auto-promote failed: ${err}`
          );
        });
      }
      if (project.status === "active") {
        const count = (eventsSinceLastLearning.get(project.projectId) ?? 0) + 1;
        eventsSinceLastLearning.set(project.projectId, count);
        if (shouldTriggerLearning(count)) {
          try {
            const buf = [...activityBuffers.get(project.projectId) ?? []];
            const analysis = analyzeLearningOpportunities(
              project.projectId,
              buf,
              healthMap,
              sMap,
              project
            );
            learningCache.set(project.projectId, analysis);
            if (analysis.insights.length > 0) {
              const { updatedProject, appliedChanges } = applyAutoOptimizations(project, analysis);
              if (appliedChanges.length > 0) {
                await saveProject(updatedProject);
                projectCache.set(project.projectId, updatedProject);
                logger.info?.(
                  `[Learning] Auto-optimized "${project.name}": ${appliedChanges.join("; ")}`
                );
              }
            }
          } catch (err) {
            logger.warn?.(`[Learning] Analysis failed for "${project.name}": ${err}`);
          } finally {
            eventsSinceLastLearning.set(project.projectId, 0);
          }
        }
      }
    });
    api.on(
      "message_sending",
      async (event, _ctx) => {
        const peerId = event.to;
        if (!peerId) return;
        const agentId = lastAgentForPeer.get(peerId);
        if (!agentId) return;
        const project = findProjectByAgentId(agentId);
        if (!project || project.status !== "active") return;
        if (project.visibility.mode === "team" && !project.visibility.displayName) {
          return;
        }
        const result = rewriteOutboundMessage({
          content: event.content ?? "",
          project,
          agentId
        });
        if (result.cancel) return { cancel: true };
        if (result.content !== (event.content ?? "")) {
          return { content: result.content };
        }
      },
      { priority: 40 }
    );
    api.registerTool(
      (ctx) => {
        if (!ctx.agentId) return null;
        const project = findProjectByAgentId(ctx.agentId);
        if (!project || project.status !== "active") return null;
        if (project.memory.mode !== "read-shared") return null;
        return createMemoryShareTool({
          projectId: project.projectId,
          agentId: ctx.agentId
        });
      },
      { name: "memory_share", optional: true }
    );
    api.on("gateway_start", async () => {
      try {
        const projects = await loadAllProjects();
        for (const p of projects) {
          projectCache.set(p.projectId, p);
          const state = await loadProjectState(p.projectId);
          if (state?.memberHealth) {
            const map = /* @__PURE__ */ new Map();
            for (const h of state.memberHealth) {
              map.set(h.agentId, h);
            }
            healthCache.set(p.projectId, map);
          }
          if (state?.memberStats) {
            const sMap = /* @__PURE__ */ new Map();
            for (const s of state.memberStats) {
              sMap.set(s.agentId, s);
            }
            statsCache.set(p.projectId, sMap);
          }
          const saved = await loadActivity(p.projectId);
          if (saved.length > 0) {
            activityBuffers.set(p.projectId, saved);
          }
        }
        rebuildAgentIndex();
        logger.info(
          `Loaded ${projects.length} project(s) from disk.`
        );
      } catch (err) {
        logger.error(`Failed to load projects on startup: ${err}`);
      } finally {
        cacheReadyResolve();
      }
    });
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
        parentProjectId: p.parentProjectId
      }));
      respond(true, { projects }, void 0);
    });
    api.registerGatewayMethod(
      "team.project.get",
      async ({ params, respond }) => {
        await cacheReady;
        const p = params;
        const projectId = String(p.projectId ?? "");
        let project = projectCache.get(projectId);
        if (!project) {
          const fromDisk = await loadProject(projectId);
          if (fromDisk) {
            projectCache.set(fromDisk.projectId, fromDisk);
            rebuildAgentIndex();
            project = fromDisk;
          }
        }
        if (!project) {
          respond(false, void 0, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`
          });
          return;
        }
        const state = await loadProjectState(projectId);
        respond(true, { project, state }, void 0);
      }
    );
    api.registerGatewayMethod(
      "team.project.create",
      async ({ params, respond }) => {
        const p = params;
        const name = String(p.name ?? "").trim();
        const description = String(p.description ?? "").trim();
        const supervisorId = String(p.supervisorId ?? "").trim();
        const memberIds = Array.isArray(p.memberIds) ? p.memberIds.filter((v) => typeof v === "string" && v.trim() !== "").map((s) => s.trim()) : [];
        const members = Array.isArray(p.members) ? p.members.filter(
          (m) => typeof m === "object" && m !== null && typeof m.id === "string" && typeof m.name === "string" && typeof m.role === "string"
        ).map((m) => ({ id: m.id, name: m.name, role: m.role, ...typeof m.emoji === "string" ? { emoji: m.emoji } : {} })) : memberIds.map((id) => ({
          id,
          name: id,
          role: ""
        }));
        if (!name || !supervisorId || memberIds.length === 0) {
          respond(false, void 0, {
            code: "INVALID_PARAMS",
            message: "Required: name, supervisorId, memberIds (non-empty array)"
          });
          return;
        }
        if (!memberIds.includes(supervisorId)) {
          memberIds.unshift(supervisorId);
        }
        const MAX_MEMBERS = 8;
        if (memberIds.length > MAX_MEMBERS) {
          respond(false, void 0, {
            code: "INVALID_PARAMS",
            message: `Too many members (${memberIds.length}). Maximum is ${MAX_MEMBERS}.`
          });
          return;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const project = {
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
            mode: p.memoryMode === "read-shared" ? "read-shared" : "isolated",
            ...Array.isArray(p.sharedCategories) ? {
              sharedCategories: p.sharedCategories.filter(
                (c) => c === "fact" || c === "identity" || c === "preference"
              )
            } : {}
          },
          coordination: {
            supervisorStyle: p.supervisorStyle === "delegate-only" ? "delegate-only" : "concierge",
            maxMembers: 8,
            hopLimit: 5,
            memberTimeoutSeconds: 30,
            supervisorFallbackEnabled: true,
            ...p.handoffStyle === "silent" || p.handoffStyle === "notify" || p.handoffStyle === "introduce" ? { handoffStyle: p.handoffStyle } : {}
          },
          visibility: {
            mode: p.visibilityMode === "unified" ? "unified" : p.visibilityMode === "transparent" ? "transparent" : "team",
            ...typeof p.displayName === "string" ? { displayName: p.displayName } : {}
          },
          constraints: extractConstraints(p.constraints),
          bindings: []
        };
        try {
          await saveProject(project);
          projectCache.set(project.projectId, project);
          rebuildAgentIndex();
          getOrCreateHealthMap(project.projectId, memberIds);
          const nonSupervisor = members.filter(
            (m) => m.id !== supervisorId
          );
          const soul = generateSupervisorSoul(project, nonSupervisor);
          try {
            await callGateway("agents.files.set", {
              agentId: supervisorId,
              name: "SOUL.md",
              content: soul
            });
          } catch {
          }
          respond(true, { project }, void 0);
        } catch (err) {
          respond(false, void 0, {
            code: "CREATE_FAILED",
            message: err instanceof Error ? err.message : String(err)
          });
        }
      }
    );
    api.registerGatewayMethod(
      "team.project.createFromPlan",
      async ({ params, respond }) => {
        const p = params;
        const planId = String(p.planId ?? "").trim();
        if (!planId) {
          respond(false, void 0, {
            code: "INVALID_PARAMS",
            message: "Required: planId"
          });
          return;
        }
        const existingProject = [...projectCache.values()].find(
          (proj) => proj.sourcePlanId === planId
        );
        if (existingProject) {
          respond(true, { project: existingProject, deduplicated: true }, void 0);
          return;
        }
        try {
          const { project, report } = await createProjectFromPlan(callGateway, {
            planId,
            name: typeof p.name === "string" ? p.name : void 0,
            constraints: extractConstraints(p.constraints),
            orchestratorStateDir
          });
          projectCache.set(project.projectId, project);
          rebuildAgentIndex();
          getOrCreateHealthMap(
            project.projectId,
            project.memberIds
          );
          respond(true, { project, report }, void 0);
        } catch (err) {
          respond(false, void 0, {
            code: "CREATE_FROM_PLAN_FAILED",
            message: err instanceof Error ? err.message : String(err)
          });
        }
      }
    );
    api.registerGatewayMethod(
      "team.project.update",
      async ({ params, respond }) => {
        const p = params;
        const projectId = String(p.projectId ?? "");
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`
          });
          return;
        }
        const updatedMemory = { ...project.memory };
        if (p.memoryMode === "read-shared" || p.memoryMode === "isolated") {
          updatedMemory.mode = p.memoryMode;
        }
        if (Array.isArray(p.sharedCategories)) {
          updatedMemory.sharedCategories = p.sharedCategories.filter(
            (c) => c === "fact" || c === "identity" || c === "preference"
          );
        }
        const coordPatch = {};
        if (typeof p.coordination === "object" && p.coordination) {
          const c = p.coordination;
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
          if (typeof c.fastPath === "object" && c.fastPath) {
            const fp = c.fastPath;
            const existingFp = project.coordination.fastPath ?? {
              sessionAffinityEnabled: false,
              affinityTimeoutMinutes: 30,
              keywordConfidenceThreshold: 0.6
            };
            const fpPatch = { ...existingFp };
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
        const visPatch = {};
        if (typeof p.visibility === "object" && p.visibility) {
          const v = p.visibility;
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
        let updatedBindings = project.bindings;
        if (Array.isArray(p.bindings)) {
          updatedBindings = p.bindings.filter(
            (b) => typeof b.channel === "string" && b.channel.length > 0
          ).map((b) => ({
            channel: String(b.channel),
            ...typeof b.accountId === "string" ? { accountId: b.accountId } : {},
            ...typeof b.peer === "string" ? { peer: b.peer } : {}
          }));
        }
        let updatedSupervisorId = project.supervisorId;
        if (typeof p.supervisorId === "string" && p.supervisorId.length > 0) {
          const memberIds = Array.isArray(p.memberIds) ? p.memberIds : project.memberIds;
          if (memberIds.includes(p.supervisorId)) {
            updatedSupervisorId = p.supervisorId;
          }
        }
        let updatedConstraints = project.constraints;
        if (p.constraints !== void 0) {
          const patch = extractConstraints(p.constraints);
          if (patch) {
            const existingBr = project.constraints?.brandRules ?? {};
            updatedConstraints = {
              brandRules: { ...existingBr, ...patch.brandRules }
            };
          }
        }
        let updatedMemberIds = project.memberIds;
        let updatedMembers = project.members;
        if (Array.isArray(p.memberIds)) {
          updatedMemberIds = p.memberIds.filter(
            (v) => typeof v === "string" && v.trim() !== ""
          );
        }
        if (Array.isArray(p.members)) {
          updatedMembers = p.members;
        }
        const updated = {
          ...project,
          name: typeof p.name === "string" ? p.name : project.name,
          description: typeof p.description === "string" ? p.description : project.description,
          memberIds: updatedMemberIds,
          members: updatedMembers,
          supervisorId: updatedSupervisorId,
          constraints: updatedConstraints,
          memory: updatedMemory,
          coordination: { ...project.coordination, ...coordPatch },
          visibility: { ...project.visibility, ...visPatch },
          bindings: updatedBindings,
          version: project.version + 1,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        try {
          await saveProject(updated);
          projectCache.set(projectId, updated);
          rebuildAgentIndex();
          const soulAffected = updated.supervisorId !== project.supervisorId || JSON.stringify(updated.members) !== JSON.stringify(project.members) || JSON.stringify(updated.constraints) !== JSON.stringify(project.constraints) || updated.coordination.supervisorStyle !== project.coordination.supervisorStyle || updated.coordination.hopLimit !== project.coordination.hopLimit || updated.coordination.handoffStyle !== project.coordination.handoffStyle || updated.visibility.mode !== project.visibility.mode || updated.visibility.displayName !== project.visibility.displayName;
          if (soulAffected) {
            const nonSupervisor = updated.members.filter(
              (m) => m.id !== updated.supervisorId
            );
            const soul = generateSupervisorSoul(updated, nonSupervisor);
            callGateway("agents.files.set", {
              agentId: updated.supervisorId,
              name: "SOUL.md",
              content: soul
            }).catch(
              (err) => logger.warn?.(`[agent-team] SOUL regen failed: ${err}`)
            );
          }
          respond(true, { project: updated }, void 0);
        } catch (err) {
          respond(false, void 0, {
            code: "UPDATE_FAILED",
            message: err instanceof Error ? err.message : String(err)
          });
        }
      }
    );
    api.registerGatewayMethod(
      "team.project.delete",
      async ({ params, respond }) => {
        const p = params;
        const projectId = String(p.projectId ?? "");
        const deleteAgents = p.deleteAgents === true;
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`
          });
          return;
        }
        try {
          if (project.autoSupervisor) {
            try {
              await callGateway("agents.remove", {
                agentId: project.supervisorId
              });
            } catch {
            }
          }
          if (deleteAgents) {
            for (const memberId of project.memberIds) {
              if (project.autoSupervisor && memberId === project.supervisorId) continue;
              try {
                await callGateway("agents.remove", {
                  agentId: memberId
                });
              } catch {
              }
            }
          }
          if (project.parentProjectId) {
            const parent = projectCache.get(project.parentProjectId);
            if (parent && parent.isFederation) {
              const updatedParent = {
                ...parent,
                childProjectIds: (parent.childProjectIds ?? []).filter(
                  (id) => id !== projectId
                ),
                memberIds: parent.memberIds.filter(
                  (id) => id !== project.supervisorId
                ),
                members: parent.members.filter(
                  (m) => m.id !== project.supervisorId
                ),
                version: parent.version + 1,
                updatedAt: (/* @__PURE__ */ new Date()).toISOString()
              };
              await saveProject(updatedParent);
              projectCache.set(parent.projectId, updatedParent);
              const parentMembers = updatedParent.members.filter(
                (m) => m.id !== updatedParent.supervisorId
              );
              const soul = generateSupervisorSoul(updatedParent, parentMembers);
              callGateway("agents.files.set", {
                agentId: updatedParent.supervisorId,
                name: "SOUL.md",
                content: soul
              }).catch(() => {
              });
            }
          }
          if (project.isFederation && project.childProjectIds?.length) {
            for (const childId of project.childProjectIds) {
              const child = projectCache.get(childId);
              if (child && child.parentProjectId === projectId) {
                const updatedChild = {
                  ...child,
                  parentProjectId: void 0,
                  version: child.version + 1,
                  updatedAt: (/* @__PURE__ */ new Date()).toISOString()
                };
                await saveProject(updatedChild);
                projectCache.set(childId, updatedChild);
              }
            }
          }
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
          for (const [key, val] of pendingRouteEvents) {
            if (val.projectId === projectId) pendingRouteEvents.delete(key);
          }
          lastSupervisorMessage.delete(project.supervisorId);
          clearPeerAgentEntriesForProject(project);
          clearProjectAffinities(projectId);
          clearRouteTable(projectId);
          rebuildAgentIndex();
          respond(true, { success: true }, void 0);
        } catch (err) {
          respond(false, void 0, {
            code: "DELETE_FAILED",
            message: err instanceof Error ? err.message : String(err)
          });
        }
      }
    );
    api.registerGatewayMethod(
      "team.federation.create",
      async ({ params, respond }) => {
        const p = params;
        const name = String(p.name ?? "").trim();
        const description = String(p.description ?? "").trim();
        const metaSupervisorId = String(p.metaSupervisorId ?? "").trim();
        const childProjectIds = Array.isArray(p.childProjectIds) ? p.childProjectIds.filter((v) => typeof v === "string" && v.trim() !== "").map((s) => s.trim()) : [];
        if (!name || !metaSupervisorId || childProjectIds.length === 0) {
          respond(false, void 0, {
            code: "INVALID_PARAMS",
            message: "Required: name, metaSupervisorId, childProjectIds (non-empty array)"
          });
          return;
        }
        const childProjects = [];
        for (const cid of childProjectIds) {
          const cp = projectCache.get(cid);
          if (!cp) {
            respond(false, void 0, {
              code: "NOT_FOUND",
              message: `Child project "${cid}" not found`
            });
            return;
          }
          if (cp.status !== "active") {
            respond(false, void 0, {
              code: "INVALID_STATE",
              message: `Child project "${cid}" is not active (status: ${cp.status})`
            });
            return;
          }
          childProjects.push(cp);
        }
        for (const cp of childProjects) {
          if (cp.supervisorId === metaSupervisorId) {
            respond(false, void 0, {
              code: "INVALID_PARAMS",
              message: `metaSupervisorId "${metaSupervisorId}" is already the supervisor of child project "${cp.projectId}". Use a dedicated agent as meta-supervisor.`
            });
            return;
          }
        }
        for (const cp of childProjects) {
          if (cp.parentProjectId) {
            respond(false, void 0, {
              code: "INVALID_STATE",
              message: `Child project "${cp.projectId}" already belongs to federation "${cp.parentProjectId}"`
            });
            return;
          }
        }
        for (const cp of childProjects) {
          if (cp.isFederation) {
            respond(false, void 0, {
              code: "INVALID_STATE",
              message: `Child project "${cp.projectId}" is itself a federation. Nested federations are not supported.`
            });
            return;
          }
        }
        const memberIds = [metaSupervisorId];
        const members = [];
        for (const cp of childProjects) {
          if (!memberIds.includes(cp.supervisorId)) {
            memberIds.push(cp.supervisorId);
          }
          const supervisorInfo = cp.members.find(
            (m) => m.id === cp.supervisorId
          );
          const existing = members.find((m) => m.id === cp.supervisorId);
          if (existing) {
            existing.role += `; ${cp.description}`;
            existing.name += ` / ${cp.name}`;
          } else {
            members.push({
              id: cp.supervisorId,
              name: cp.name,
              // Use project name, not agent name
              role: cp.description,
              // Key: project description drives keyword routing
              emoji: supervisorInfo?.emoji
            });
          }
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const project = {
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
            supervisorStyle: "delegate-only",
            // Meta-supervisor always delegates
            maxMembers: 20,
            // Federations can be larger
            hopLimit: 3,
            // meta-sup → child-sup → member = 2 hops max
            memberTimeoutSeconds: 30,
            supervisorFallbackEnabled: true
          },
          visibility: {
            mode: "unified",
            // Federation is invisible to end users
            displayName: typeof p.displayName === "string" ? p.displayName : void 0
          },
          constraints: extractConstraints(p.constraints),
          bindings: [],
          isFederation: true,
          childProjectIds
        };
        try {
          await saveProject(project);
          for (const cp of childProjects) {
            const updated = {
              ...cp,
              parentProjectId: project.projectId,
              version: cp.version + 1,
              updatedAt: now
            };
            await saveProject(updated);
            projectCache.set(cp.projectId, updated);
          }
          projectCache.set(project.projectId, project);
          rebuildAgentIndex();
          getOrCreateHealthMap(project.projectId, memberIds);
          const soul = generateSupervisorSoul(project, members);
          try {
            await callGateway("agents.files.set", {
              agentId: metaSupervisorId,
              name: "SOUL.md",
              content: soul
            });
          } catch {
          }
          const warnings = [];
          if (project.bindings.length === 0) {
            warnings.push(
              "Federation created with no channel bindings. Use team.project.update to add bindings, or assign the meta-supervisor agent directly to a channel."
            );
          }
          respond(true, { project, warnings }, void 0);
        } catch (err) {
          respond(false, void 0, {
            code: "CREATE_FEDERATION_FAILED",
            message: err instanceof Error ? err.message : String(err)
          });
        }
      }
    );
    api.registerGatewayMethod(
      "team.shared-memory.list",
      async ({ params, respond }) => {
        const p = params;
        const projectId = String(p.projectId ?? "");
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`
          });
          return;
        }
        if (project.memory.mode !== "read-shared") {
          respond(false, void 0, {
            code: "NOT_SHARED",
            message: `Project "${projectId}" is not in read-shared memory mode`
          });
          return;
        }
        const sharedProfile = readSharedProfile(projectId);
        respond(
          true,
          { entries: sharedProfile.entries, count: sharedProfile.entries.length },
          void 0
        );
      }
    );
    api.registerGatewayMethod(
      "team.shared-memory.clear",
      async ({ params, respond }) => {
        const p = params;
        const projectId = String(p.projectId ?? "");
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`
          });
          return;
        }
        if (project.memory.mode !== "read-shared") {
          respond(false, void 0, {
            code: "NOT_SHARED",
            message: `Project "${projectId}" is not in read-shared memory mode`
          });
          return;
        }
        try {
          writeSharedProfile(projectId, { version: 1, entries: [] });
          respond(true, { success: true }, void 0);
        } catch (err) {
          respond(false, void 0, {
            code: "CLEAR_FAILED",
            message: err instanceof Error ? err.message : String(err)
          });
        }
      }
    );
    api.registerGatewayMethod(
      "team.project.health",
      async ({ params, respond }) => {
        const p = params;
        const projectId = String(p.projectId ?? "");
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`
          });
          return;
        }
        const healthMap = getOrCreateHealthMap(
          projectId,
          project.memberIds
        );
        const members = [...healthMap.values()].map((h) => ({
          agentId: h.agentId,
          state: h.state,
          totalSuccesses: h.totalSuccesses,
          totalFailures: h.totalFailures,
          lastError: h.lastError ?? null,
          lastSuccessAt: h.lastSuccessAt ?? null,
          lastFailureAt: h.lastFailureAt ?? null
        }));
        respond(
          true,
          { projectId, status: project.status, members },
          void 0
        );
      }
    );
    api.registerGatewayMethod(
      "team.project.stats",
      async ({ params, respond }) => {
        const p = params;
        const projectId = String(p.projectId ?? "");
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`
          });
          return;
        }
        const sMap = getOrCreateStatsMap(projectId, project.memberIds);
        const members = [...sMap.values()].map((s) => ({
          agentId: s.agentId,
          callCount: s.callCount,
          totalDurationMs: s.totalDurationMs,
          avgDurationMs: computeAverageDuration(s),
          lastCallAt: s.lastCallAt ?? null
        }));
        const totalCalls = members.reduce((sum, m) => sum + m.callCount, 0);
        const totalDuration = members.reduce(
          (sum, m) => sum + m.totalDurationMs,
          0
        );
        respond(
          true,
          {
            projectId,
            members,
            totalCalls,
            avgDurationMs: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0
          },
          void 0
        );
      }
    );
    api.registerGatewayMethod(
      "team.project.activity",
      async ({ params, respond }) => {
        const p = params;
        const projectId = String(p.projectId ?? "");
        const limit = Math.min(Number(p.limit ?? 50), ACTIVITY_BUFFER_MAX);
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`
          });
          return;
        }
        const buf = activityBuffers.get(projectId) ?? [];
        const events = buf.slice(-limit).reverse();
        const enriched = events.map((ev) => {
          const member = project.members?.find((m) => m.id === ev.agentId);
          return {
            ...ev,
            agentName: member?.name ?? ev.agentId,
            agentEmoji: member?.emoji
          };
        });
        respond(true, { projectId, events: enriched }, void 0);
      }
    );
    api.registerGatewayMethod(
      "team.project.files.list",
      async ({ params, respond }) => {
        await cacheReady;
        const p = params;
        const projectId = String(p.projectId ?? "");
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`
          });
          return;
        }
        const fsP = await import("node:fs/promises");
        const pathMod = await import("node:path");
        const SCAN_EXTENSIONS = /* @__PURE__ */ new Set([
          ".md",
          ".csv",
          ".json",
          ".txt",
          ".png",
          ".jpg",
          ".jpeg",
          ".html",
          ".pdf",
          ".xlsx",
          ".docx",
          ".log"
        ]);
        const SYSTEM_FILES = /* @__PURE__ */ new Set([
          "SOUL.md",
          "IDENTITY.md",
          "MEMORY.md",
          "MEMORY.jsonl",
          "CONFIG.yaml",
          "CONFIG.json"
        ]);
        const MAX_FILES_PER_AGENT = 50;
        const MAX_DEPTH = 2;
        const scanWorkspace = async (workspaceDir) => {
          const files = [];
          const scanDir = async (dir, depth) => {
            if (depth >= MAX_DEPTH || files.length >= MAX_FILES_PER_AGENT) return;
            let entries;
            try {
              entries = await fsP.readdir(dir, { withFileTypes: true });
            } catch {
              return;
            }
            for (const entry of entries) {
              if (files.length >= MAX_FILES_PER_AGENT) break;
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
                      updatedAtMs: st.mtimeMs
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
        const members = await Promise.all(
          project.members.map(async (member) => {
            let files = [];
            try {
              const res = await callGateway("agents.files.list", { agentId: member.id });
              const workspaceDir = res?.workspace;
              if (workspaceDir && typeof workspaceDir === "string") {
                files = await scanWorkspace(workspaceDir);
              }
            } catch {
            }
            return {
              agentId: member.id,
              agentName: member.name,
              agentEmoji: member.emoji,
              files
            };
          })
        );
        respond(true, { projectId, members }, void 0);
      }
    );
    api.registerGatewayMethod(
      "team.project.pause",
      async ({ params, respond }) => {
        const p = params;
        const projectId = String(p.projectId ?? "");
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`
          });
          return;
        }
        const updated = {
          ...project,
          status: "paused",
          version: project.version + 1,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await saveProject(updated);
        projectCache.set(projectId, updated);
        rebuildAgentIndex();
        respond(true, { project: updated }, void 0);
      }
    );
    api.registerGatewayMethod(
      "team.project.resume",
      async ({ params, respond }) => {
        const p = params;
        const projectId = String(p.projectId ?? "");
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, {
            code: "NOT_FOUND",
            message: `Project "${projectId}" not found`
          });
          return;
        }
        const updated = {
          ...project,
          status: "active",
          version: project.version + 1,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await saveProject(updated);
        projectCache.set(projectId, updated);
        rebuildAgentIndex();
        respond(true, { project: updated }, void 0);
      }
    );
    api.registerGatewayMethod(
      "team.project.learning",
      async ({ params, respond }) => {
        await cacheReady;
        const p = params;
        const projectId = String(p.projectId ?? "");
        if (!projectId) {
          respond(false, void 0, { code: "INVALID_PARAMS", message: "projectId is required" });
          return;
        }
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, { code: "NOT_FOUND", message: `Project "${projectId}" not found` });
          return;
        }
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
          report: formatLearningReport(analysis)
        }, void 0);
      }
    );
    api.registerGatewayMethod(
      "team.project.optimize",
      async ({ params, respond }) => {
        await cacheReady;
        const p = params;
        const projectId = String(p.projectId ?? "");
        if (!projectId) {
          respond(false, void 0, { code: "INVALID_PARAMS", message: "projectId is required" });
          return;
        }
        const project = projectCache.get(projectId);
        if (!project) {
          respond(false, void 0, { code: "NOT_FOUND", message: `Project "${projectId}" not found` });
          return;
        }
        const buf = activityBuffers.get(projectId) ?? [];
        const hMap = getOrCreateHealthMap(projectId, project.memberIds);
        const sMap = getOrCreateStatsMap(projectId, project.memberIds);
        const analysis = analyzeLearningOpportunities(projectId, buf, hMap, sMap, project);
        learningCache.set(projectId, analysis);
        eventsSinceLastLearning.set(projectId, 0);
        const { updatedProject, appliedChanges } = applyAutoOptimizations(project, analysis);
        if (appliedChanges.length > 0) {
          await saveProject(updatedProject);
          projectCache.set(projectId, updatedProject);
          rebuildAgentIndex();
          logger.info?.(
            `[Learning] Manual optimize "${project.name}": ${appliedChanges.join("; ")}`
          );
        }
        respond(true, {
          analysis,
          report: formatLearningReport(analysis),
          appliedChanges
        }, void 0);
      }
    );
    api.registerGatewayMethod("team.route.summary", ({ respond }) => {
      const routes = [];
      for (const project of projectCache.values()) {
        if (project.status !== "active") continue;
        for (const binding of project.bindings) {
          routes.push({
            channel: binding.channel,
            ...binding.accountId ? { accountId: binding.accountId } : {},
            targetType: "project",
            targetId: project.projectId,
            targetName: project.name
          });
        }
      }
      respond(true, { routes }, void 0);
    });
    let healthTimer;
    api.registerService({
      id: "agent-team-health",
      start: async () => {
        const INTERVAL_MS = 5 * 6e4;
        healthTimer = setInterval(async () => {
          let existingIds;
          try {
            const agentsList = await callGateway("agents.list", {});
            if (Array.isArray(agentsList)) {
              existingIds = new Set(agentsList.map((a) => a.id));
            }
          } catch {
          }
          if (existingIds) {
            for (const [projectId, project] of projectCache) {
              if (project.status !== "active") continue;
              for (const memberId of project.memberIds) {
                if (!existingIds.has(memberId)) {
                  logger.warn?.(
                    `[agent-team] Project "${project.name}": member "${memberId}" missing from agents.list`
                  );
                  if (memberId === project.supervisorId) {
                    const updated = {
                      ...project,
                      status: "error",
                      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
                    };
                    projectCache.set(projectId, updated);
                    saveProject(updated).catch(
                      (err) => logger.warn?.(`[agent-team] Failed to persist error state: ${err}`)
                    );
                  }
                }
              }
            }
          }
          let minTimeout = 30;
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
          healthTimer = void 0;
        }
      }
    });
    logger.info(
      `Agent Team plugin registered successfully (v0.5.0). Hooks: resolve_agent (federation cascade), before_agent_start, agent_end, message_sending, gateway_start. Methods: team.project.{list,get,create,createFromPlan,update,delete,pause,resume,health,stats,activity}, team.federation.create, team.shared-memory.{list,clear}. Tools: memory_share (read-shared mode). Service: agent-team-health. Fast Path Router: affinity+keyword+federation.`
    );
  }
};
var agent_team_default = plugin;
export {
  agent_team_default as default
};
