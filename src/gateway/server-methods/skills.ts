import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OpenClawCNConfig } from "../../config/config.js";
import type { GatewayRequestHandlers, RespondFn } from "./types.js";
import {
  listAgentIds,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "../../agents/agent-scope.js";
import { installSkill } from "../../agents/skills-install.js";
import { buildWorkspaceSkillStatus } from "../../agents/skills-status.js";
import {
  loadWorkspaceSkillEntries,
  invalidateSkillEntriesCache,
  type SkillEntry,
} from "../../agents/skills.js";
import { clearBinaryCache } from "../../agents/skills/config.js";
import { registerToolsRoot } from "../../shared/config-eval.js";
import { CONFIG_DIR } from "../../utils.js";
import {
  fetchRemoteSkillsIndex,
  getInstalledSkills,
  installRemoteSkill,
  getManagedSkillsDir,
} from "../../agents/skills/gitee-registry.js";
import {
  getSkillsMarket,
  forceRefreshMarket,
  refreshInstalledList,
} from "../../agents/skills/sync.js";
import { parseFrontmatter, resolveSkillKey } from "../../agents/skills/frontmatter.js";
import { bumpSkillsSnapshotVersion } from "../../agents/skills/refresh.js";
import { loadConfig, writeConfigFile, withConfigWriteLock } from "../../config/config.js";
import { getRemoteSkillEligibility } from "../../infra/skills-remote.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { normalizeSecretInput } from "../../utils/normalize-secret-input.js";
import { detectChinaRegion, isSkillHiddenInCn } from "../../config/region-cn.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateSkillsBinsParams,
  validateSkillsInstallParams,
  validateSkillsStatusParams,
  validateSkillsUpdateParams,
} from "../protocol/index.js";

// ---------------------------------------------------------------------------
// Cache for skills.status — buildWorkspaceSkillStatus calls hasBinary() which
// scans the PATH (including large node_modules dirs), taking 3-11s on Windows.
const SKILLS_STATUS_CACHE_TTL_MS = 15_000;
type SkillStatusCacheEntry = { result: unknown; at: number };
const _skillsStatusCache = new Map<string, SkillStatusCacheEntry>();
let _skillsStatusInflight = new Map<string, Promise<unknown>>();

/**
 * Get skill status with cache + inflight dedup.
 * Shared by skills.status handler and mcp.marketplace.recommend handler
 * to avoid redundant 3-11s synchronous PATH scans on Windows.
 */
export function getSkillStatusCached(
  workspaceDir: string,
  cfg: OpenClawCNConfig,
  cacheKey: string,
): Promise<unknown> {
  const now = Date.now();
  const cached = _skillsStatusCache.get(cacheKey);
  if (cached && now - cached.at < SKILLS_STATUS_CACHE_TTL_MS) {
    return Promise.resolve(cached.result);
  }
  const inflight = _skillsStatusInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }
  registerToolsRoot(path.join(CONFIG_DIR, "tools"));
  const req = Promise.resolve()
    .then(() => {
      const report = buildWorkspaceSkillStatus(workspaceDir, {
        config: cfg,
        eligibility: { remote: getRemoteSkillEligibility() },
      });
      _skillsStatusCache.set(cacheKey, { result: report, at: Date.now() });
      _skillsStatusInflight.delete(cacheKey);
      return report;
    })
    .catch((err: unknown) => {
      _skillsStatusInflight.delete(cacheKey);
      throw err;
    });
  _skillsStatusInflight.set(cacheKey, req);
  return req;
}

// ---------------------------------------------------------------------------
// Path safety: block sensitive system directories from skills.browse/import
// ---------------------------------------------------------------------------
const BLOCKED_PATH_PATTERNS =
  process.platform === "win32"
    ? [/^[a-z]:\\windows\\/i, /^[a-z]:\\programdata\\/i, /\\system32\\/i, /\\syswow64\\/i]
    : [/^\/etc\b/, /^\/var\/log\b/, /^\/proc\b/, /^\/sys\b/, /^\/dev\b/, /^\/boot\b/];

