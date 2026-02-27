import type { OpenClawCNConfig } from "../../config/config.js";
import type { SkillEntry, SkillSnapshot } from "./types.js";
import { resolveSkillConfig } from "./config.js";
import { resolveSkillKey } from "./frontmatter.js";

// ---------------------------------------------------------------------------
// Reference counting for concurrent env overrides.
// When multiple agents run concurrently, each applies/restores env vars.
// Without refcounting, Agent A's cleanup would delete vars that Agent B
// still needs.  The refcount ensures we only delete when the LAST user
// releases, and we only restore the ORIGINAL value (from before any
// override was applied).
// ---------------------------------------------------------------------------
const _envRefCount = new Map<string, { count: number; original: string | undefined }>();

function acquireEnvKey(key: string, value: string): void {
  const existing = _envRefCount.get(key);
  if (existing) {
    existing.count++;
  } else {
    _envRefCount.set(key, { count: 1, original: process.env[key] });
  }
  process.env[key] = value;
}

function releaseEnvKey(key: string): void {
  const existing = _envRefCount.get(key);
  if (!existing) return;
  existing.count--;
  if (existing.count <= 0) {
    if (existing.original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = existing.original;
    }
    _envRefCount.delete(key);
  }
  // If count > 0, another agent still needs this value — leave process.env as-is
}

export function applySkillEnvOverrides(params: {
  skills: SkillEntry[];
  config?: OpenClawCNConfig;
}) {
  const { skills, config } = params;
  const acquiredKeys: string[] = [];

  for (const entry of skills) {
    const skillKey = resolveSkillKey(entry.skill, entry);
    const skillConfig = resolveSkillConfig(config, skillKey);
    if (!skillConfig) {
      continue;
    }

    if (skillConfig.env) {
      for (const [envKey, envValue] of Object.entries(skillConfig.env)) {
        if (!envValue || process.env[envKey]) {
          continue;
        }
        acquireEnvKey(envKey, envValue);
        acquiredKeys.push(envKey);
      }
    }

    const primaryEnv = entry.metadata?.primaryEnv;
    if (primaryEnv && skillConfig.apiKey && !process.env[primaryEnv]) {
      acquireEnvKey(primaryEnv, skillConfig.apiKey);
      acquiredKeys.push(primaryEnv);
    }
  }

  return () => {
    for (const key of acquiredKeys) {
      releaseEnvKey(key);
    }
  };
}

export function applySkillEnvOverridesFromSnapshot(params: {
  snapshot?: SkillSnapshot;
  config?: OpenClawCNConfig;
}) {
  const { snapshot, config } = params;
  if (!snapshot) {
    return () => {};
  }
  const acquiredKeys: string[] = [];

  for (const skill of snapshot.skills) {
    const skillConfig = resolveSkillConfig(config, skill.name);
    if (!skillConfig) {
      continue;
    }

    if (skillConfig.env) {
      for (const [envKey, envValue] of Object.entries(skillConfig.env)) {
        if (!envValue || process.env[envKey]) {
          continue;
        }
        acquireEnvKey(envKey, envValue);
        acquiredKeys.push(envKey);
      }
    }

    if (skill.primaryEnv && skillConfig.apiKey && !process.env[skill.primaryEnv]) {
      acquireEnvKey(skill.primaryEnv, skillConfig.apiKey);
      acquiredKeys.push(skill.primaryEnv);
    }
  }

  return () => {
    for (const key of acquiredKeys) {
      releaseEnvKey(key);
    }
  };
}
