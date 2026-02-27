/**
 * [CN-PATCH:memory-upsert] memory_upsert / memory_forget tools
 *
 * Gives the Agent the ability to self-manage its long-term memory:
 * - memory_upsert: save or update a user fact/preference/correction
 * - memory_forget: remove an outdated or incorrect memory entry
 *
 * Facts are stored in memory/profile.json (≤200 entries) and injected into
 * every system prompt. The Agent decides autonomously what to remember.
 */

import { Type } from "@sinclair/typebox";
import type { OpenClawCNConfig } from "../../config/config.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult } from "./common.js";
import {
  withProfileLock,
  upsertProfileEntryFull,
  removeProfileEntry,
  PROFILE_MAX_KEY_LENGTH,
  PROFILE_MAX_VALUE_LENGTH,
  type ProfileCategory,
} from "../../memory/profile-store.js";

const VALID_CATEGORIES: ProfileCategory[] = [
  "preference",
  "correction",
  "fact",
  "identity",
  "todo",
  "procedure",
];

const MemoryUpsertSchema = Type.Object({
  category: Type.Union(VALID_CATEGORIES.map((c) => Type.Literal(c))),
  key: Type.String(),
  value: Type.String(),
});

const MemoryForgetSchema = Type.Object({
  category: Type.Union(VALID_CATEGORIES.map((c) => Type.Literal(c))),
  key: Type.String(),
});

export function createMemoryUpsertTool(options: {
  config?: OpenClawCNConfig;
  workspaceDir?: string;
}): AnyAgentTool | null {
  const workspaceDir = options.workspaceDir;
  if (!workspaceDir) return null;

  return {
    label: "Memory Upsert",
    name: "memory_upsert",
    description: [
      "Save or update a user fact, preference, correction, or identity detail.",
      "Use when the user: states a preference, corrects you, shares role/identity info,",
      "establishes a rule, or mentions an important project fact worth remembering.",
      "Same category+key overwrites the old value (auto-resolves contradictions).",
      "Categories: preference, correction, fact, identity, todo, procedure.",
      "Do NOT save: trivial facts, one-time instructions, or things already stored.",
    ].join(" "),
    parameters: MemoryUpsertSchema,
    execute: async (_toolCallId, params) => {
      const category = params.category as ProfileCategory;
      const key = typeof params.key === "string" ? params.key.trim() : "";
      const value = typeof params.value === "string" ? params.value.trim() : "";

      if (!key || !value) {
        return jsonResult({ success: false, error: "key and value are required" });
      }
      if (!VALID_CATEGORIES.includes(category)) {
        return jsonResult({ success: false, error: `invalid category: ${category}` });
      }
      if (key.length > PROFILE_MAX_KEY_LENGTH) {
        return jsonResult({
          success: false,
          error: `key too long (max ${PROFILE_MAX_KEY_LENGTH} chars)`,
        });
      }
      if (value.length > PROFILE_MAX_VALUE_LENGTH) {
        return jsonResult({
          success: false,
          error: `value too long (max ${PROFILE_MAX_VALUE_LENGTH} chars)`,
        });
      }

      try {
        const totalEntries = await withProfileLock(workspaceDir, (profile) => {
          const result = upsertProfileEntryFull(profile, category, key, value, { source: "tool" });
          // evicted entries are archived inside the lock (before profile write) by withProfileLock
          return {
            profile: result.profile,
            result: result.profile.entries.length,
            evicted: result.evicted,
          };
        });
        return jsonResult({
          success: true,
          category,
          key,
          totalEntries,
        });
      } catch (err) {
        return jsonResult({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

export function createMemoryForgetTool(options: {
  config?: OpenClawCNConfig;
  workspaceDir?: string;
}): AnyAgentTool | null {
  const workspaceDir = options.workspaceDir;
  if (!workspaceDir) return null;

  return {
    label: "Memory Forget",
    name: "memory_forget",
    description: [
      "Remove an outdated, incorrect, or no longer relevant memory entry.",
      "Use when: user says to stop remembering something, a fact is no longer true,",
      "or a todo is completed and no longer needed.",
    ].join(" "),
    parameters: MemoryForgetSchema,
    execute: async (_toolCallId, params) => {
      const category = params.category as ProfileCategory;
      const key = typeof params.key === "string" ? params.key.trim() : "";

      if (!VALID_CATEGORIES.includes(category)) {
        return jsonResult({ success: false, error: `invalid category: ${category}` });
      }
      if (!key) {
        return jsonResult({ success: false, error: "key is required" });
      }

      try {
        const { removed, totalEntries } = await withProfileLock(workspaceDir, (profile) => {
          const updated = removeProfileEntry(profile, category, key);
          return {
            profile: updated,
            result: {
              removed: profile.entries.length !== updated.entries.length,
              totalEntries: updated.entries.length,
            },
          };
        });
        return jsonResult({ success: true, removed, totalEntries });
      } catch (err) {
        return jsonResult({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
