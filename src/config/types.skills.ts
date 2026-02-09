export type SkillConfig = {
  enabled?: boolean;
  apiKey?: string;
  env?: Record<string, string>;
  config?: Record<string, unknown>;
};

export type SkillsLoadConfig = {
  /**
   * Additional skill folders to scan (lowest precedence).
   * Each directory should contain skill subfolders with `SKILL.md`.
   */
  extraDirs?: string[];
  /** Watch skill folders for changes and refresh the skills snapshot. */
  watch?: boolean;
  /** Debounce for the skills watcher (ms). */
  watchDebounceMs?: number;
  /**
   * Maximum number of skills injected into the system prompt.
   * Prevents context-window explosion when many skills are installed.
   * Skills are prioritised: always > has-deps-satisfied > no-deps.
   * Default: 30. Set 0 to disable the limit.
   */
  maxPromptSkills?: number;
};

export type SkillsInstallConfig = {
  preferBrew?: boolean;
  nodeManager?: "npm" | "pnpm" | "yarn" | "bun";
};

export type SkillsConfig = {
  /** Optional bundled-skill allowlist (only affects bundled skills). */
  allowBundled?: string[];
  /**
   * Pinned skills — always prioritised for prompt inclusion.
   * These skill names/keys get the highest priority (above `always: true`).
   * Useful when the user has >30 eligible skills and wants to guarantee specific ones.
   */
  pinnedSkills?: string[];
  load?: SkillsLoadConfig;
  install?: SkillsInstallConfig;
  entries?: Record<string, SkillConfig>;
};