function isPathBlocked(targetPath: string): boolean {
  const normalized = targetPath.replace(/\\/g, "/");
  // Block paths that look like SSH/credential directories (case-insensitive for Windows)
  if (/\/\.ssh(\/|$)/i.test(normalized)) return true;
  if (/\/\.gnupg(\/|$)/i.test(normalized)) return true;
  if (/\/\.aws(\/|$)/i.test(normalized)) return true;
  if (/\/\.kube(\/|$)/i.test(normalized)) return true;
  if (/\/\.docker(\/|$)/i.test(normalized)) return true;
  if (/\/\.azure(\/|$)/i.test(normalized)) return true;
  // Check platform-specific patterns against BOTH original and normalized paths
  // to prevent bypass via forward-slash paths on Windows
  for (const re of BLOCKED_PATH_PATTERNS) {
    if (re.test(targetPath) || re.test(normalized)) return true;
  }
  return false;
}

// FIX: Use shared config write lock instead of local mutex.
// The local mutex only serialized skill operations, but skills.update writes to the
// same openclawcn.json as agents/routes/model-config, creating cross-module races.

function listWorkspaceDirs(cfg: OpenClawCNConfig): string[] {
  const dirs = new Set<string>();
  const list = cfg.agents?.list;
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (entry && typeof entry === "object" && typeof entry.id === "string") {
        dirs.add(resolveAgentWorkspaceDir(cfg, entry.id));
      }
    }
  }
  dirs.add(resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg)));
  return [...dirs];
}

function collectSkillBins(entries: SkillEntry[]): string[] {
  const bins = new Set<string>();
  for (const entry of entries) {
    const required = entry.metadata?.requires?.bins ?? [];
    const anyBins = entry.metadata?.requires?.anyBins ?? [];
    const install = entry.metadata?.install ?? [];
    for (const bin of required) {
      const trimmed = bin.trim();
      if (trimmed) {
        bins.add(trimmed);
      }
    }
    for (const bin of anyBins) {
      const trimmed = bin.trim();
      if (trimmed) {
        bins.add(trimmed);
      }
    }
    for (const spec of install) {
      const specBins = spec?.bins ?? [];
      for (const bin of specBins) {
        const trimmed = String(bin).trim();
        if (trimmed) {
          bins.add(trimmed);
        }
      }
    }
  }
  return [...bins].toSorted();
}

// ---------------------------------------------------------------------------
// skills.update inner logic (uses shared config write lock for cross-module safety)
// ---------------------------------------------------------------------------
async function _skillsUpdateInner(params: unknown, respond: RespondFn): Promise<void> {
  await withConfigWriteLock(async () => {
    await _skillsUpdateInnerLocked(params, respond);
  });
}

