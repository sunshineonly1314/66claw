import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
function isFileNotFound(err) {
  return err instanceof Error && "code" in err && err.code === "ENOENT";
}
let stateDir = "";
function initStateDir(dir) {
  stateDir = dir;
}
function ensureStateDir() {
  if (!stateDir) {
    throw new Error("Orchestrator state directory not initialized. Call initStateDir() first.");
  }
  return stateDir;
}
function sanitizePlanId(planId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(planId)) {
    throw new Error(`Invalid planId: "${planId}" \u2014 must contain only alphanumeric, hyphens, underscores`);
  }
  return planId;
}
function planPath(planId) {
  return path.join(ensureStateDir(), "plans", `${sanitizePlanId(planId)}.json`);
}
function statePath(planId) {
  return path.join(ensureStateDir(), "states", `${sanitizePlanId(planId)}.json`);
}
async function atomicWriteJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);
}
async function savePlan(plan) {
  await atomicWriteJson(planPath(plan.planId), plan);
}
async function loadPlan(planId) {
  try {
    const raw = await fs.readFile(planPath(planId), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (isFileNotFound(err)) return null;
    console.error(`[orchestrator] failed to load plan "${planId}":`, err);
    return null;
  }
}
async function listPlanIds() {
  const dir = path.join(ensureStateDir(), "plans");
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
  } catch {
    return [];
  }
}
async function saveState(state) {
  await atomicWriteJson(statePath(state.planId), state);
}
async function loadState(planId) {
  try {
    const raw = await fs.readFile(statePath(planId), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (isFileNotFound(err)) return null;
    console.error(`[orchestrator] failed to load state "${planId}":`, err);
    return null;
  }
}
function createInitialState(plan) {
  const agents = plan.agents.map((bp) => ({
    agentId: bp.id,
    blueprintId: bp.id,
    status: "pending"
  }));
  const defaultStatus = plan.mode === "guided" ? "draft" : "confirming";
  return {
    planId: plan.planId,
    status: defaultStatus,
    agents
  };
}
function updateAgentStatus(state, agentId, status, error) {
  const agents = state.agents.map((a) => {
    if (a.agentId !== agentId) return a;
    return {
      ...a,
      status,
      // Only overwrite error if explicitly provided or transitioning to failed
      error: error !== void 0 ? error : status === "failed" ? a.error : void 0,
      ...status === "ready" ? { readyAt: (/* @__PURE__ */ new Date()).toISOString() } : {}
    };
  });
  const allReady = agents.every((a) => a.status === "ready");
  const anyFailed = agents.some((a) => a.status === "failed");
  let overallStatus = state.status;
  if (state.status === "deploying") {
    if (allReady) overallStatus = "deployed";
    else if (anyFailed) overallStatus = "failed";
  }
  return {
    ...state,
    agents,
    status: overallStatus,
    ...allReady ? { deployFinishedAt: (/* @__PURE__ */ new Date()).toISOString() } : {},
    ...anyFailed ? { error: agents.find((a) => a.status === "failed")?.error } : {}
  };
}
function reportPath(planId) {
  return path.join(ensureStateDir(), "reports", `${sanitizePlanId(planId)}.json`);
}
async function saveReport(planId, report) {
  await atomicWriteJson(reportPath(planId), report);
}
async function loadReport(planId) {
  try {
    const raw = await fs.readFile(reportPath(planId), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (isFileNotFound(err)) return null;
    console.error(`[orchestrator] failed to load report "${planId}":`, err);
    return null;
  }
}
function generatePlanId() {
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
  const rand = randomUUID().slice(0, 8);
  return `orch-${date}-${rand}`;
}
export {
  createInitialState,
  generatePlanId,
  initStateDir,
  listPlanIds,
  loadPlan,
  loadReport,
  loadState,
  savePlan,
  saveReport,
  saveState,
  updateAgentStatus
};
