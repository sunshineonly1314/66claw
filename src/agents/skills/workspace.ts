import {
  formatSkillsForPrompt,
  loadSkillsFromDir,
  type Skill,
} from "@mariozechner/pi-coding-agent";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OpenClawCNConfig } from "../../config/config.js";
import type {
  ParsedSkillFrontmatter,
  SkillEligibilityContext,
  SkillCommandSpec,
  SkillEntry,
  SkillSnapshot,
} from "./types.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { CONFIG_DIR, resolveUserPath } from "../../utils.js";
import { resolveSandboxPath } from "../sandbox-paths.js";
import { resolveBundledSkillsDir, resolvePrivateSkillsDir } from "./bundled-dir.js";
import { shouldIncludeSkill } from "./config.js";
import {
  parseFrontmatter,
  resolveOpenClawCNMetadata,
  resolveSkillInvocationPolicy,
} from "./frontmatter.js";
import { invalidateAllFileIndices } from "./file-index.js";
import { resolvePluginSkillDirs } from "./plugin-skills.js";
import { serializeByKey } from "./serialize.js";
import {
  decryptFile,
  ensureDirectoryEncrypted,
  isEncryptionEnabled,
} from "../../security/content-vault.js";

const fsp = fs.promises;
const skillsLogger = createSubsystemLogger("skills");
const skillCommandDebugOnce = new Set<string>();

/**
 * Load skills from a directory, handling encrypted (.md.enc) files.
 *
 * When encryption is enabled and .enc files exist, creates a temporary
 * decrypted copy for loadSkillsFromDir (which only reads plain .md files),
 * then cleans up immediately.
 */
