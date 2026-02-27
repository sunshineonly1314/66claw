import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OpenClawCNConfig } from "../config/config.js";
import type { SessionEntry } from "../config/sessions.js";
import type { SessionScope } from "../config/sessions/types.js";
import { resolveDefaultAgentId } from "../agents/agent-scope.js";
import {
  resolveLegacyStateDirs,
  resolveNewStateDir,
  resolveOAuthDir,
  resolveStateDir,
} from "../config/paths.js";
import { saveSessionStore } from "../config/sessions.js";
import { canonicalizeMainSessionAlias } from "../config/sessions/main-session.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  buildAgentMainSessionKey,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_MAIN_KEY,
  normalizeAgentId,
} from "../routing/session-key.js";
import {
  ensureDir,
  existsDir,
  fileExists,
  isLegacyWhatsAppAuthFile,
  readSessionStoreJson5,
  type SessionEntryLike,
  safeReadDir,
} from "./state-migrations.fs.js";

export type LegacyStateDetection = {
  targetAgentId: string;
  targetMainKey: string;
  targetScope?: SessionScope;
  stateDir: string;
  oauthDir: string;
  sessions: {
    legacyDir: string;
    legacyStorePath: string;
    targetDir: string;
    targetStorePath: string;
    hasLegacy: boolean;
    legacyKeys: string[];
  };
  agentDir: {
    legacyDir: string;
    targetDir: string;
    hasLegacy: boolean;
  };
  whatsappAuth: {
    legacyDir: string;
    targetDir: string;
    hasLegacy: boolean;
  };
  preview: string[];
};

type MigrationLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

let autoMigrateChecked = false;
let autoMigrateStateDirChecked = false;

function isSurfaceGroupKey(key: string): boolean {
  return key.includes(":group:") || key.includes(":channel:");
}

function isLegacyGroupKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith("group:")) {
    return true;
  }
  const lower = trimmed.toLowerCase();
  if (!lower.includes("@g.us")) {
    return false;
  }
  // Legacy WhatsApp group keys: bare JID or "whatsapp:<jid>" without explicit ":group:" kind.
  if (!trimmed.includes(":")) {
    return true;
  }
  if (lower.startsWith("whatsapp:") && !trimmed.includes(":group:")) {
    return true;
  }
  return false;
}

function canonicalizeSessionKeyForAgent(params: {
  key: string;
  agentId: string;
  mainKey: string;
  scope?: SessionScope;
}): string {
  const agentId = normalizeAgentId(params.agentId);
  const raw = params.key.trim();
  if (!raw) {
    return raw;
  }
  if (raw.toLowerCase() === "global" || raw.toLowerCase() === "unknown") {
    return raw.toLowerCase();
  }

  const canonicalMain = canonicalizeMainSessionAlias({
    cfg: { session: { scope: params.scope, mainKey: params.mainKey } },
    agentId,
    sessionKey: raw,
  });
  if (canonicalMain !== raw) {
    return canonicalMain.toLowerCase();
  }

  if (raw.toLowerCase().startsWith("agent:")) {
    return raw.toLowerCase();
  }
  if (raw.toLowerCase().startsWith("subagent:")) {
    const rest = raw.slice("subagent:".length);
    return `agent:${agentId}:subagent:${rest}`.toLowerCase();
  }
  if (raw.startsWith("group:")) {
    const id = raw.slice("group:".length).trim();
    if (!id) {
      return raw;
    }
    const channel = id.toLowerCase().includes("@g.us") ? "whatsapp" : "unknown";
    return `agent:${agentId}:${channel}:group:${id}`.toLowerCase();
  }
  if (!raw.includes(":") && raw.toLowerCase().includes("@g.us")) {
    return `agent:${agentId}:whatsapp:group:${raw}`.toLowerCase();
  }
  if (raw.toLowerCase().startsWith("whatsapp:") && raw.toLowerCase().includes("@g.us")) {
    const remainder = raw.slice("whatsapp:".length).trim();
    const cleaned = remainder.replace(/^group:/i, "").trim();
    if (cleaned && !isSurfaceGroupKey(raw)) {
      return `agent:${agentId}:whatsapp:group:${cleaned}`.toLowerCase();
    }
  }
  if (isSurfaceGroupKey(raw)) {
    return `agent:${agentId}:${raw}`.toLowerCase();
  }
  return `agent:${agentId}:${raw}`.toLowerCase();
}

function pickLatestLegacyDirectEntry(
  store: Record<string, SessionEntryLike>,
): SessionEntryLike | null {
  let best: SessionEntryLike | null = null;
  let bestUpdated = -1;
  for (const [key, entry] of Object.entries(store)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const normalized = key.trim();
    if (!normalized) {
      continue;
    }
    if (normalized === "global") {
      continue;
    }
    if (normalized.startsWith("agent:")) {
      continue;
    }
    if (normalized.toLowerCase().startsWith("subagent:")) {
      continue;
    }
    if (isLegacyGroupKey(normalized) || isSurfaceGroupKey(normalized)) {
      continue;
    }
    const updatedAt = typeof entry.updatedAt === "number" ? entry.updatedAt : 0;
    if (updatedAt > bestUpdated) {
      bestUpdated = updatedAt;
      best = entry;
    }
  }
  return best;
}

function normalizeSessionEntry(entry: SessionEntryLike): SessionEntry | null {
  const sessionId = typeof entry.sessionId === "string" ? entry.sessionId : null;
  if (!sessionId) {
    return null;
  }
  const updatedAt =
    typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)
      ? entry.updatedAt
      : Date.now();
  const normalized = { ...(entry as unknown as SessionEntry), sessionId, updatedAt };
  const rec = normalized as unknown as Record<string, unknown>;
  if (typeof rec.groupChannel !== "string" && typeof rec.room === "string") {
    rec.groupChannel = rec.room;
  }
  delete rec.room;
  return normalized;
}

