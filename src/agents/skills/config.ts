import type { OpenClawCNConfig, SkillConfig } from "../../config/config.js";
import {
  detectChinaRegion,
  isSkillDeprioritizedInCn,
  isSkillHiddenInCn,
} from "../../config/region-cn.js";
import type { SkillEligibilityContext, SkillEntry } from "./types.js";
import {
  clearBinaryCache,
  hasBinary,
  isConfigPathTruthyWithDefaults,
  resolveConfigPath,
  resolveRuntimePlatform,
} from "../../shared/config-eval.js";
import { resolveSkillKey } from "./frontmatter.js";

/** Cached CN region detection (stable for process lifetime). */
let _isCn: boolean | undefined;

const DEFAULT_CONFIG_VALUES: Record<string, boolean> = {
  "browser.enabled": true,
  "browser.evaluateEnabled": true,
};

export { clearBinaryCache, hasBinary, resolveConfigPath, resolveRuntimePlatform };

export function isConfigPathTruthy(config: OpenClawCNConfig | undefined, pathStr: string): boolean {
  return isConfigPathTruthyWithDefaults(config, pathStr, DEFAULT_CONFIG_VALUES);
}

export function resolveSkillConfig(
  config: OpenClawCNConfig | undefined,
  skillKey: string,
): SkillConfig | undefined {
  const skills = config?.skills?.entries;
  if (!skills || typeof skills !== "object") {
    return undefined;
  }
  const entry = (skills as Record<string, SkillConfig | undefined>)[skillKey];
  if (!entry || typeof entry !== "object") {
    return undefined;
  }
  return entry;
}

function normalizeAllowlist(input: unknown): string[] | undefined {
  if (!input) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    return undefined;
  }
  const normalized = input.map((entry) => String(entry).trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

const BUNDLED_SOURCES = new Set(["openclawcn-bundled"]);

function isBundledSkill(entry: SkillEntry): boolean {
  return BUNDLED_SOURCES.has(entry.skill.source);
}

export function resolveBundledAllowlist(config?: OpenClawCNConfig): string[] | undefined {
  return normalizeAllowlist(config?.skills?.allowBundled);
}

export function isBundledSkillAllowed(entry: SkillEntry, allowlist?: string[]): boolean {
  if (!allowlist || allowlist.length === 0) {
    return true;
  }
  if (!isBundledSkill(entry)) {
    return true;
  }
  const key = resolveSkillKey(entry.skill, entry);
  return allowlist.includes(key) || allowlist.includes(entry.skill.name);
}

export function shouldIncludeSkill(params: {
  entry: SkillEntry;
  config?: OpenClawCNConfig;
  eligibility?: SkillEligibilityContext;
}): boolean {
  const { entry, config, eligibility } = params;
  const skillKey = resolveSkillKey(entry.skill, entry);
  const skillConfig = resolveSkillConfig(config, skillKey);
  const osList = entry.metadata?.os ?? [];
  const remotePlatforms = eligibility?.remote?.platforms ?? [];

  // 1. Explicitly disabled — always wins
  if (skillConfig?.enabled === false) {
    return false;
  }

  // 2. CN hidden — cannot be overridden (not even by pinning)
  if (_isCn === undefined) _isCn = detectChinaRegion();
  if (_isCn) {
    if (isSkillHiddenInCn(skillKey) || isSkillHiddenInCn(entry.skill.name)) {
      return false;
    }
  }

  // 3. Pinned skills (= core skills) bypass OS, bins, env, config, CN deprioritized checks.
  //    pinnedSkills is the SINGLE source of truth for "what gets injected into prompt".
  const pinnedSkills = config?.skills?.pinnedSkills ?? [];
  const isPinned = pinnedSkills.includes(skillKey) || pinnedSkills.includes(entry.skill.name);
  if (isPinned) {
    return true;
  }

  // 4. CN deprioritized — unpinned overseas-dependent skills excluded from prompt in CN
  if (_isCn) {
    if (isSkillDeprioritizedInCn(skillKey) || isSkillDeprioritizedInCn(entry.skill.name)) {
      return false;
    }
  }

  // 5. Bundled skills: ONLY injected when pinned (step 3 above).
  //    Unpinned bundled skills stay in "ready" tier but are NOT injected into prompt.
  //    This replaced the legacy allowBundled whitelist — pinnedSkills is now the sole gate.
  if (isBundledSkill(entry)) {
    return false;
  }

  // 6. OS compatibility (only reached by managed/workspace/extra skills)
  if (
    osList.length > 0 &&
    !osList.includes(resolveRuntimePlatform()) &&
    !remotePlatforms.some((platform) => osList.includes(platform))
  ) {
    return false;
  }

  // 7. always — bypasses bins/env/config (but NOT OS, which was checked above)
  if (entry.metadata?.always === true) {
    return true;
  }

  // 8. Requirement checks: bins, anyBins, env, config
  const requiredBins = entry.metadata?.requires?.bins ?? [];
  if (requiredBins.length > 0) {
    for (const bin of requiredBins) {
      if (hasBinary(bin)) {
        continue;
      }
      if (eligibility?.remote?.hasBin?.(bin)) {
        continue;
      }
      return false;
    }
  }
  const requiredAnyBins = entry.metadata?.requires?.anyBins ?? [];
  if (requiredAnyBins.length > 0) {
    const anyFound =
      requiredAnyBins.some((bin) => hasBinary(bin)) ||
      eligibility?.remote?.hasAnyBin?.(requiredAnyBins);
    if (!anyFound) {
      return false;
    }
  }

  const requiredEnv = entry.metadata?.requires?.env ?? [];
  if (requiredEnv.length > 0) {
    for (const envName of requiredEnv) {
      if (process.env[envName]) {
        continue;
      }
      if (skillConfig?.env?.[envName]) {
        continue;
      }
      if (skillConfig?.apiKey && entry.metadata?.primaryEnv === envName) {
        continue;
      }
      return false;
    }
  }

  const requiredConfig = entry.metadata?.requires?.config ?? [];
  if (requiredConfig.length > 0) {
    for (const configPath of requiredConfig) {
      if (!isConfigPathTruthy(config, configPath)) {
        return false;
      }
    }
  }

  return true;
}