function loadSkillsWithEncryption(params: {
  dir: string;
  source: string;
  loadSkills: (p: { dir: string; source: string }) => Skill[];
}): Skill[] {
  if (!isEncryptionEnabled() || !fs.existsSync(params.dir)) {
    return params.loadSkills({ dir: params.dir, source: params.source });
  }

  // Check if directory has any .enc files
  const hasEncFiles = hasEncryptedFiles(params.dir);
  if (!hasEncFiles) {
    return params.loadSkills({ dir: params.dir, source: params.source });
  }

  // Create temp dir, decrypt .enc files into it, load, then cleanup
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawdbot-skills-"));
  try {
    decryptDirectoryTo(params.dir, tmpDir);
    const skills = params.loadSkills({ dir: tmpDir, source: params.source });

    // Rewrite filePath to point back to original .enc paths so the model
    // uses the real path (decryption happens again at read time via attempt.ts)
    for (const skill of skills) {
      const relPath = path.relative(tmpDir, skill.filePath);
      const originalEnc = path.join(params.dir, relPath + ".enc");
      const originalPlain = path.join(params.dir, relPath);
      if (fs.existsSync(originalEnc)) {
        skill.filePath = originalEnc;
        skill.baseDir = path.dirname(originalEnc);
      } else if (fs.existsSync(originalPlain)) {
        skill.filePath = originalPlain;
        skill.baseDir = path.dirname(originalPlain);
      }
    }

    return skills;
  } catch (err) {
    skillsLogger.warn(`Failed to load encrypted skills from ${params.dir}: ${err}`);
    // 安全策略: 解密失败时不 fallback 到明文加载，防止跨机器绕过
    // 仅返回空数组，拒绝暴露受保护内容
    return [];
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}

/** Check recursively if a directory has any .enc files */
function hasEncryptedFiles(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md.enc")) return true;
      if (entry.isDirectory()) {
        if (hasEncryptedFiles(path.join(dir, entry.name))) return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

/** Decrypt .enc files from srcDir into destDir, preserving directory structure */
function decryptDirectoryTo(srcDir: string, destDir: string): void {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      const subDest = path.join(destDir, entry.name);
      fs.mkdirSync(subDest, { recursive: true });
      decryptDirectoryTo(srcPath, subDest);
    } else if (entry.isFile()) {
      if (entry.name.endsWith(".md.enc")) {
        // Decrypt to .md in temp dir
        const destName = entry.name.slice(0, -4); // remove .enc
        const destPath = path.join(destDir, destName);
        try {
          const plaintext = decryptFile(srcPath);
          fs.writeFileSync(destPath, plaintext, "utf-8");
        } catch (err) {
          skillsLogger.warn(`Failed to decrypt ${srcPath}: ${err}`);
        }
      } else {
        // Copy non-.enc files as-is (e.g. images, etc.)
        const destPath = path.join(destDir, entry.name);
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

function debugSkillCommandOnce(
  messageKey: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  if (skillCommandDebugOnce.has(messageKey)) {
    return;
  }
  skillCommandDebugOnce.add(messageKey);
  skillsLogger.debug(message, meta);
}

function filterSkillEntries(
  entries: SkillEntry[],
  config?: OpenClawCNConfig,
  skillFilter?: string[],
  eligibility?: SkillEligibilityContext,
): SkillEntry[] {
  let filtered = entries.filter((entry) => shouldIncludeSkill({ entry, config, eligibility }));
  // If skillFilter is provided, only include skills in the filter list.
  if (skillFilter !== undefined) {
    const normalized = skillFilter.map((entry) => String(entry).trim()).filter(Boolean);
    const label = normalized.length > 0 ? normalized.join(", ") : "(none)";
    skillsLogger.debug(`Applying skill filter: ${label}`);
    filtered =
      normalized.length > 0
        ? filtered.filter((entry) => normalized.includes(entry.skill.name))
        : [];
    skillsLogger.debug(`After filter: ${filtered.map((entry) => entry.skill.name).join(", ")}`);
  }
  return filtered;
}

const SKILL_COMMAND_MAX_LENGTH = 32;
const SKILL_COMMAND_FALLBACK = "skill";
// Discord command descriptions must be ≤100 characters
const SKILL_COMMAND_DESCRIPTION_MAX_LENGTH = 100;

function sanitizeSkillCommandName(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const trimmed = normalized.slice(0, SKILL_COMMAND_MAX_LENGTH);
  return trimmed || SKILL_COMMAND_FALLBACK;
}

function resolveUniqueSkillCommandName(base: string, used: Set<string>): string {
  const normalizedBase = base.toLowerCase();
  if (!used.has(normalizedBase)) {
    return base;
  }
  for (let index = 2; index < 1000; index += 1) {
    const suffix = `_${index}`;
    const maxBaseLength = Math.max(1, SKILL_COMMAND_MAX_LENGTH - suffix.length);
    const trimmedBase = base.slice(0, maxBaseLength);
    const candidate = `${trimmedBase}${suffix}`;
    const candidateKey = candidate.toLowerCase();
    if (!used.has(candidateKey)) {
      return candidate;
    }
  }
  const fallback = `${base.slice(0, Math.max(1, SKILL_COMMAND_MAX_LENGTH - 2))}_x`;
  return fallback;
}

function loadSkillEntries(
  workspaceDir: string,
  opts?: {
    config?: OpenClawCNConfig;
    managedSkillsDir?: string;
    bundledSkillsDir?: string;
    privateSkillsDir?: string;
  },
): SkillEntry[] {
  const loadSkills = (params: { dir: string; source: string }): Skill[] => {
    const loaded = loadSkillsFromDir(params);
    if (Array.isArray(loaded)) {
      return loaded;
    }
    if (
      loaded &&
      typeof loaded === "object" &&
      "skills" in loaded &&
      Array.isArray((loaded as { skills?: unknown }).skills)
    ) {
      return (loaded as { skills: Skill[] }).skills;
    }
    return [];
  };

  const managedSkillsDir = opts?.managedSkillsDir ?? path.join(CONFIG_DIR, "skills");
  const workspaceSkillsDir = path.resolve(workspaceDir, "skills");
  const bundledSkillsDir = opts?.bundledSkillsDir ?? resolveBundledSkillsDir();
  const extraDirsRaw = opts?.config?.skills?.load?.extraDirs ?? [];
  const extraDirs = extraDirsRaw
    .map((d) => (typeof d === "string" ? d.trim() : ""))
    .filter(Boolean);
  const pluginSkillDirs = resolvePluginSkillDirs({
    workspaceDir,
    config: opts?.config,
  });
  const mergedExtraDirs = [...extraDirs, ...pluginSkillDirs];

  // 首次启动时加密受保护的 skills（非开发模式）
  // bundled = 内置 skill（我们的 IP）
  // managed = 商店下载的 skill（官方/付费资产）
  // 用户自己写的 skill（extra/personal/project/workspace）不加密
  if (bundledSkillsDir) {
    ensureDirectoryEncrypted(bundledSkillsDir);
  }
  ensureDirectoryEncrypted(managedSkillsDir);

  const bundledSkills = bundledSkillsDir
    ? loadSkillsWithEncryption({
        dir: bundledSkillsDir,
        source: "openclawcn-bundled",
        loadSkills,
      })
    : [];

  // ── Private (owner-only) skills: not packaged, not distributed ──
  const privateSkillsDir = opts?.privateSkillsDir ?? resolvePrivateSkillsDir();
  if (privateSkillsDir) {
    ensureDirectoryEncrypted(privateSkillsDir);
  }
  const privateSkills = privateSkillsDir
    ? loadSkillsWithEncryption({
        dir: privateSkillsDir,
        source: "openclawcn-private",
        loadSkills,
      })
    : [];

  const extraSkills = mergedExtraDirs.flatMap((dir) => {
    const resolved = resolveUserPath(dir);
    return loadSkillsWithEncryption({
      dir: resolved,
      source: "openclawcn-extra",
      loadSkills,
    });
  });
  const managedSkills = loadSkillsWithEncryption({
    dir: managedSkillsDir,
    source: "openclawcn-managed",
    loadSkills,
  });
  const personalAgentsSkillsDir = path.resolve(os.homedir(), ".agents", "skills");
  const personalAgentsSkills = loadSkillsWithEncryption({
    dir: personalAgentsSkillsDir,
    source: "agents-skills-personal",
    loadSkills,
  });
  const projectAgentsSkillsDir = path.resolve(workspaceDir, ".agents", "skills");
  const projectAgentsSkills = loadSkillsWithEncryption({
    dir: projectAgentsSkillsDir,
    source: "agents-skills-project",
    loadSkills,
  });
  const workspaceSkills = loadSkillsWithEncryption({
    dir: workspaceSkillsDir,
    source: "openclawcn-workspace",
    loadSkills,
  });

  const merged = new Map<string, Skill>();
  // Precedence: extra < bundled < private < managed < agents-skills-personal < agents-skills-project < workspace
  for (const skill of extraSkills) {
    merged.set(skill.name, skill);
  }
  for (const skill of bundledSkills) {
    merged.set(skill.name, skill);
  }
  for (const skill of privateSkills) {
    merged.set(skill.name, skill);
  }
  for (const skill of managedSkills) {
    merged.set(skill.name, skill);
  }
  for (const skill of personalAgentsSkills) {
    merged.set(skill.name, skill);
  }
  for (const skill of projectAgentsSkills) {
    merged.set(skill.name, skill);
  }
  for (const skill of workspaceSkills) {
    merged.set(skill.name, skill);
  }

  const skillEntries: SkillEntry[] = Array.from(merged.values()).map((skill) => {
    let frontmatter: ParsedSkillFrontmatter = {};
    try {
      let raw: string;
      if (skill.filePath.endsWith(".md.enc")) {
        raw = decryptFile(skill.filePath);
      } else {
        raw = fs.readFileSync(skill.filePath, "utf-8");
      }
      frontmatter = parseFrontmatter(raw);
    } catch {
      // ignore malformed skills
    }
    return {
      skill,
      frontmatter,
      metadata: resolveOpenClawCNMetadata(frontmatter),
      invocation: resolveSkillInvocationPolicy(frontmatter),
    };
  });
  return skillEntries;
}

export function buildWorkspaceSkillSnapshot(
  workspaceDir: string,
  opts?: {
    config?: OpenClawCNConfig;
    managedSkillsDir?: string;
    bundledSkillsDir?: string;
    entries?: SkillEntry[];
    /** If provided, only include skills with these names */
    skillFilter?: string[];
    eligibility?: SkillEligibilityContext;
    snapshotVersion?: number;
  },
): SkillSnapshot {
  const skillEntries = opts?.entries ?? loadSkillEntries(workspaceDir, opts);
  const eligible = filterSkillEntries(
    skillEntries,
    opts?.config,
    opts?.skillFilter,
    opts?.eligibility,
  );
  const promptEntries = eligible.filter(
    (entry) => entry.invocation?.disableModelInvocation !== true,
  );
  const resolvedSkills = promptEntries.map((entry) => entry.skill);
  const remoteNote = opts?.eligibility?.remote?.note?.trim();
  const prompt = [remoteNote, formatSkillsForPrompt(resolvedSkills)].filter(Boolean).join("\n");
  return {
    prompt,
    skills: eligible.map((entry) => ({
      name: entry.skill.name,
      primaryEnv: entry.metadata?.primaryEnv,
    })),
    resolvedSkills,
    version: opts?.snapshotVersion,
  };
}

export function buildWorkspaceSkillsPrompt(
  workspaceDir: string,
  opts?: {
    config?: OpenClawCNConfig;
    managedSkillsDir?: string;
    bundledSkillsDir?: string;
    entries?: SkillEntry[];
    /** If provided, only include skills with these names */
    skillFilter?: string[];
    eligibility?: SkillEligibilityContext;
  },
): string {
  const skillEntries = opts?.entries ?? loadSkillEntries(workspaceDir, opts);
  const eligible = filterSkillEntries(
    skillEntries,
    opts?.config,
    opts?.skillFilter,
    opts?.eligibility,
  );
  const promptEntries = eligible.filter(
    (entry) => entry.invocation?.disableModelInvocation !== true,
  );
  const remoteNote = opts?.eligibility?.remote?.note?.trim();
  return [remoteNote, formatSkillsForPrompt(promptEntries.map((entry) => entry.skill))]
    .filter(Boolean)
    .join("\n");
}

export function resolveSkillsPromptForRun(params: {
  skillsSnapshot?: SkillSnapshot;
  entries?: SkillEntry[];
  config?: OpenClawCNConfig;
  workspaceDir: string;
}): string {
  const snapshotPrompt = params.skillsSnapshot?.prompt?.trim();
  if (snapshotPrompt) {
    return snapshotPrompt;
  }
  if (params.entries && params.entries.length > 0) {
    const prompt = buildWorkspaceSkillsPrompt(params.workspaceDir, {
      entries: params.entries,
      config: params.config,
    });
    return prompt.trim() ? prompt : "";
  }
  return "";
}

export function loadWorkspaceSkillEntries(
  workspaceDir: string,
  opts?: {
    config?: OpenClawCNConfig;
    managedSkillsDir?: string;
    bundledSkillsDir?: string;
  },
): SkillEntry[] {
  return loadSkillEntries(workspaceDir, opts);
}

/**
 * Invalidate all cached skill entries (file indices).
 * Call after installing/uninstalling skills to ensure the next load
 * picks up changes from disk.
 */
export function invalidateSkillEntriesCache(): void {
  invalidateAllFileIndices();
}

function resolveUniqueSyncedSkillDirName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  let fallbackIndex = 10_000;
  let fallback = `${base}-${fallbackIndex}`;
  while (used.has(fallback)) {
    fallbackIndex += 1;
    fallback = `${base}-${fallbackIndex}`;
  }
  used.add(fallback);
  return fallback;
}

function resolveSyncedSkillDestinationPath(params: {
  targetSkillsDir: string;
  entry: SkillEntry;
  usedDirNames: Set<string>;
}): string | null {
  const sourceDirName = path.basename(params.entry.skill.baseDir).trim();
  if (!sourceDirName || sourceDirName === "." || sourceDirName === "..") {
    return null;
  }
  const uniqueDirName = resolveUniqueSyncedSkillDirName(sourceDirName, params.usedDirNames);
  return resolveSandboxPath({
    filePath: uniqueDirName,
    cwd: params.targetSkillsDir,
    root: params.targetSkillsDir,
  }).resolved;
}

export async function syncSkillsToWorkspace(params: {
  sourceWorkspaceDir: string;
  targetWorkspaceDir: string;
  config?: OpenClawCNConfig;
  managedSkillsDir?: string;
  bundledSkillsDir?: string;
}) {
  const sourceDir = resolveUserPath(params.sourceWorkspaceDir);
  const targetDir = resolveUserPath(params.targetWorkspaceDir);
  if (sourceDir === targetDir) {
    return;
  }

  await serializeByKey(`syncSkills:${targetDir}`, async () => {
    const targetSkillsDir = path.join(targetDir, "skills");

    const entries = loadSkillEntries(sourceDir, {
      config: params.config,
      managedSkillsDir: params.managedSkillsDir,
      bundledSkillsDir: params.bundledSkillsDir,
    });

    await fsp.rm(targetSkillsDir, { recursive: true, force: true });
    await fsp.mkdir(targetSkillsDir, { recursive: true });

    const usedDirNames = new Set<string>();
    for (const entry of entries) {
      let dest: string | null = null;
      try {
        dest = resolveSyncedSkillDestinationPath({
          targetSkillsDir,
          entry,
          usedDirNames,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        console.warn(
          `[skills] Failed to resolve safe destination for ${entry.skill.name}: ${message}`,
        );
        continue;
      }
      if (!dest) {
        console.warn(
          `[skills] Failed to resolve safe destination for ${entry.skill.name}: invalid source directory name`,
        );
        continue;
      }
      try {
        await fsp.cp(entry.skill.baseDir, dest, {
          recursive: true,
          force: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        console.warn(`[skills] Failed to copy ${entry.skill.name} to sandbox: ${message}`);
      }
    }
  });
}

export function filterWorkspaceSkillEntries(
  entries: SkillEntry[],
  config?: OpenClawCNConfig,
): SkillEntry[] {
  return filterSkillEntries(entries, config);
}

export function buildWorkspaceSkillCommandSpecs(
  workspaceDir: string,
  opts?: {
    config?: OpenClawCNConfig;
    managedSkillsDir?: string;
    bundledSkillsDir?: string;
    entries?: SkillEntry[];
    skillFilter?: string[];
    eligibility?: SkillEligibilityContext;
    reservedNames?: Set<string>;
  },
): SkillCommandSpec[] {
  const skillEntries = opts?.entries ?? loadSkillEntries(workspaceDir, opts);
  const eligible = filterSkillEntries(
    skillEntries,
    opts?.config,
    opts?.skillFilter,
    opts?.eligibility,
  );
  const userInvocable = eligible.filter((entry) => entry.invocation?.userInvocable !== false);
  const used = new Set<string>();
  for (const reserved of opts?.reservedNames ?? []) {
    used.add(reserved.toLowerCase());
  }

  const specs: SkillCommandSpec[] = [];
  for (const entry of userInvocable) {
    const rawName = entry.skill.name;
    const base = sanitizeSkillCommandName(rawName);
    if (base !== rawName) {
      debugSkillCommandOnce(
        `sanitize:${rawName}:${base}`,
        `Sanitized skill command name "${rawName}" to "/${base}".`,
        { rawName, sanitized: `/${base}` },
      );
    }
    const unique = resolveUniqueSkillCommandName(base, used);
    if (unique !== base) {
      debugSkillCommandOnce(
        `dedupe:${rawName}:${unique}`,
        `De-duplicated skill command name for "${rawName}" to "/${unique}".`,
        { rawName, deduped: `/${unique}` },
      );
    }
    used.add(unique.toLowerCase());
    const rawDescription = entry.skill.description?.trim() || rawName;
    const description =
      rawDescription.length > SKILL_COMMAND_DESCRIPTION_MAX_LENGTH
        ? rawDescription.slice(0, SKILL_COMMAND_DESCRIPTION_MAX_LENGTH - 1) + "…"
        : rawDescription;
    const dispatch = (() => {
      const kindRaw = (
        entry.frontmatter?.["command-dispatch"] ??
        entry.frontmatter?.["command_dispatch"] ??
        ""
      )
        .trim()
        .toLowerCase();
      if (!kindRaw) {
        return undefined;
      }
      if (kindRaw !== "tool") {
        return undefined;
      }

      const toolName = (
        entry.frontmatter?.["command-tool"] ??
        entry.frontmatter?.["command_tool"] ??
        ""
      ).trim();
      if (!toolName) {
        debugSkillCommandOnce(
          `dispatch:missingTool:${rawName}`,
          `Skill command "/${unique}" requested tool dispatch but did not provide command-tool. Ignoring dispatch.`,
          { skillName: rawName, command: unique },
        );
        return undefined;
      }

      const argModeRaw = (
        entry.frontmatter?.["command-arg-mode"] ??
        entry.frontmatter?.["command_arg_mode"] ??
        ""
      )
        .trim()
        .toLowerCase();
      const argMode = !argModeRaw || argModeRaw === "raw" ? "raw" : null;
      if (!argMode) {
        debugSkillCommandOnce(
          `dispatch:badArgMode:${rawName}:${argModeRaw}`,
          `Skill command "/${unique}" requested tool dispatch but has unknown command-arg-mode. Falling back to raw.`,
          { skillName: rawName, command: unique, argMode: argModeRaw },
        );
      }

      return { kind: "tool", toolName, argMode: "raw" } as const;
    })();

    specs.push({
      name: unique,
      skillName: rawName,
      description,
      ...(dispatch ? { dispatch } : {}),
    });
  }
  return specs;
}