function resolveUpdatedAt(entry: SessionEntryLike): number {
  return typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)
    ? entry.updatedAt
    : 0;
}

function mergeSessionEntry(params: {
  existing: SessionEntryLike | undefined;
  incoming: SessionEntryLike;
  preferIncomingOnTie?: boolean;
}): SessionEntryLike {
  if (!params.existing) {
    return params.incoming;
  }
  const existingUpdated = resolveUpdatedAt(params.existing);
  const incomingUpdated = resolveUpdatedAt(params.incoming);
  if (incomingUpdated > existingUpdated) {
    return params.incoming;
  }
  if (incomingUpdated < existingUpdated) {
    return params.existing;
  }
  return params.preferIncomingOnTie ? params.incoming : params.existing;
}

function canonicalizeSessionStore(params: {
  store: Record<string, SessionEntryLike>;
  agentId: string;
  mainKey: string;
  scope?: SessionScope;
}): { store: Record<string, SessionEntryLike>; legacyKeys: string[] } {
  const canonical: Record<string, SessionEntryLike> = {};
  const meta = new Map<string, { isCanonical: boolean; updatedAt: number }>();
  const legacyKeys: string[] = [];

  for (const [key, entry] of Object.entries(params.store)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const canonicalKey = canonicalizeSessionKeyForAgent({
      key,
      agentId: params.agentId,
      mainKey: params.mainKey,
      scope: params.scope,
    });
    const isCanonical = canonicalKey === key;
    if (!isCanonical) {
      legacyKeys.push(key);
    }
    const existing = canonical[canonicalKey];
    if (!existing) {
      canonical[canonicalKey] = entry;
      meta.set(canonicalKey, { isCanonical, updatedAt: resolveUpdatedAt(entry) });
      continue;
    }

    const existingMeta = meta.get(canonicalKey);
    const incomingUpdated = resolveUpdatedAt(entry);
    const existingUpdated = existingMeta?.updatedAt ?? resolveUpdatedAt(existing);
    if (incomingUpdated > existingUpdated) {
      canonical[canonicalKey] = entry;
      meta.set(canonicalKey, { isCanonical, updatedAt: incomingUpdated });
      continue;
    }
    if (incomingUpdated < existingUpdated) {
      continue;
    }
    if (existingMeta?.isCanonical && !isCanonical) {
      continue;
    }
    if (!existingMeta?.isCanonical && isCanonical) {
      canonical[canonicalKey] = entry;
      meta.set(canonicalKey, { isCanonical, updatedAt: incomingUpdated });
      continue;
    }
  }

  return { store: canonical, legacyKeys };
}

function listLegacySessionKeys(params: {
  store: Record<string, SessionEntryLike>;
  agentId: string;
  mainKey: string;
  scope?: SessionScope;
}): string[] {
  const legacy: string[] = [];
  for (const key of Object.keys(params.store)) {
    const canonical = canonicalizeSessionKeyForAgent({
      key,
      agentId: params.agentId,
      mainKey: params.mainKey,
      scope: params.scope,
    });
    if (canonical !== key) {
      legacy.push(key);
    }
  }
  return legacy;
}

function emptyDirOrMissing(dir: string): boolean {
  if (!existsDir(dir)) {
    return true;
  }
  return safeReadDir(dir).length === 0;
}

function removeDirIfEmpty(dir: string) {
  if (!existsDir(dir)) {
    return;
  }
  if (!emptyDirOrMissing(dir)) {
    return;
  }
  try {
    fs.rmdirSync(dir);
  } catch {
    // ignore
  }
}

export function resetAutoMigrateLegacyStateForTest() {
  autoMigrateChecked = false;
}

export function resetAutoMigrateLegacyAgentDirForTest() {
  resetAutoMigrateLegacyStateForTest();
}

export function resetAutoMigrateLegacyStateDirForTest() {
  autoMigrateStateDirChecked = false;
}

type StateDirMigrationResult = {
  migrated: boolean;
  skipped: boolean;
  changes: string[];
  warnings: string[];
};

function resolveSymlinkTarget(linkPath: string): string | null {
  try {
    const target = fs.readlinkSync(linkPath);
    return path.resolve(path.dirname(linkPath), target);
  } catch {
    return null;
  }
}

function formatStateDirMigration(legacyDir: string, targetDir: string): string {
  return `State dir: ${legacyDir} → ${targetDir} (legacy path now symlinked)`;
}

