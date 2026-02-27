/**
 * Auto-Promote — Automatically promote high-hit private memory entries
 * to the team shared memory pool.
 *
 * Runs after each successful agent turn (in agent_end hook).
 * Only promotes entries in shareable categories with hits >= threshold.
 * Entries already in the shared pool are skipped (by category+key match).
 *
 * This is fire-and-forget — errors do not affect the main flow.
 */

import { readProfile } from "../../../src/memory/profile-store.js";
import type { SharedCategory } from "./types.js";
import {
  withSharedProfileLock,
  upsertSharedEntry,
} from "./shared-profile-store.js";

const DEFAULT_MIN_HITS = 3;
const DEFAULT_MAX_PROMOTIONS = 3;
const DEFAULT_SHARED_CATEGORIES: SharedCategory[] = ["fact", "identity"];

/**
 * Scan the agent's private profile for high-hit entries and promote
 * eligible ones to the team shared memory pool.
 *
 * @returns Number of entries actually promoted.
 */
export async function autoPromoteEntries(params: {
  projectId: string;
  agentId: string;
  workspaceDir: string;
  minHits?: number;
  maxPromotions?: number;
  sharedCategories?: SharedCategory[];
}): Promise<number> {
  const {
    projectId,
    agentId,
    workspaceDir,
    minHits = DEFAULT_MIN_HITS,
    maxPromotions = DEFAULT_MAX_PROMOTIONS,
    sharedCategories = DEFAULT_SHARED_CATEGORIES,
  } = params;

  // Read agent's private profile
  const privateProfile = readProfile(workspaceDir);
  if (privateProfile.entries.length === 0) return 0;

  // Pre-filter candidates from private profile (category + hits threshold)
  const privateCandidates = privateProfile.entries
    .filter(
      (e) =>
        e.hits >= minHits &&
        sharedCategories.includes(e.category as SharedCategory),
    )
    .sort((a, b) => b.hits - a.hits)
    .slice(0, maxPromotions);

  if (privateCandidates.length === 0) return 0;

  // Batch all promotions in a single lock to avoid TOCTOU race
  return withSharedProfileLock(projectId, (current) => {
    const sharedKeys = new Set(
      current.entries.map((e) => `${e.category}:${e.key}`),
    );

    let profile = current;
    let promoted = 0;

    for (const candidate of privateCandidates) {
      if (sharedKeys.has(`${candidate.category}:${candidate.key}`)) continue;

      profile = upsertSharedEntry(profile, {
        category: candidate.category as SharedCategory,
        key: candidate.key,
        value: candidate.value,
        sourceAgentId: agentId,
      });
      promoted++;
    }

    return { profile, result: promoted };
  });
}
