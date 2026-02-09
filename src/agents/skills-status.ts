import path from "node:path";

import type { ClawdbotConfig } from "../config/config.js";
import { CONFIG_DIR } from "../utils.js";
import {
  filterWorkspaceSkillEntries,
  hasBinary,
  isBundledSkillAllowed,
  isConfigPathTruthy,
  loadWorkspaceSkillEntries,
  resolveBundledAllowlist,
  resolveConfigPath,
  resolveSkillConfig,
  resolveSkillsInstallPreferences,
  type SkillEntry,
  type SkillEligibilityContext,
  type SkillInstallSpec,
  type SkillsInstallPreferences,
} from "./skills.js";

export type SkillStatusConfigCheck = {
  path: string;
  value: unknown;
  satisfied: boolean;
};

export type SkillInstallOption = {
  id: string;
  kind: SkillInstallSpec["kind"];
  label: string;
  bins: string[];
};

export type SkillStatusEntry = {
  name: string;
  description: string;
  source: string;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  /** 用户置顶（config.skills.pinnedSkills） */
  pinned: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  /** 是否实际被加载进 AI prompt（受 maxPromptSkills 限制） */
  activeInPrompt: boolean;
  requirements: {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  configChecks: SkillStatusConfigCheck[];
  install: SkillInstallOption[];
};

export type SkillStatusReport = {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
  /** 实际被加载进 prompt 的技能数量 */
  activeCount: number;
  /** prompt 技能数量上限 */
  maxPromptSkills: number;
};

function resolveSkillKey(entry: SkillEntry): string {
  return entry.clawdbot?.skillKey ?? entry.skill.name;
}

function selectPreferredInstallSpec(
  install: SkillInstallSpec[],
  prefs: SkillsInstallPreferences,
): { spec: SkillInstallSpec; index: number } | undefined {
  if (install.length === 0) return undefined;
  const indexed = install.map((spec, index) => ({ spec, index }));
  const findKind = (kind: SkillInstallSpec["kind"]) =>
    indexed.find((item) => item.spec.kind === kind);

  const brewSpec = findKind("brew");
  const nodeSpec = findKind("node");
  const goSpec = findKind("go");
  const uvSpec = findKind("uv");

  // brew 只在 macOS 上存在，Windows/Linux 跳过这次 hasBinary 调用
  if (prefs.preferBrew && process.platform === "darwin" && hasBinary("brew") && brewSpec) return brewSpec;
  if (uvSpec) return uvSpec;
  if (nodeSpec) return nodeSpec;
  if (brewSpec) return brewSpec;
  if (goSpec) return goSpec;
  return indexed[0];
}

function normalizeInstallOptions(
  entry: SkillEntry,
  prefs: SkillsInstallPreferences,
): SkillInstallOption[] {
  const install = entry.clawdbot?.install ?? [];
  if (install.length === 0) return [];

  const platform = process.platform;
  const filtered = install.filter((spec) => {
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
  if (filtered.length === 0) return [];

  const toOption = (spec: SkillInstallSpec, index: number): SkillInstallOption => {
    const id = (spec.id ?? `${spec.kind}-${index}`).trim();
    const bins = spec.bins ?? [];
    let label = (spec.label ?? "").trim();
    if (spec.kind === "node" && spec.package) {
      label = `Install ${spec.package} (${prefs.nodeManager})`;
    }
    if (!label) {
      if (spec.kind === "brew" && spec.formula) {
        label = `Install ${spec.formula} (brew)`;
      } else if (spec.kind === "node" && spec.package) {
        label = `Install ${spec.package} (${prefs.nodeManager})`;
      } else if (spec.kind === "go" && spec.module) {
        label = `Install ${spec.module} (go)`;
      } else if (spec.kind === "uv" && spec.package) {
        label = `Install ${spec.package} (uv)`;
      } else if (spec.kind === "download" && spec.url) {
        const url = spec.url.trim();
        const last = url.split("/").pop();
        label = `Download ${last && last.length > 0 ? last : url}`;
      } else {
        label = "Run installer";
      }
    }
    return { id, kind: spec.kind, label, bins };
  };

  const allDownloads = filtered.every((spec) => spec.kind === "download");
  if (allDownloads) {
    return filtered.map((spec, index) => toOption(spec, index));
  }

  const preferred = selectPreferredInstallSpec(filtered, prefs);
  if (!preferred) return [];
  return [toOption(preferred.spec, preferred.index)];
}

function buildSkillStatus(
  entry: SkillEntry,
  config?: ClawdbotConfig,
  prefs?: SkillsInstallPreferences,
  eligibility?: SkillEligibilityContext,
  activeNames?: Set<string>,
  pinnedSet?: Set<string>,
): SkillStatusEntry {
  const skillKey = resolveSkillKey(entry);
  const skillConfig = resolveSkillConfig(config, skillKey);
  const disabled = skillConfig?.enabled === false;
  const allowBundled = resolveBundledAllowlist(config);
  const blockedByAllowlist = !isBundledSkillAllowed(entry, allowBundled);
  const always = entry.clawdbot?.always === true;
  const pinned = pinnedSet ? (pinnedSet.has(entry.skill.name) || pinnedSet.has(skillKey)) : false;
  const emoji = entry.clawdbot?.emoji ?? entry.frontmatter.emoji;
  const homepageRaw =
    entry.clawdbot?.homepage ??
    entry.frontmatter.homepage ??
    entry.frontmatter.website ??
    entry.frontmatter.url;
  const homepage = homepageRaw?.trim() ? homepageRaw.trim() : undefined;

  const requiredBins = entry.clawdbot?.requires?.bins ?? [];
  const requiredAnyBins = entry.clawdbot?.requires?.anyBins ?? [];
  const requiredEnv = entry.clawdbot?.requires?.env ?? [];
  const requiredConfig = entry.clawdbot?.requires?.config ?? [];
  const requiredOs = entry.clawdbot?.os ?? [];

  const missingBins = requiredBins.filter((bin) => {
    if (hasBinary(bin)) return false;
    if (eligibility?.remote?.hasBin?.(bin)) return false;
    return true;
  });
  const missingAnyBins =
    requiredAnyBins.length > 0 &&
    !(
      requiredAnyBins.some((bin) => hasBinary(bin)) ||
      eligibility?.remote?.hasAnyBin?.(requiredAnyBins)
    )
      ? requiredAnyBins
      : [];
  const missingOs =
    requiredOs.length > 0 &&
    !requiredOs.includes(process.platform) &&
    !eligibility?.remote?.platforms?.some((platform) => requiredOs.includes(platform))
      ? requiredOs
      : [];

  const missingEnv: string[] = [];
  for (const envName of requiredEnv) {
    if (process.env[envName]) continue;
    if (skillConfig?.env?.[envName]) continue;
    if (skillConfig?.apiKey && entry.clawdbot?.primaryEnv === envName) {
      continue;
    }
    missingEnv.push(envName);
  }

  const configChecks: SkillStatusConfigCheck[] = requiredConfig.map((pathStr) => {
    const value = resolveConfigPath(config, pathStr);
    const satisfied = isConfigPathTruthy(config, pathStr);
    return { path: pathStr, value, satisfied };
  });
  const missingConfig = configChecks.filter((check) => !check.satisfied).map((check) => check.path);

  const missing = always
    ? { bins: [], anyBins: [], env: [], config: [], os: [] }
    : {
        bins: missingBins,
        anyBins: missingAnyBins,
        env: missingEnv,
        config: missingConfig,
        os: missingOs,
      };
  const eligible =
    !disabled &&
    !blockedByAllowlist &&
    (always ||
      (missing.bins.length === 0 &&
        missing.anyBins.length === 0 &&
        missing.env.length === 0 &&
        missing.config.length === 0 &&
        missing.os.length === 0));

  return {
    name: entry.skill.name,
    description: entry.skill.description,
    source: entry.skill.source,
    filePath: entry.skill.filePath,
    baseDir: entry.skill.baseDir,
    skillKey,
    primaryEnv: entry.clawdbot?.primaryEnv,
    emoji,
    homepage,
    always,
    pinned,
    disabled,
    blockedByAllowlist,
    eligible,
    activeInPrompt: activeNames ? activeNames.has(entry.skill.name) : eligible,
    requirements: {
      bins: requiredBins,
      anyBins: requiredAnyBins,
      env: requiredEnv,
      config: requiredConfig,
      os: requiredOs,
    },
    missing,
    configChecks,
    install: normalizeInstallOptions(entry, prefs ?? resolveSkillsInstallPreferences(config)),
  };
}

export function buildWorkspaceSkillStatus(
  workspaceDir: string,
  opts?: {
    config?: ClawdbotConfig;
    managedSkillsDir?: string;
    entries?: SkillEntry[];
    eligibility?: SkillEligibilityContext;
  },
): SkillStatusReport {
  const managedSkillsDir = opts?.managedSkillsDir ?? path.join(CONFIG_DIR, "skills");
  const skillEntries = opts?.entries ?? loadWorkspaceSkillEntries(workspaceDir, opts);
  const prefs = resolveSkillsInstallPreferences(opts?.config);

  // 计算实际进入 prompt 的技能（经过 shouldIncludeSkill + priority 排序 + maxPromptSkills 截断）
  const activeEntries = filterWorkspaceSkillEntries(skillEntries, opts?.config);
  const activeNames = new Set(activeEntries.map((e) => e.skill.name));

  // 读取 maxPromptSkills 配置
  const maxRaw = opts?.config?.skills?.load?.maxPromptSkills;
  const maxPromptSkills = typeof maxRaw === "number" ? maxRaw : 30;

  // 构建 pinnedSkills 集合
  const pinnedRaw = opts?.config?.skills?.pinnedSkills;
  const pinnedSet = pinnedRaw && pinnedRaw.length > 0 ? new Set(pinnedRaw) : undefined;

  return {
    workspaceDir,
    managedSkillsDir,
    activeCount: activeNames.size,
    maxPromptSkills,
    skills: skillEntries.map((entry) =>
      buildSkillStatus(entry, opts?.config, prefs, opts?.eligibility, activeNames, pinnedSet),
    ),
  };
}
