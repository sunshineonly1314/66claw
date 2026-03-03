/**
 * Agent Team State Manager
 *
 * Manages Project lifecycle: creation, update, deletion, listing.
 * Storage: JSON files under ~/.openclawcn/agent-team/projects/{projectId}/
 *
 * Pattern mirrors extensions/orchestrator/src/state.ts exactly:
 *   - Atomic JSON writes (tmp + rename)
 *   - ENOENT graceful handling
 *   - Path traversal protection via sanitizeProjectId
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Project, ProjectState } from "./types.js";
import { sanitizeProjectId } from "./project-id.js";

function isFileNotFound(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

// ── State Directory ──────────────────────────────────────────────────────

let stateDir = "";

/**
 * Initialize the state directory. Must be called before any state operations.
 *
 * Creates the directory structure synchronously-ish:
 *   ~/.openclawcn/agent-team/projects/
 *
 * This prevents the fragile pattern where the first operation happens to be
 * a read (e.g. loadAllProjects in gateway_start) and silently returns empty
 * instead of failing loudly when the directory is missing.
 */
export async function initProjectStateDir(dir: string): Promise<void> {
  stateDir = dir;
  try {
    await fs.mkdir(path.join(dir, "projects"), { recursive: true });
  } catch {
    // Best-effort: if mkdir fails here, atomicWriteJson will retry on write.
    // Log but don't throw — the plugin should still register.
    console.warn(
      `[agent-team] Could not pre-create state directory: ${dir}`,
    );
  }
}

function ensureStateDir(): string {
  if (!stateDir) {
    throw new Error(
      "Agent-team state directory not initialized. Call initProjectStateDir() first.",
    );
  }
  return stateDir;
}

// ── Path Helpers ─────────────────────────────────────────────────────────

function projectDir(projectId: string): string {
  return path.join(ensureStateDir(), "projects", sanitizeProjectId(projectId));
}

/**
 * Resolve the base directory for a project (exported for shared-memory storage).
 */
export function resolveProjectDir(projectId: string): string {
  return projectDir(projectId);
}

function projectPath(projectId: string): string {
  return path.join(projectDir(projectId), "project.json");
}

function statePath(projectId: string): string {
  return path.join(projectDir(projectId), "state.json");
}

// ── Atomic Write Helper ──────────────────────────────────────────────────

/**
 * Write JSON to a file atomically: write to tmp, then rename.
 * Prevents data corruption if the process crashes mid-write.
 */
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tmpPath, content, "utf-8");
  try {
    await fs.rename(tmpPath, filePath);
  } catch {
    // On Windows, rename can fail with EBUSY/EPERM — fall back to copy + unlink.
    try {
      await fs.copyFile(tmpPath, filePath);
    } finally {
      try { await fs.unlink(tmpPath); } catch { /* ignore */ }
    }
  }
}

// ── Project CRUD ─────────────────────────────────────────────────────────

/**
 * Save a project definition to disk.
 */
export async function saveProject(project: Project): Promise<void> {
  await atomicWriteJson(projectPath(project.projectId), project);
}

/**
 * Load a project by ID. Returns null if not found.
 */
export async function loadProject(projectId: string): Promise<Project | null> {
  try {
    const raw = await fs.readFile(projectPath(projectId), "utf-8");
    return JSON.parse(raw) as Project;
  } catch (err: unknown) {
    if (isFileNotFound(err)) return null;
    console.error(`[agent-team] failed to load project "${projectId}":`, err);
    return null;
  }
}

/**
 * Delete a project and its state from disk.
 */
export async function deleteProject(projectId: string): Promise<void> {
  const dir = projectDir(projectId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err: unknown) {
    if (!isFileNotFound(err)) {
      console.error(`[agent-team] failed to delete project "${projectId}":`, err);
    }
  }
}

/**
 * List all saved project IDs.
 */
export async function listProjectIds(): Promise<string[]> {
  const dir = path.join(ensureStateDir(), "projects");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Load all projects from disk.
 */
export async function loadAllProjects(): Promise<Project[]> {
  const ids = await listProjectIds();
  const projects: Project[] = [];
  for (const id of ids) {
    const project = await loadProject(id);
    if (project) projects.push(project);
  }
  return projects;
}

// ── Activity Persistence ──────────────────────────────────────────────────

function activityPath(projectId: string): string {
  return path.join(projectDir(projectId), "activity.json");
}

/**
 * Save activity events to disk.
 */
export async function saveActivity(projectId: string, events: unknown[]): Promise<void> {
  await atomicWriteJson(activityPath(projectId), events);
}

/**
 * Load activity events from disk. Returns empty array if not found.
 */
export async function loadActivity(projectId: string): Promise<unknown[]> {
  try {
    const raw = await fs.readFile(activityPath(projectId), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err: unknown) {
    if (isFileNotFound(err)) return [];
    return [];
  }
}

// ── Runtime State ────────────────────────────────────────────────────────

/**
 * Save runtime state (member health, active sessions).
 */
export async function saveProjectState(state: ProjectState): Promise<void> {
  await atomicWriteJson(statePath(state.projectId), state);
}

/**
 * Load runtime state. Returns null if not found.
 */
export async function loadProjectState(
  projectId: string,
): Promise<ProjectState | null> {
  try {
    const raw = await fs.readFile(statePath(projectId), "utf-8");
    return JSON.parse(raw) as ProjectState;
  } catch (err: unknown) {
    if (isFileNotFound(err)) return null;
    console.error(
      `[agent-team] failed to load state for "${projectId}":`,
      err,
    );
    return null;
  }
}