async function _skillsUpdateInnerLocked(params: unknown, respond: RespondFn): Promise<void> {
  const p = params as {
    skillKey: string;
    enabled?: boolean;
    apiKey?: string;
    env?: Record<string, string>;
    pinned?: boolean;
  };
  const cfg = loadConfig();
  const skills = cfg.skills ? { ...cfg.skills } : {};
  const entries = skills.entries ? { ...skills.entries } : {};
  const current = entries[p.skillKey] ? { ...entries[p.skillKey] } : {};
  if (typeof p.enabled === "boolean") {
    current.enabled = p.enabled;
  }
  if (typeof p.apiKey === "string") {
    const trimmed = normalizeSecretInput(p.apiKey);
    if (trimmed) {
      current.apiKey = trimmed;
    } else {
      delete current.apiKey;
    }
  }
  if (p.env && typeof p.env === "object") {
    const nextEnv = current.env ? { ...current.env } : {};
    for (const [key, value] of Object.entries(p.env)) {
      const trimmedKey = key.trim();
      if (!trimmedKey) {
        continue;
      }
      const trimmedVal = value.trim();
      if (!trimmedVal) {
        delete nextEnv[trimmedKey];
      } else {
        nextEnv[trimmedKey] = trimmedVal;
      }
    }
    current.env = nextEnv;
  }
  entries[p.skillKey] = current;
  skills.entries = entries;

  const CORE_SKILLS_MAX = 50;
  if (typeof p.pinned === "boolean") {
    const pinnedList = skills.pinnedSkills ? [...skills.pinnedSkills] : [];
    if (p.pinned) {
      const defaultAgentId = resolveDefaultAgentId(cfg);
      const workspaceDir = resolveAgentWorkspaceDir(cfg, defaultAgentId);
      const allEntries = loadWorkspaceSkillEntries(workspaceDir, { config: cfg });
      const matchedEntry = allEntries.find((e) => {
        const key = resolveSkillKey(e.skill, e);
        return key === p.skillKey || e.skill.name === p.skillKey;
      });
      if (!matchedEntry) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `技能 "${p.skillKey}" 不存在，请检查技能名称是否正确。`,
          ),
        );
        return;
      }
      const canonicalKey = resolveSkillKey(matchedEntry.skill, matchedEntry);
      const idx = pinnedList.indexOf(canonicalKey);
      if (idx === -1) {
        if (pinnedList.length >= CORE_SKILLS_MAX) {
          respond(
            false,
            undefined,
            errorShape(
              ErrorCodes.INVALID_REQUEST,
              `核心技能已达上限 (${CORE_SKILLS_MAX})，请先移除其他核心技能再添加。技能过多会导致每次请求浪费大量 token。`,
            ),
          );
          return;
        }
        pinnedList.push(canonicalKey);
      }
      // Note: allowBundled sync removed. pinnedSkills is the sole gate for prompt injection.
    } else {
      // Unpin: try both p.skillKey and the canonical key to handle name vs skillKey mismatch.
      // The pinnedList may store the canonical key (resolved during pin), but the UI
      // may send the skill name instead.
      let idx = pinnedList.indexOf(p.skillKey);
      if (idx === -1) {
        // Resolve canonical key by scanning loaded entries
        const defaultAgentId = resolveDefaultAgentId(cfg);
        const workspaceDir = resolveAgentWorkspaceDir(cfg, defaultAgentId);
        const allEntries = loadWorkspaceSkillEntries(workspaceDir, { config: cfg });
        const matchedEntry = allEntries.find((e) => {
          const key = resolveSkillKey(e.skill, e);
          return key === p.skillKey || e.skill.name === p.skillKey;
        });
        if (matchedEntry) {
          const canonicalKey = resolveSkillKey(matchedEntry.skill, matchedEntry);
          idx = pinnedList.indexOf(canonicalKey);
          if (idx === -1) {
            // Also try the raw name in case pinnedList stored it by name
            idx = pinnedList.indexOf(matchedEntry.skill.name);
          }
        }
      }
      if (idx !== -1) {
        pinnedList.splice(idx, 1);
      }
    }
    skills.pinnedSkills = pinnedList.length > 0 ? pinnedList : undefined;
  }
  const nextConfig: OpenClawCNConfig = {
    ...cfg,
    skills,
  };
  await writeConfigFile(nextConfig);
  respond(true, { ok: true, skillKey: p.skillKey, config: current }, undefined);
}