function isDirPath(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function isWithinDir(targetPath: string, rootDir: string): boolean {
  const relative = path.relative(path.resolve(rootDir), path.resolve(targetPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isLegacyTreeSymlinkMirror(currentDir: string, realTargetDir: string): boolean {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return false;
  }
  if (entries.length === 0) {
    return false;
  }

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(entryPath);
    } catch {
      return false;
    }
    if (stat.isSymbolicLink()) {
      const resolvedTarget = resolveSymlinkTarget(entryPath);
      if (!resolvedTarget) {
        return false;
      }
      let resolvedRealTarget: string;
      try {
        resolvedRealTarget = fs.realpathSync(resolvedTarget);
      } catch {
        return false;
      }
      if (!isWithinDir(resolvedRealTarget, realTargetDir)) {
        return false;
      }
      continue;
    }
    if (stat.isDirectory()) {
      if (!isLegacyTreeSymlinkMirror(entryPath, realTargetDir)) {
        return false;
      }
      continue;
    }
    return false;
  }

  return true;
}

function isLegacyDirSymlinkMirror(legacyDir: string, targetDir: string): boolean {
  let realTargetDir: string;
  try {
    realTargetDir = fs.realpathSync(targetDir);
  } catch {
    return false;
  }
  return isLegacyTreeSymlinkMirror(legacyDir, realTargetDir);
}

/**
 * [CN-PATCH:migration-p0] Merge data from a legacy state dir into the target,
 * covering workspace memory, config files, and other critical data.
 * Called when both dirs exist simultaneously.
 */
function mergeLegacyIntoTarget(
  legacyDir: string,
  targetDir: string,
): { changes: string[]; warnings: string[] } {
  const changes: string[] = [];
  const warnings: string[] = [];

  // 1. Merge workspace memory (profile.json, MEMORY.md) for all workspaces
  try {
    const entries = fs.readdirSync(legacyDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "workspace" || entry.name.startsWith("workspace-")) {
        const legacyWs = path.join(legacyDir, entry.name);
        const targetWs = path.join(targetDir, entry.name);
        ensureDir(targetWs);
        const wsResult = mergeWorkspaceMemory(legacyWs, targetWs);
        changes.push(...wsResult.changes.map((c) => `${entry.name}: ${c}`));
        warnings.push(...wsResult.warnings.map((w) => `${entry.name}: ${w}`));
      }
    }
  } catch (err) {
    warnings.push(`Failed to scan legacy workspaces: ${String(err)}`);
  }

  // 2. Merge legacy config filenames
  const cfgResult = migrateLegacyConfigFilename(legacyDir);
  // If legacy dir had a renamed-to-canonical config, merge it into target's config
  const legacyCanonical = path.join(legacyDir, "openclawcn.json");
  if (fileExists(legacyCanonical)) {
    const targetCanonical = path.join(targetDir, "openclawcn.json");
    try {
      const legacyCfg = JSON.parse(fs.readFileSync(legacyCanonical, "utf-8"));
      if (fileExists(targetCanonical)) {
        const targetCfg = JSON.parse(fs.readFileSync(targetCanonical, "utf-8"));
        const merged = deepMergeConfigsSmart(legacyCfg, targetCfg);
        writeFileAtomic(targetCanonical, JSON.stringify(merged, null, 2));
        changes.push("merged legacy openclawcn.json into target");
      } else {
        fs.copyFileSync(legacyCanonical, targetCanonical);
        changes.push("copied legacy openclawcn.json to target");
      }
    } catch (err) {
      warnings.push(`Failed to merge legacy config: ${String(err)}`);
    }
  }
  changes.push(...cfgResult.changes);
  warnings.push(...cfgResult.warnings);

  // 3. Copy credentials and master key (no-overwrite — target's credentials take priority)
  for (const rel of [".master-key", ".device_id", ".env", "node.json"]) {
    const src = path.join(legacyDir, rel);
    const dst = path.join(targetDir, rel);
    if (fileExists(src) && !fileExists(dst)) {
      try {
        fs.copyFileSync(src, dst);
        changes.push(`copied ${rel} from legacy`);
      } catch {
        /* ignore */
      }
    }
  }

  // 4. Copy credential directories (no-overwrite per file)
  for (const dirRel of ["credentials", "identity"]) {
    const srcDir = path.join(legacyDir, dirRel);
    const dstDir = path.join(targetDir, dirRel);
    if (existsDir(srcDir)) {
      ensureDir(dstDir);
      try {
        const files = fs.readdirSync(srcDir);
        for (const file of files) {
          const srcFile = path.join(srcDir, file);
          const dstFile = path.join(dstDir, file);
          if (fileExists(srcFile) && !fileExists(dstFile)) {
            fs.copyFileSync(srcFile, dstFile);
            changes.push(`copied ${dirRel}/${file} from legacy`);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  return { changes, warnings };
}

export async function autoMigrateLegacyStateDir(params: {
  env?: NodeJS.ProcessEnv;
  homedir?: () => string;
  log?: MigrationLogger;
}): Promise<StateDirMigrationResult> {
  if (autoMigrateStateDirChecked) {
    return { migrated: false, skipped: true, changes: [], warnings: [] };
  }
  autoMigrateStateDirChecked = true;

  const env = params.env ?? process.env;
  if (env.OPENCLAWCN_STATE_DIR?.trim()) {
    return { migrated: false, skipped: true, changes: [], warnings: [] };
  }

  const homedir = params.homedir ?? os.homedir;
  const targetDir = resolveNewStateDir(homedir);
  const legacyDirs = resolveLegacyStateDirs(homedir);
  let legacyDir = legacyDirs.find((dir) => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });
  const warnings: string[] = [];
  const changes: string[] = [];

  let legacyStat: fs.Stats | null = null;
  try {
    legacyStat = legacyDir ? fs.lstatSync(legacyDir) : null;
  } catch {
    legacyStat = null;
  }
  if (!legacyStat) {
    return { migrated: false, skipped: false, changes, warnings };
  }
  if (!legacyStat.isDirectory() && !legacyStat.isSymbolicLink()) {
    warnings.push(`Legacy state path is not a directory: ${legacyDir}`);
    return { migrated: false, skipped: false, changes, warnings };
  }

  let symlinkDepth = 0;
  while (legacyStat.isSymbolicLink()) {
    const legacyTarget = legacyDir ? resolveSymlinkTarget(legacyDir) : null;
    if (!legacyTarget) {
      warnings.push(
        `Legacy state dir is a symlink (${legacyDir ?? "unknown"}); could not resolve target.`,
      );
      return { migrated: false, skipped: false, changes, warnings };
    }
    if (path.resolve(legacyTarget) === path.resolve(targetDir)) {
      return { migrated: false, skipped: false, changes, warnings };
    }
    if (legacyDirs.some((dir) => path.resolve(dir) === path.resolve(legacyTarget))) {
      legacyDir = legacyTarget;
      try {
        legacyStat = fs.lstatSync(legacyDir);
      } catch {
        legacyStat = null;
      }
      if (!legacyStat) {
        warnings.push(`Legacy state dir missing after symlink resolution: ${legacyDir}`);
        return { migrated: false, skipped: false, changes, warnings };
      }
      if (!legacyStat.isDirectory() && !legacyStat.isSymbolicLink()) {
        warnings.push(`Legacy state path is not a directory: ${legacyDir}`);
        return { migrated: false, skipped: false, changes, warnings };
      }
      symlinkDepth += 1;
      if (symlinkDepth > 2) {
        warnings.push(`Legacy state dir symlink chain too deep: ${legacyDir}`);
        return { migrated: false, skipped: false, changes, warnings };
      }
      continue;
    }
    warnings.push(
      `Legacy state dir is a symlink (${legacyDir ?? "unknown"} → ${legacyTarget}); skipping auto-migration.`,
    );
    return { migrated: false, skipped: false, changes, warnings };
  }

  if (isDirPath(targetDir)) {
    if (legacyDir && isLegacyDirSymlinkMirror(legacyDir, targetDir)) {
      return { migrated: false, skipped: false, changes, warnings };
    }
    // [CN-PATCH:migration-p0] Both dirs exist — merge workspace memory and config
    // instead of giving up. This handles the common upgrade scenario where the
    // new dir was auto-created but the old dir still has valuable user data.
    if (legacyDir) {
      const mergeResult = mergeLegacyIntoTarget(legacyDir, targetDir);
      changes.push(...mergeResult.changes);
      warnings.push(...mergeResult.warnings);

      if (mergeResult.changes.length > 0) {
        // Create symlink from legacy → target so future launches don't re-merge
        try {
          // Remove legacy dir contents (already merged) and replace with symlink
          // Only safe because we just merged everything worth keeping.
          fs.renameSync(legacyDir, legacyDir + ".pre-merge.bak");
          try {
            fs.symlinkSync(targetDir, legacyDir, "dir");
            changes.push(formatStateDirMigration(legacyDir, targetDir));
          } catch {
            try {
              if (process.platform === "win32") {
                fs.symlinkSync(targetDir, legacyDir, "junction");
                changes.push(formatStateDirMigration(legacyDir, targetDir));
              }
            } catch {
              // Symlink failed — rename backup back
              try {
                fs.renameSync(legacyDir + ".pre-merge.bak", legacyDir);
              } catch {
                /* ignore */
              }
              warnings.push(`Merge succeeded but could not symlink legacy dir`);
            }
          }
        } catch (err) {
          warnings.push(`Could not replace legacy dir with symlink: ${String(err)}`);
        }
      }

      return { migrated: changes.length > 0, skipped: false, changes, warnings };
    }
    return { migrated: false, skipped: false, changes, warnings };
  }

  try {
    if (!legacyDir) {
      throw new Error("Legacy state dir not found");
    }
    fs.renameSync(legacyDir, targetDir);
  } catch (err) {
    warnings.push(
      `Failed to move legacy state dir (${legacyDir ?? "unknown"} → ${targetDir}): ${String(err)}`,
    );
    return { migrated: false, skipped: false, changes, warnings };
  }

  try {
    if (!legacyDir) {
      throw new Error("Legacy state dir not found");
    }
    fs.symlinkSync(targetDir, legacyDir, "dir");
    changes.push(formatStateDirMigration(legacyDir, targetDir));
  } catch (err) {
    try {
      if (process.platform === "win32") {
        if (!legacyDir) {
          throw new Error("Legacy state dir not found", { cause: err });
        }
        fs.symlinkSync(targetDir, legacyDir, "junction");
        changes.push(formatStateDirMigration(legacyDir, targetDir));
      } else {
        throw err;
      }
    } catch (fallbackErr) {
      try {
        if (!legacyDir) {
          // oxlint-disable-next-line preserve-caught-error
          throw new Error("Legacy state dir not found", { cause: fallbackErr });
        }
        fs.renameSync(targetDir, legacyDir);
        warnings.push(
          `State dir migration rolled back (failed to link legacy path): ${String(fallbackErr)}`,
        );
        return { migrated: false, skipped: false, changes: [], warnings };
      } catch (rollbackErr) {
        warnings.push(
          `State dir moved but failed to link legacy path (${legacyDir ?? "unknown"} → ${targetDir}): ${String(fallbackErr)}`,
        );
        warnings.push(
          `Rollback failed; set OPENCLAWCN_STATE_DIR=${targetDir} to avoid split state: ${String(rollbackErr)}`,
        );
        changes.push(`State dir: ${legacyDir ?? "unknown"} → ${targetDir}`);
      }
    }
  }

  return { migrated: changes.length > 0, skipped: false, changes, warnings };
}

export async function detectLegacyStateMigrations(params: {
  cfg: OpenClawCNConfig;
  env?: NodeJS.ProcessEnv;
  homedir?: () => string;
}): Promise<LegacyStateDetection> {
  const env = params.env ?? process.env;
  const homedir = params.homedir ?? os.homedir;
  const stateDir = resolveStateDir(env, homedir);
  const oauthDir = resolveOAuthDir(env, stateDir);

  const targetAgentId = normalizeAgentId(resolveDefaultAgentId(params.cfg));
  const rawMainKey = params.cfg.session?.mainKey;
  const targetMainKey =
    typeof rawMainKey === "string" && rawMainKey.trim().length > 0
      ? rawMainKey.trim()
      : DEFAULT_MAIN_KEY;
  const targetScope = params.cfg.session?.scope;

  const sessionsLegacyDir = path.join(stateDir, "sessions");
  const sessionsLegacyStorePath = path.join(sessionsLegacyDir, "sessions.json");
  const sessionsTargetDir = path.join(stateDir, "agents", targetAgentId, "sessions");
  const sessionsTargetStorePath = path.join(sessionsTargetDir, "sessions.json");
  const legacySessionEntries = safeReadDir(sessionsLegacyDir);
  const hasLegacySessions =
    fileExists(sessionsLegacyStorePath) ||
    legacySessionEntries.some((e) => e.isFile() && e.name.endsWith(".jsonl"));

  const targetSessionParsed = fileExists(sessionsTargetStorePath)
    ? readSessionStoreJson5(sessionsTargetStorePath)
    : { store: {}, ok: true };
  const legacyKeys = targetSessionParsed.ok
    ? listLegacySessionKeys({
        store: targetSessionParsed.store,
        agentId: targetAgentId,
        mainKey: targetMainKey,
        scope: targetScope,
      })
    : [];

  const legacyAgentDir = path.join(stateDir, "agent");
  const targetAgentDir = path.join(stateDir, "agents", targetAgentId, "agent");
  const hasLegacyAgentDir = existsDir(legacyAgentDir);

  const targetWhatsAppAuthDir = path.join(oauthDir, "whatsapp", DEFAULT_ACCOUNT_ID);
  const hasLegacyWhatsAppAuth =
    fileExists(path.join(oauthDir, "creds.json")) &&
    !fileExists(path.join(targetWhatsAppAuthDir, "creds.json"));

  const preview: string[] = [];
  if (hasLegacySessions) {
    preview.push(`- Sessions: ${sessionsLegacyDir} → ${sessionsTargetDir}`);
  }
  if (legacyKeys.length > 0) {
    preview.push(`- Sessions: canonicalize legacy keys in ${sessionsTargetStorePath}`);
  }
  if (hasLegacyAgentDir) {
    preview.push(`- Agent dir: ${legacyAgentDir} → ${targetAgentDir}`);
  }
  if (hasLegacyWhatsAppAuth) {
    preview.push(`- WhatsApp auth: ${oauthDir} → ${targetWhatsAppAuthDir} (keep oauth.json)`);
  }

  return {
    targetAgentId,
    targetMainKey,
    targetScope,
    stateDir,
    oauthDir,
    sessions: {
      legacyDir: sessionsLegacyDir,
      legacyStorePath: sessionsLegacyStorePath,
      targetDir: sessionsTargetDir,
      targetStorePath: sessionsTargetStorePath,
      hasLegacy: hasLegacySessions || legacyKeys.length > 0,
      legacyKeys,
    },
    agentDir: {
      legacyDir: legacyAgentDir,
      targetDir: targetAgentDir,
      hasLegacy: hasLegacyAgentDir,
    },
    whatsappAuth: {
      legacyDir: oauthDir,
      targetDir: targetWhatsAppAuthDir,
      hasLegacy: hasLegacyWhatsAppAuth,
    },
    preview,
  };
}

async function migrateLegacySessions(
  detected: LegacyStateDetection,
  now: () => number,
): Promise<{ changes: string[]; warnings: string[] }> {
  const changes: string[] = [];
  const warnings: string[] = [];
  if (!detected.sessions.hasLegacy) {
    return { changes, warnings };
  }

  ensureDir(detected.sessions.targetDir);

  const legacyParsed = fileExists(detected.sessions.legacyStorePath)
    ? readSessionStoreJson5(detected.sessions.legacyStorePath)
    : { store: {}, ok: true };
  const targetParsed = fileExists(detected.sessions.targetStorePath)
    ? readSessionStoreJson5(detected.sessions.targetStorePath)
    : { store: {}, ok: true };
  const legacyStore = legacyParsed.store;
  const targetStore = targetParsed.store;

  const canonicalizedTarget = canonicalizeSessionStore({
    store: targetStore,
    agentId: detected.targetAgentId,
    mainKey: detected.targetMainKey,
    scope: detected.targetScope,
  });
  const canonicalizedLegacy = canonicalizeSessionStore({
    store: legacyStore,
    agentId: detected.targetAgentId,
    mainKey: detected.targetMainKey,
    scope: detected.targetScope,
  });

  const merged: Record<string, SessionEntryLike> = { ...canonicalizedTarget.store };
  for (const [key, entry] of Object.entries(canonicalizedLegacy.store)) {
    merged[key] = mergeSessionEntry({
      existing: merged[key],
      incoming: entry,
      preferIncomingOnTie: false,
    });
  }

  const mainKey = buildAgentMainSessionKey({
    agentId: detected.targetAgentId,
    mainKey: detected.targetMainKey,
  });
  if (!merged[mainKey]) {
    const latest = pickLatestLegacyDirectEntry(legacyStore);
    if (latest?.sessionId) {
      merged[mainKey] = latest;
      changes.push(`Migrated latest direct-chat session → ${mainKey}`);
    }
  }

  if (!legacyParsed.ok) {
    warnings.push(
      `Legacy sessions store unreadable; left in place at ${detected.sessions.legacyStorePath}`,
    );
  }

  if (
    (legacyParsed.ok || targetParsed.ok) &&
    (Object.keys(legacyStore).length > 0 || Object.keys(targetStore).length > 0)
  ) {
    const normalized: Record<string, SessionEntry> = {};
    for (const [key, entry] of Object.entries(merged)) {
      const normalizedEntry = normalizeSessionEntry(entry);
      if (!normalizedEntry) {
        continue;
      }
      normalized[key] = normalizedEntry;
    }
    await saveSessionStore(detected.sessions.targetStorePath, normalized, {
      skipMaintenance: true,
    });
    changes.push(`Merged sessions store → ${detected.sessions.targetStorePath}`);
    if (canonicalizedTarget.legacyKeys.length > 0) {
      changes.push(`Canonicalized ${canonicalizedTarget.legacyKeys.length} legacy session key(s)`);
    }
  }

  const entries = safeReadDir(detected.sessions.legacyDir);
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (entry.name === "sessions.json") {
      continue;
    }
    const from = path.join(detected.sessions.legacyDir, entry.name);
    const to = path.join(detected.sessions.targetDir, entry.name);
    if (fileExists(to)) {
      continue;
    }
    try {
      fs.renameSync(from, to);
      changes.push(`Moved ${entry.name} → agents/${detected.targetAgentId}/sessions`);
    } catch (err) {
      warnings.push(`Failed moving ${from}: ${String(err)}`);
    }
  }

  if (legacyParsed.ok) {
    try {
      if (fileExists(detected.sessions.legacyStorePath)) {
        fs.rmSync(detected.sessions.legacyStorePath, { force: true });
      }
    } catch {
      // ignore
    }
  }

  removeDirIfEmpty(detected.sessions.legacyDir);
  const legacyLeft = safeReadDir(detected.sessions.legacyDir).filter((e) => e.isFile());
  if (legacyLeft.length > 0) {
    const backupDir = `${detected.sessions.legacyDir}.legacy-${now()}`;
    try {
      fs.renameSync(detected.sessions.legacyDir, backupDir);
      warnings.push(`Left legacy sessions at ${backupDir}`);
    } catch {
      // ignore
    }
  }

  return { changes, warnings };
}

export async function migrateLegacyAgentDir(
  detected: LegacyStateDetection,
  now: () => number,
): Promise<{ changes: string[]; warnings: string[] }> {
  const changes: string[] = [];
  const warnings: string[] = [];
  if (!detected.agentDir.hasLegacy) {
    return { changes, warnings };
  }

  ensureDir(detected.agentDir.targetDir);

  const entries = safeReadDir(detected.agentDir.legacyDir);
  for (const entry of entries) {
    const from = path.join(detected.agentDir.legacyDir, entry.name);
    const to = path.join(detected.agentDir.targetDir, entry.name);
    if (fs.existsSync(to)) {
      continue;
    }
    try {
      fs.renameSync(from, to);
      changes.push(`Moved agent file ${entry.name} → agents/${detected.targetAgentId}/agent`);
    } catch (err) {
      warnings.push(`Failed moving ${from}: ${String(err)}`);
    }
  }

  removeDirIfEmpty(detected.agentDir.legacyDir);
  if (!emptyDirOrMissing(detected.agentDir.legacyDir)) {
    const backupDir = path.join(
      detected.stateDir,
      "agents",
      detected.targetAgentId,
      `agent.legacy-${now()}`,
    );
    try {
      fs.renameSync(detected.agentDir.legacyDir, backupDir);
      warnings.push(`Left legacy agent dir at ${backupDir}`);
    } catch (err) {
      warnings.push(`Failed relocating legacy agent dir: ${String(err)}`);
    }
  }

  return { changes, warnings };
}

async function migrateLegacyWhatsAppAuth(
  detected: LegacyStateDetection,
): Promise<{ changes: string[]; warnings: string[] }> {
  const changes: string[] = [];
  const warnings: string[] = [];
  if (!detected.whatsappAuth.hasLegacy) {
    return { changes, warnings };
  }

  ensureDir(detected.whatsappAuth.targetDir);

  const entries = safeReadDir(detected.whatsappAuth.legacyDir);
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (entry.name === "oauth.json") {
      continue;
    }
    if (!isLegacyWhatsAppAuthFile(entry.name)) {
      continue;
    }
    const from = path.join(detected.whatsappAuth.legacyDir, entry.name);
    const to = path.join(detected.whatsappAuth.targetDir, entry.name);
    if (fileExists(to)) {
      continue;
    }
    try {
      fs.renameSync(from, to);
      changes.push(`Moved WhatsApp auth ${entry.name} → whatsapp/default`);
    } catch (err) {
      warnings.push(`Failed moving ${from}: ${String(err)}`);
    }
  }

  return { changes, warnings };
}

export async function runLegacyStateMigrations(params: {
  detected: LegacyStateDetection;
  now?: () => number;
}): Promise<{ changes: string[]; warnings: string[] }> {
  const now = params.now ?? (() => Date.now());
  const detected = params.detected;
  const sessions = await migrateLegacySessions(detected, now);
  const agentDir = await migrateLegacyAgentDir(detected, now);
  const whatsappAuth = await migrateLegacyWhatsAppAuth(detected);
  return {
    changes: [...sessions.changes, ...agentDir.changes, ...whatsappAuth.changes],
    warnings: [...sessions.warnings, ...agentDir.warnings, ...whatsappAuth.warnings],
  };
}

export async function autoMigrateLegacyAgentDir(params: {
  cfg: OpenClawCNConfig;
  env?: NodeJS.ProcessEnv;
  homedir?: () => string;
  log?: MigrationLogger;
  now?: () => number;
}): Promise<{
  migrated: boolean;
  skipped: boolean;
  changes: string[];
  warnings: string[];
}> {
  return await autoMigrateLegacyState(params);
}

export async function autoMigrateLegacyState(params: {
  cfg: OpenClawCNConfig;
  env?: NodeJS.ProcessEnv;
  homedir?: () => string;
  log?: MigrationLogger;
  now?: () => number;
}): Promise<{
  migrated: boolean;
  skipped: boolean;
  changes: string[];
  warnings: string[];
}> {
  if (autoMigrateChecked) {
    return { migrated: false, skipped: true, changes: [], warnings: [] };
  }
  autoMigrateChecked = true;

  const env = params.env ?? process.env;
  const stateDirResult = await autoMigrateLegacyStateDir({
    env,
    homedir: params.homedir,
    log: params.log,
  });
  if (env.OPENCLAWCN_AGENT_DIR?.trim() || env.PI_CODING_AGENT_DIR?.trim()) {
    return {
      migrated: stateDirResult.migrated,
      skipped: true,
      changes: stateDirResult.changes,
      warnings: stateDirResult.warnings,
    };
  }

  const detected = await detectLegacyStateMigrations({
    cfg: params.cfg,
    env,
    homedir: params.homedir,
  });
  if (!detected.sessions.hasLegacy && !detected.agentDir.hasLegacy) {
    return {
      migrated: stateDirResult.migrated,
      skipped: false,
      changes: stateDirResult.changes,
      warnings: stateDirResult.warnings,
    };
  }

  const now = params.now ?? (() => Date.now());
  const sessions = await migrateLegacySessions(detected, now);
  const agentDir = await migrateLegacyAgentDir(detected, now);
  const changes = [...stateDirResult.changes, ...sessions.changes, ...agentDir.changes];
  const warnings = [...stateDirResult.warnings, ...sessions.warnings, ...agentDir.warnings];

  const logger = params.log ?? createSubsystemLogger("state-migrations");
  if (changes.length > 0) {
    logger.info(`Auto-migrated legacy state:\n${changes.map((entry) => `- ${entry}`).join("\n")}`);
  }
  if (warnings.length > 0) {
    logger.warn(
      `Legacy state migration warnings:\n${warnings.map((entry) => `- ${entry}`).join("\n")}`,
    );
  }

  return {
    migrated: changes.length > 0,
    skipped: false,
    changes,
    warnings,
  };
}

// ── Workspace Memory Merge ──────────────────────────────────────────
// [CN-PATCH:migration-p0] Smart merge for workspace memory data when
// both legacy and target directories exist.

const IMPORT_MARKER = "Imported from legacy config";
const MERGE_PROFILE_MAX_ENTRIES = 50;

interface MergeProfileEntry {
  category: string;
  key: string;
  value: string;
  updatedAt: number;
  hits: number;
}

function isValidProfileEntry(e: unknown): e is MergeProfileEntry {
  if (!e || typeof e !== "object") return false;
  const obj = e as Record<string, unknown>;
  return (
    typeof obj.category === "string" &&
    typeof obj.key === "string" &&
    typeof obj.value === "string" &&
    typeof obj.updatedAt === "number" &&
    !Number.isNaN(obj.updatedAt)
  );
}

function readProfileSafe(
  filePath: string,
): { version: number; entries: MergeProfileEntry[] } | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.entries)) {
      const entries = parsed.entries.filter(isValidProfileEntry).map((e: MergeProfileEntry) => ({
        ...e,
        hits: typeof e.hits === "number" ? e.hits : 0,
      }));
      return { version: Number(parsed.version ?? 1), entries };
    }
    return null;
  } catch {
    return null;
  }
}

