import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeProjectId } from "./project-id.js";
function isFileNotFound(err) {
  return err instanceof Error && "code" in err && err.code === "ENOENT";
}
let stateDir = "";
function initProjectStateDir(dir) {
  stateDir = dir;
}
function ensureStateDir() {
  if (!stateDir) {
    throw new Error(
      "Agent-team state directory not initialized. Call initProjectStateDir() first."
    );
  }
  return stateDir;
}
function projectDir(projectId) {
  return path.join(ensureStateDir(), "projects", sanitizeProjectId(projectId));
}
function resolveProjectDir(projectId) {
  return projectDir(projectId);
}
function projectPath(projectId) {
  return path.join(projectDir(projectId), "project.json");
}
function statePath(projectId) {
  return path.join(projectDir(projectId), "state.json");
}
async function atomicWriteJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tmpPath, content, "utf-8");
  try {
    await fs.rename(tmpPath, filePath);
  } catch {
    try {
      await fs.copyFile(tmpPath, filePath);
    } finally {
      try {
        await fs.unlink(tmpPath);
      } catch {
      }
    }
  }
}
async function saveProject(project) {
  await atomicWriteJson(projectPath(project.projectId), project);
}
async function loadProject(projectId) {
  try {
    const raw = await fs.readFile(projectPath(projectId), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (isFileNotFound(err)) return null;
    console.error(`[agent-team] failed to load project "${projectId}":`, err);
    return null;
  }
}
async function deleteProject(projectId) {
  const dir = projectDir(projectId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    if (!isFileNotFound(err)) {
      console.error(`[agent-team] failed to delete project "${projectId}":`, err);
    }
  }
}
async function listProjectIds() {
  const dir = path.join(ensureStateDir(), "projects");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}
async function loadAllProjects() {
  const ids = await listProjectIds();
  const projects = [];
  for (const id of ids) {
    const project = await loadProject(id);
    if (project) projects.push(project);
  }
  return projects;
}
function activityPath(projectId) {
  return path.join(projectDir(projectId), "activity.json");
}
async function saveActivity(projectId, events) {
  await atomicWriteJson(activityPath(projectId), events);
}
async function loadActivity(projectId) {
  try {
    const raw = await fs.readFile(activityPath(projectId), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (isFileNotFound(err)) return [];
    return [];
  }
}
async function saveProjectState(state) {
  await atomicWriteJson(statePath(state.projectId), state);
}
async function loadProjectState(projectId) {
  try {
    const raw = await fs.readFile(statePath(projectId), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (isFileNotFound(err)) return null;
    console.error(
      `[agent-team] failed to load state for "${projectId}":`,
      err
    );
    return null;
  }
}
export {
  deleteProject,
  initProjectStateDir,
  listProjectIds,
  loadActivity,
  loadAllProjects,
  loadProject,
  loadProjectState,
  resolveProjectDir,
  saveActivity,
  saveProject,
  saveProjectState
};
