import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { installSkill } from "../../agents/skills-install.js";
import { buildWorkspaceSkillStatus } from "../../agents/skills-status.js";
import { loadWorkspaceSkillEntries, type SkillEntry } from "../../agents/skills.js";
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
import { bumpSkillsSnapshotVersion } from "../../agents/skills/refresh.js";
import type { ClawdbotConfig } from "../../config/config.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import { getRemoteSkillEligibility } from "../../infra/skills-remote.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateSkillsBinsParams,
  validateSkillsInstallParams,
  validateSkillsMarketListParams,
  validateSkillsMarketRefreshParams,
  validateSkillsRemoteListParams,
  validateSkillsStatusParams,
  validateSkillsUpdateParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

function listWorkspaceDirs(cfg: ClawdbotConfig): string[] {
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
    const required = entry.clawdbot?.requires?.bins ?? [];
    const anyBins = entry.clawdbot?.requires?.anyBins ?? [];
    const install = entry.clawdbot?.install ?? [];
    for (const bin of required) {
      const trimmed = bin.trim();
      if (trimmed) bins.add(trimmed);
    }
    for (const bin of anyBins) {
      const trimmed = bin.trim();
      if (trimmed) bins.add(trimmed);
    }
    for (const spec of install) {
      const specBins = spec?.bins ?? [];
      for (const bin of specBins) {
        const trimmed = String(bin).trim();
        if (trimmed) bins.add(trimmed);
      }
    }
  }
  return [...bins].sort();
}

export const skillsHandlers: GatewayRequestHandlers = {
  "skills.status": ({ params, respond }) => {
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
    const cfg = loadConfig();
    const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
    const report = buildWorkspaceSkillStatus(workspaceDir, {
      config: cfg,
      eligibility: { remote: getRemoteSkillEligibility() },
    });
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
      for (const bin of collectSkillBins(entries)) bins.add(bin);
    }
    respond(true, { bins: [...bins].sort() }, undefined);
  },
  "skills.install": async ({ params, respond }) => {
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
    const cfg = loadConfig();

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
      // ClawdbotCN 专属：自动安装远程技能的 CLI 依赖（如 grizzly、himalaya 等）
      const skillEntries = loadWorkspaceSkillEntries(managedSkillsDir, { config: cfg });
      const targetEntry = skillEntries.find((e) => e.skill.name === p.name);
      
      if (targetEntry && targetEntry.clawdbot?.install && targetEntry.clawdbot.install.length > 0) {
        // ClawdbotCN 专属：根据当前操作系统过滤 install spec
        // 修复 Windows 用户点击一键安装时，错误选择 macOS-only 的 brew 方式的问题
        const platform = process.platform;
        const filteredInstall = targetEntry.clawdbot.install.filter((spec) => {
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
            { ok: false, message: `此技能没有适用于 ${platform} 平台的安装方式`, stdout: "", stderr: "", code: null },
            errorShape(ErrorCodes.UNAVAILABLE, `No install method available for platform: ${platform}`),
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
        });
        
        if (!depResult.ok) {
          // 依赖安装失败，返回错误但保留已下载的 SKILL.md
          respond(
            false,
            depResult,
            errorShape(ErrorCodes.UNAVAILABLE, depResult.message),
          );
          return;
        }
      }

      // 远程技能安装成功（包括依赖）：
      // 1. 刷新已安装列表
      refreshInstalledList().catch(() => {
        // 静默失败，不影响响应
      });
      // 2. 更新技能快照版本，让当前对话的下一条消息能立即使用新技能
      bumpSkillsSnapshotVersion({ reason: "manual" });

      respond(
        true,
        { ok: true, message: "已安装", stdout: "", stderr: "", code: 0 },
        undefined,
      );
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
    });

    // 安装后：
    if (result.ok) {
      // 1. 刷新本地索引中的已安装列表
      refreshInstalledList().catch(() => {
        // 静默失败，不影响响应
      });
      // 2. 更新技能快照版本，让当前对话的下一条消息能立即使用新技能
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
    const p = params as {
      skillKey: string;
      enabled?: boolean;
      apiKey?: string;
      env?: Record<string, string>;
    };
    const cfg = loadConfig();
    const skills = cfg.skills ? { ...cfg.skills } : {};
    const entries = skills.entries ? { ...skills.entries } : {};
    const current = entries[p.skillKey] ? { ...entries[p.skillKey] } : {};
    if (typeof p.enabled === "boolean") {
      current.enabled = p.enabled;
    }
    if (typeof p.apiKey === "string") {
      const trimmed = p.apiKey.trim();
      if (trimmed) current.apiKey = trimmed;
      else delete current.apiKey;
    }
    if (p.env && typeof p.env === "object") {
      const nextEnv = current.env ? { ...current.env } : {};
      for (const [key, value] of Object.entries(p.env)) {
        const trimmedKey = key.trim();
        if (!trimmedKey) continue;
        const trimmedVal = value.trim();
        if (!trimmedVal) delete nextEnv[trimmedKey];
        else nextEnv[trimmedKey] = trimmedVal;
      }
      current.env = nextEnv;
    }
    entries[p.skillKey] = current;
    skills.entries = entries;
    const nextConfig: ClawdbotConfig = {
      ...cfg,
      skills,
    };
    await writeConfigFile(nextConfig);
    respond(true, { ok: true, skillKey: p.skillKey, config: current }, undefined);
  },
  "skills.remote.list": async ({ params, respond }) => {
    if (!validateSkillsRemoteListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.remote.list params: ${formatValidationErrors(validateSkillsRemoteListParams.errors)}`,
        ),
      );
      return;
    }
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
    if (!validateSkillsMarketListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.market.list params: ${formatValidationErrors(validateSkillsMarketListParams.errors)}`,
        ),
      );
      return;
    }
    const result = await getSkillsMarket();
    respond(true, result, undefined);
  },

  // 技能市场 - 强制刷新（用户手动触发）
  "skills.market.refresh": async ({ params, respond }) => {
    if (!validateSkillsMarketRefreshParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid skills.market.refresh params: ${formatValidationErrors(validateSkillsMarketRefreshParams.errors)}`,
        ),
      );
      return;
    }
    const result = await forceRefreshMarket();
    respond(true, result, undefined);
  },
};