function writeFileAtomic(filePath: string, data: string): void {
  const tmpPath = filePath + `.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, data, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

export function mergeWorkspaceMemory(
  legacyWs: string,
  targetWs: string,
): { changes: string[]; warnings: string[] } {
  const changes: string[] = [];
  const warnings: string[] = [];

  // ── Profile merge ─────────────────────────────────────────────────
  const legacyProfilePath = path.join(legacyWs, "memory", "profile.json");
  const targetProfilePath = path.join(targetWs, "memory", "profile.json");

  if (fileExists(legacyProfilePath)) {
    const legacyProfile = readProfileSafe(legacyProfilePath);
    if (legacyProfile && legacyProfile.entries.length > 0) {
      ensureDir(path.join(targetWs, "memory"));

      if (!fileExists(targetProfilePath)) {
        // Target has no profile — copy from legacy
        const capped = legacyProfile.entries.slice(0, MERGE_PROFILE_MAX_ENTRIES);
        writeFileAtomic(
          targetProfilePath,
          JSON.stringify({ version: legacyProfile.version, entries: capped }, null, 2),
        );
        changes.push(`copied ${capped.length} profile entries from legacy`);
      } else {
        const targetProfile = readProfileSafe(targetProfilePath);
        if (targetProfile) {
          // Both exist — merge by (category, key)
          const targetMap = new Map<string, MergeProfileEntry>();
          for (const e of targetProfile.entries) {
            targetMap.set(`${e.category}::${e.key}`, e);
          }

          let newCount = 0;
          let updatedCount = 0;
          for (const legacyEntry of legacyProfile.entries) {
            const compositeKey = `${legacyEntry.category}::${legacyEntry.key}`;
            const existing = targetMap.get(compositeKey);
            if (!existing) {
              targetMap.set(compositeKey, legacyEntry);
              newCount++;
            } else if (legacyEntry.updatedAt > existing.updatedAt) {
              // Legacy has newer data for same key — update
              targetMap.set(compositeKey, {
                ...legacyEntry,
                hits: Math.max(legacyEntry.hits, existing.hits),
              });
              updatedCount++;
            }
            // else: target is newer or same — keep target
          }

          if (newCount > 0 || updatedCount > 0) {
            const merged = Array.from(targetMap.values())
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, MERGE_PROFILE_MAX_ENTRIES);
            writeFileAtomic(
              targetProfilePath,
              JSON.stringify(
                {
                  version: Math.max(targetProfile.version, legacyProfile.version),
                  entries: merged,
                },
                null,
                2,
              ),
            );
            if (newCount > 0) {
              changes.push(`merged ${newCount} new profile entries from legacy`);
            }
            if (updatedCount > 0) {
              changes.push(`updated profile entries from legacy (${updatedCount} newer)`);
            }
          }
        }
      }
    }
  }

  // ── MEMORY.md merge ───────────────────────────────────────────────
  const legacyMemoryMd = path.join(legacyWs, "MEMORY.md");
  const targetMemoryMd = path.join(targetWs, "MEMORY.md");

  if (fileExists(legacyMemoryMd)) {
    const legacyContent = fs.readFileSync(legacyMemoryMd, "utf-8");
    if (legacyContent.trim()) {
      ensureDir(targetWs);

      if (!fileExists(targetMemoryMd)) {
        fs.copyFileSync(legacyMemoryMd, targetMemoryMd);
        changes.push("copied MEMORY.md from legacy");
      } else {
        const targetContent = fs.readFileSync(targetMemoryMd, "utf-8");
        // Skip if already imported or content is identical
        if (targetContent.includes(IMPORT_MARKER)) {
          // Already imported — do nothing
        } else if (targetContent.trim() === legacyContent.trim()) {
          // Identical content — do nothing
        } else {
          // Append legacy content with import marker
          const now = new Date().toISOString().split("T")[0];
          const separator = `\n---\n<!-- ${IMPORT_MARKER} (${now}) -->\n`;
          writeFileAtomic(targetMemoryMd, targetContent.trimEnd() + separator + legacyContent);
          changes.push("appended legacy content to MEMORY.md");
        }
      }
    }
  }

  return { changes, warnings };
}

// ── Legacy Config Filename Migration ────────────────────────────────
// [CN-PATCH:migration-p0] Scan for legacy config filenames in a state
// dir and merge/rename them into the canonical openclawcn.json.

const LEGACY_CONFIG_FILENAMES = [
  "clawdbotcn.json",
  "clawdbot.json",
  "moldbot.json",
  "moltbot.json",
];

/**
 * Deep merge two config objects with smart array handling.
 * `target` values take priority for same keys.
 * Arrays of objects with `id` fields are merged by id.
 */
function deepMergeConfigsSmart(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...source };
  for (const key of Object.keys(target)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      tgtVal !== null &&
      typeof tgtVal === "object" &&
      !Array.isArray(tgtVal) &&
      srcVal !== null &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal)
    ) {
      result[key] = deepMergeConfigsSmart(
        srcVal as Record<string, unknown>,
        tgtVal as Record<string, unknown>,
      );
    } else if (Array.isArray(tgtVal) && Array.isArray(srcVal)) {
      // Smart array merge: if items have `id` fields, merge by id
      result[key] = mergeArraysSmart(srcVal, tgtVal);
    } else {
      result[key] = tgtVal;
    }
  }
  return result;
}

/**
 * Smart array merge: for arrays of objects with `id` fields, merge by id
 * (target entries win on conflict). For other arrays, target wins entirely.
 */
function mergeArraysSmart(source: unknown[], target: unknown[]): unknown[] {
  // Check if both arrays contain objects with `id` fields
  const sourceHasIds =
    source.length > 0 &&
    source.every(
      (item) => item && typeof item === "object" && "id" in (item as Record<string, unknown>),
    );
  const targetHasIds =
    target.length > 0 &&
    target.every(
      (item) => item && typeof item === "object" && "id" in (item as Record<string, unknown>),
    );

  if (sourceHasIds || targetHasIds) {
    // Merge by id: target entries take priority
    const seen = new Map<string, unknown>();
    // Source entries first (will be overridden by target)
    for (const item of source) {
      if (item && typeof item === "object") {
        const id = (item as Record<string, unknown>).id;
        if (typeof id === "string") {
          seen.set(id, item);
        }
      }
    }
    // Target entries override
    for (const item of target) {
      if (item && typeof item === "object") {
        const id = (item as Record<string, unknown>).id;
        if (typeof id === "string") {
          seen.set(id, item);
        }
      }
    }
    return Array.from(seen.values());
  }

  // Non-id arrays: target wins entirely (preserve existing behavior for
  // simple string arrays like allowCommands, deny lists, etc.)
  return target;
}

export function migrateLegacyConfigFilename(stateDir: string): {
  changes: string[];
  warnings: string[];
} {
  const changes: string[] = [];
  const warnings: string[] = [];
  const canonicalPath = path.join(stateDir, "openclawcn.json");

  for (const legacyName of LEGACY_CONFIG_FILENAMES) {
    const legacyPath = path.join(stateDir, legacyName);
    if (!fileExists(legacyPath)) continue;

    let legacyConfig: Record<string, unknown> | null = null;
    try {
      legacyConfig = JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    } catch {
      // Unreadable legacy file — remove it
      try {
        fs.unlinkSync(legacyPath);
        changes.push(`Removed unreadable legacy config: ${legacyName}`);
      } catch {
        /* ignore */
      }
      continue;
    }

    if (!legacyConfig || typeof legacyConfig !== "object") {
      try {
        fs.unlinkSync(legacyPath);
        changes.push(`Removed unreadable legacy config: ${legacyName}`);
      } catch {
        /* ignore */
      }
      continue;
    }

    if (!fileExists(canonicalPath)) {
      // No canonical config — rename legacy to canonical
      try {
        fs.renameSync(legacyPath, canonicalPath);
        changes.push(`Renamed ${legacyName} → openclawcn.json`);
      } catch (err) {
        warnings.push(`Failed to rename ${legacyName}: ${String(err)}`);
      }
    } else {
      // Both exist — merge (canonical wins)
      try {
        const canonicalConfig = JSON.parse(fs.readFileSync(canonicalPath, "utf-8"));
        const merged = deepMergeConfigsSmart(legacyConfig, canonicalConfig);
        writeFileAtomic(canonicalPath, JSON.stringify(merged, null, 2));
        fs.unlinkSync(legacyPath);
        changes.push(`merged ${legacyName} into openclawcn.json`);
      } catch (err) {
        warnings.push(`Failed to merge ${legacyName}: ${String(err)}`);
      }
    }
  }

  return { changes, warnings };
}
