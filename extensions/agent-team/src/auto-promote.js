import { readProfile } from "../../../dist/memory/profile-store.js";
import {
  withSharedProfileLock,
  upsertSharedEntry
} from "./shared-profile-store.js";
const DEFAULT_MIN_HITS = 3;
const DEFAULT_MAX_PROMOTIONS = 3;
const DEFAULT_SHARED_CATEGORIES = ["fact", "identity"];
async function autoPromoteEntries(params) {
  const {
    projectId,
    agentId,
    workspaceDir,
    minHits = DEFAULT_MIN_HITS,
    maxPromotions = DEFAULT_MAX_PROMOTIONS,
    sharedCategories = DEFAULT_SHARED_CATEGORIES
  } = params;
  const privateProfile = readProfile(workspaceDir);
  if (privateProfile.entries.length === 0) return 0;
  const privateCandidates = privateProfile.entries.filter(
    (e) => e.hits >= minHits && sharedCategories.includes(e.category)
  ).sort((a, b) => b.hits - a.hits).slice(0, maxPromotions);
  if (privateCandidates.length === 0) return 0;
  return withSharedProfileLock(projectId, (current) => {
    const sharedKeys = new Set(
      current.entries.map((e) => `${e.category}:${e.key}`)
    );
    let profile = current;
    let promoted = 0;
    for (const candidate of privateCandidates) {
      if (sharedKeys.has(`${candidate.category}:${candidate.key}`)) continue;
      profile = upsertSharedEntry(profile, {
        category: candidate.category,
        key: candidate.key,
        value: candidate.value,
        sourceAgentId: agentId
      });
      promoted++;
    }
    return { profile, result: promoted };
  });
}
export {
  autoPromoteEntries
};