export const skillsHandlers: GatewayRequestHandlers = {
  "skills.status": async ({ params, respond }) => {
    if (!validateSkillsStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.status params: ${formatValidationErrors(validateSkillsStatusParams.errors)}`,
        ),
      );
      return;
    }
    // 用 await + setImmediate 让出事件循环，避免长时间阻塞其他请求
    await new Promise<void>((resolve) => setImmediate(resolve));
    const cfg = loadConfig();
    const agentIdRaw = typeof params?.agentId === "string" ? params.agentId.trim() : "";
    const agentId = agentIdRaw ? normalizeAgentId(agentIdRaw) : resolveDefaultAgentId(cfg);
    if (agentIdRaw) {
      const knownAgents = listAgentIds(cfg);
      if (!knownAgents.includes(agentId)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `unknown agent id "${agentIdRaw}"`),
        );
        return;
      }
    }

    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const report = await getSkillStatusCached(workspaceDir, cfg, agentId);
    respond(true, report, undefined);
  },
  "skills.bins": ({ params, respond }) => {
    if (!validateSkillsBinsParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.bins params: ${formatValidationErrors(validateSkillsBinsParams.errors)}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const workspaceDirs = listWorkspaceDirs(cfg);
    const bins = new Set<string>();
    for (const workspaceDir of workspaceDirs) {
      const entries = loadWorkspaceSkillEntries(workspaceDir, { config: cfg });
      for (const bin of collectSkillBins(entries)) {
        bins.add(bin);
      }
    }
    respond(true, { bins: [...bins].toSorted() }, undefined);
  },
  "skills.install": async ({ params, respond, context }) => {
    if (!validateSkillsInstallParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.install params: ${formatValidationErrors(validateSkillsInstallParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as {
      name: string;
      installId: string;
      timeoutMs?: number;
    };

    // CN region: block installation of hidden/blocked skills
    if (detectChinaRegion() && isSkillHiddenInCn(p.name)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `技能 "${p.name}" 在当前区域不可用。`),
      );
      return;
    }

    const cfg = loadConfig();

    // Broadcast install progress to UI via WebSocket
    const onProgress = (progress: {
      stage: string;
      message: string;
      percent?: number;
      downloadInfo?: { speed?: string; eta?: string; downloaded?: string; total?: string };
      usingCNMirror?: boolean;
    }) => {
      context.broadcast(
        "skill.install.progress",
        { skillName: p.name, installId: p.installId, ...progress },
        { dropIfSlow: true },
      );
    };

    // 如果 installId 是 "gitee"，说明是从技能市场安装远程技能
    // 需要先从远程下载技能到本地托管目录
    if (p.installId === "gitee") {
      const managedSkillsDir = getManagedSkillsDir();
      const remoteResult = await installRemoteSkill(
        { name: p.name, description: "", path: p.name },
        undefined,
        managedSkillsDir,
      );

      if (!remoteResult.ok) {
        respond(
          false,
          { ok: false, message: remoteResult.error, stdout: "", stderr: "", code: null },
          errorShape(ErrorCodes.UNAVAILABLE, remoteResult.error),
        );
        return;
      }

      // 远程技能下载成功后，检查是否需要安装依赖
      // OpenClawCN 专属：自动安装远程技能的 CLI 依赖（如 grizzly、himalaya 等）
      const skillEntries = loadWorkspaceSkillEntries(managedSkillsDir, { config: cfg });
      const targetEntry = skillEntries.find((e) => e.skill.name === p.name);

      if (targetEntry && targetEntry.metadata?.install && targetEntry.metadata.install.length > 0) {
        // OpenClawCN 专属：根据当前操作系统过滤 install spec
        // 修复 Windows 用户点击一键安装时，错误选择 macOS-only 的 brew 方式的问题
        const platform = process.platform;
        const filteredInstall = targetEntry.metadata.install.filter((spec) => {
          // 检查 OS 限制
          const osList = spec.os ?? [];
          if (osList.length > 0 && !osList.includes(platform)) {
            return false;
          }
          // brew 只在 macOS 上可用
          if (spec.kind === "brew" && platform !== "darwin") {
            return false;
          }
          return true;
        });

        if (filteredInstall.length === 0) {
          // 没有适用于当前平台的安装方式
          respond(
            false,
            {
              ok: false,
              message: `此技能没有适用于 ${platform} 平台的安装方式`,
              stdout: "",
              stderr: "",
              code: null,
            },
            errorShape(
              ErrorCodes.UNAVAILABLE,
              `No install method available for platform: ${platform}`,
            ),
          );
          return;
        }

        // 技能有依赖需要安装 - 选择第一个适用于当前平台的 install spec
        const firstInstallSpec = filteredInstall[0];
        const installId = firstInstallSpec.id ?? `${firstInstallSpec.kind}-0`;

        const depResult = await installSkill({
          workspaceDir: managedSkillsDir,
          skillName: p.name,
          installId,
          timeoutMs: p.timeoutMs ?? 180_000,
          config: cfg,
          onProgress,
        });

        if (!depResult.ok) {
          // 依赖安装失败，返回错误但保留已下载的 SKILL.md
          respond(false, depResult, errorShape(ErrorCodes.UNAVAILABLE, depResult.message));
          return;
        }
      }

      // 远程技能安装成功（包括依赖）：
      // 0. 清除二进制缓存，确保下次 skills.status 能检测到新安装的工具
      clearBinaryCache();
      invalidateSkillEntriesCache();
      _skillsStatusCache.clear(); // 安装后必须失效状态缓存，确保下次刷新看到新技能
      // 1. 立即标记 SQLite 中此技能为已安装（不依赖全量 refresh 的异步过程）
      try {
        const { markSkillInstalled } = await import("../../agents/skills/marketplace/db.js");
        markSkillInstalled(p.name);
      } catch {
        // SQLite 不可用，忽略
      }
      // 2. 全量刷新已安装列表（await，确保 JSON 索引也同步更新后再响应 UI）
      try {
        await refreshInstalledList();
      } catch {
        // 刷新失败不影响响应
      }
      // 3. 更新技能快照版本，让当前对话的下一条消息能立即使用新技能
      bumpSkillsSnapshotVersion({ reason: "manual" });

      respond(true, { ok: true, message: "已安装", stdout: "", stderr: "", code: 0 }, undefined);
      return;
    }

    // 本地技能安装（有 install spec 的技能）
    const workspaceDirRaw = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
    const result = await installSkill({
      workspaceDir: workspaceDirRaw,
      skillName: p.name,
      installId: p.installId,
      timeoutMs: p.timeoutMs,
      config: cfg,
      onProgress,
    });

    // 安装后：
    if (result.ok) {
      // 0. 清除二进制缓存，确保下次 skills.status 能检测到新安装的工具
      clearBinaryCache();
      invalidateSkillEntriesCache();
      _skillsStatusCache.clear();
      // 1. 立即标记 SQLite 中此技能为已安装
      try {
        const { markSkillInstalled } = await import("../../agents/skills/marketplace/db.js");
        markSkillInstalled(p.name);
      } catch {
        // SQLite 不可用，忽略
      }
      // 2. 全量刷新本地索引中的已安装列表（await 确保完成后再响应）
      try {
        await refreshInstalledList();
      } catch {
        // 刷新失败不影响响应
      }
      // 3. 更新技能快照版本，让当前对话的下一条消息能立即使用新技能
      bumpSkillsSnapshotVersion({ reason: "manual" });
    }

    respond(
      result.ok,
      result,
      result.ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, result.message),
    );
  },
  "skills.update": async ({ params, respond }) => {
    if (!validateSkillsUpdateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.update params: ${formatValidationErrors(validateSkillsUpdateParams.errors)}`,
        ),
      );
      return;
    }
    // FIX: _skillsUpdateInner now uses shared withConfigWriteLock internally,
    // which serializes both skill operations and cross-module config writes.
    await _skillsUpdateInner(params, respond);
  },
  "skills.remote.list": async ({ params, respond }) => {
    const result = await fetchRemoteSkillsIndex();
    if (!result.ok) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, result.error));
      return;
    }
    const installedSkills = new Set(getInstalledSkills());
    const skillsWithStatus = result.index.skills.map((skill) => ({
      ...skill,
      installed: installedSkills.has(skill.name),
    }));
    respond(
      true,
      {
        version: result.index.version,
        updated: result.index.updated,
        skills: skillsWithStatus,
      },
      undefined,
    );
  },

  // 技能市场 - 读取本地索引（快速，无网络延迟）
  "skills.market.list": async ({ params, respond }) => {
    const result = await getSkillsMarket();
    respond(true, result, undefined);
  },

  // 技能市场 - 强制刷新（用户手动触发）
  "skills.market.refresh": async ({ params, respond }) => {
    const result = await forceRefreshMarket();
    respond(true, result, undefined);
  },

  // ---------------------------------------------------------------------------
  // 本地技能导入 — 浏览目录
  // ---------------------------------------------------------------------------
  "skills.browse": ({ params, respond }) => {
    const p = params as { path?: string };
    const targetPath = p.path ? path.resolve(p.path) : os.homedir();

    if (isPathBlocked(targetPath)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "无法浏览此系统目录"));
      return;
    }

    try {
      const stat = fs.statSync(targetPath);
      if (!stat.isDirectory()) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "路径不是目录"));
        return;
      }
    } catch {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "路径不存在或无法访问"));
      return;
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const directories: Array<{ name: string; path: string; hasSkillMd: boolean }> = [];
    const files: Array<{ name: string; path: string }> = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        const hasSkillMd = fs.existsSync(path.join(fullPath, "SKILL.md"));
        directories.push({ name: entry.name, path: fullPath, hasSkillMd });
      } else if (entry.isFile() && entry.name.toUpperCase() === "SKILL.MD") {
        files.push({ name: entry.name, path: fullPath });
      }
    }

    directories.sort((a, b) => a.name.localeCompare(b.name));

    const parentPath = path.dirname(targetPath);
    const hasParent = parentPath !== targetPath;

    let drives: string[] = [];
    if (os.platform() === "win32") {
      for (const letter of "CDEFGHIJKLMNOPQRSTUVWXYZ") {
        try {
          fs.accessSync(`${letter}:\\`);
          drives.push(`${letter}:\\`);
        } catch {
          /* skip */
        }
      }
    }

    respond(
      true,
      {
        currentPath: targetPath,
        parentPath: hasParent ? parentPath : null,
        directories,
        files,
        drives,
        separator: path.sep,
        isSkillDir: fs.existsSync(path.join(targetPath, "SKILL.md")),
        skillSubdirCount: directories.filter((d) => d.hasSkillMd).length,
      },
      undefined,
    );
  },

  // ---------------------------------------------------------------------------
  // 本地技能导入 — 执行导入
  // ---------------------------------------------------------------------------
  "skills.import": async ({ params, respond }) => {
    const p = params as { path: string; mode?: "copy" | "reference" };
    if (!p.path || typeof p.path !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "缺少 path 参数"));
      return;
    }
    const targetPath = path.resolve(p.path);
    const mode = p.mode ?? "copy";

    if (isPathBlocked(targetPath)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "无法从此系统目录导入"));
      return;
    }

    if (!fs.existsSync(targetPath)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "路径不存在"));
      return;
    }

    const stat = fs.statSync(targetPath);

    // --- 导入单个 SKILL.md 文件 ---
    if (stat.isFile()) {
      if (!path.basename(targetPath).toUpperCase().endsWith("SKILL.MD")) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "文件不是 SKILL.md"));
        return;
      }
      const content = fs.readFileSync(targetPath, "utf-8");
      const fm = parseFrontmatter(content);
      const skillName = fm.name?.trim();
      if (!skillName) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "SKILL.md 缺少 name 字段"),
        );
        return;
      }
      const managedDir = getManagedSkillsDir();
      const destDir = path.join(managedDir, skillName);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(targetPath, path.join(destDir, "SKILL.md"));
      // 同时复制同级的 references/ 目录（如果存在）
      const refsDir = path.join(path.dirname(targetPath), "references");
      if (fs.existsSync(refsDir) && fs.statSync(refsDir).isDirectory()) {
        fs.cpSync(refsDir, path.join(destDir, "references"), { recursive: true });
      }
      clearBinaryCache();
      invalidateSkillEntriesCache();
      _skillsStatusCache.clear();
      bumpSkillsSnapshotVersion({ reason: "manual" });
      respond(true, { ok: true, imported: [skillName], mode: "copy" }, undefined);
      return;
    }

    // --- 导入目录 ---
    if (!stat.isDirectory()) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "路径类型无效"));
      return;
    }

    const foundSkills = scanDirForSkills(targetPath);
    if (foundSkills.length === 0) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "目录中未找到 SKILL.md 文件"),
      );
      return;
    }

    if (mode === "reference") {
      // 引用模式: 添加到 extraDirs
      // FIX: Use shared config write lock
      await withConfigWriteLock(async () => {
        const cfg = loadConfig();
        const skills = cfg.skills ? { ...cfg.skills } : {};
        const load = skills.load ? { ...skills.load } : {};
        const extraDirs = load.extraDirs ? [...load.extraDirs] : [];

        // 如果目录本身是一个技能（包含 SKILL.md），则添加其父目录
        // 因为 loadSkillsFromDir 扫描的是子目录
        const dirToAdd =
          foundSkills.length === 1 && foundSkills[0].dir === targetPath
            ? path.dirname(targetPath)
            : targetPath;

        if (!extraDirs.includes(dirToAdd)) {
          extraDirs.push(dirToAdd);
          load.extraDirs = extraDirs;
          skills.load = load;
          await writeConfigFile({ ...cfg, skills });
        }
      });
      clearBinaryCache();
      invalidateSkillEntriesCache();
      _skillsStatusCache.clear();
      bumpSkillsSnapshotVersion({ reason: "manual" });
      respond(
        true,
        { ok: true, imported: foundSkills.map((s) => s.name), mode: "reference" },
        undefined,
      );
    } else {
      // 复制模式: 逐个复制到 managed dir
      const managedDir = getManagedSkillsDir();
      const imported: string[] = [];
      for (const skill of foundSkills) {
        // 安全校验：skill.name 不允许包含路径分隔符或 ..，防止路径遍历
        if (skill.name.includes("/") || skill.name.includes("\\") || skill.name.includes("..")) {
          console.warn("[skills] Skipping skill with unsafe name:", skill.name);
          continue;
        }
        const destDir = path.join(managedDir, skill.name);
        fs.cpSync(skill.dir, destDir, { recursive: true, force: true });
        imported.push(skill.name);
      }
      clearBinaryCache();
      invalidateSkillEntriesCache();
      _skillsStatusCache.clear();
      bumpSkillsSnapshotVersion({ reason: "manual" });
      respond(true, { ok: true, imported, mode: "copy" }, undefined);
    }
  },
};

// ---------------------------------------------------------------------------
// 辅助: 扫描目录中的技能（SKILL.md）
// ---------------------------------------------------------------------------
function scanDirForSkills(dir: string): Array<{ name: string; dir: string }> {
  const results: Array<{ name: string; dir: string }> = [];

  // 检查目录本身是否包含 SKILL.md
  const directSkillMd = path.join(dir, "SKILL.md");
  if (fs.existsSync(directSkillMd)) {
    try {
      const fm = parseFrontmatter(fs.readFileSync(directSkillMd, "utf-8"));
      const name = fm.name?.trim();
      if (name) results.push({ name, dir });
    } catch {
      /* skip invalid */
    }
    return results; // 如果目录本身是技能，不递归子目录
  }

  // 扫描直接子目录
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const subSkillMd = path.join(dir, entry.name, "SKILL.md");
      if (fs.existsSync(subSkillMd)) {
        try {
          const fm = parseFrontmatter(fs.readFileSync(subSkillMd, "utf-8"));
          const name = fm.name?.trim();
          if (name) results.push({ name, dir: path.join(dir, entry.name) });
        } catch {
          /* skip invalid */
        }
      }
    }
  } catch {
    /* ignore access errors */
  }
  return results;
}
