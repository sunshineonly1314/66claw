/**
 * [CN-PATCH:memory-L2] Semantic retrieval of archived/cold memories for system prompt injection.
 *
 * On each agent turn, extracts keywords from the latest user message, searches the
 * SQLite memory index (FTS5 keyword search), and returns the top matching snippets
 * formatted for system prompt injection.
 *
 * Design choices:
 * - Uses FTS5 keyword search only (no embedding/vector) to keep latency < 50ms
 *   and avoid requiring an embedding provider to be configured.
 * - Hard-capped at 5 results, 400 tokens (~1600 chars) to prevent context bloat.
 * - Only runs when the memory system is enabled and SQLite DB exists.
 * - Returns empty string on any error — never blocks the agent turn.
 */

import type { OpenClawCNConfig } from "../config/config.js";
import type { MemorySearchManager } from "./types.js";

/** Maximum number of cold memory snippets to inject per turn. */
const MAX_RETRIEVAL_RESULTS = 5;
/** Maximum total characters for the cold retrieval block.
 * Must be ≤ 30% of PROFILE_MAX_PROMPT_CHARS to respect the 70/30 hot/cold budget split. */
const MAX_RETRIEVAL_CHARS = 600;

/** Minimum query length (chars) to attempt cold retrieval. */
const MIN_QUERY_LENGTH = 4;

/**
 * Time-decay for cold memory search scores.
 * After DECAY_START_DAYS, the score is multiplied by an exponential decay
 * with DECAY_HALF_LIFE_DAYS. This suppresses very old entries in ranking
 * without deleting them from SQLite.
 *
 * Examples (with startDays=90, halfLife=90):
 * - 0-90 days old   → score × 1.0  (no decay)
 * - 180 days old     → score × 0.5
 * - 270 days old     → score × 0.25
 */
const DECAY_START_DAYS = 90;
const DECAY_HALF_LIFE_DAYS = 90;

/**
 * Search cold memories using the MemorySearchManager and format results
 * for system prompt injection.
 *
 * @param manager - The pre-initialized memory search manager (from getMemorySearchManager)
 * @param query - The user's latest message text (used as search query)
 * @param recentContext - Last 2-3 turns of conversation (for short-query enrichment)
 * @param hotKeys - Set of "category:key" strings from the hot profile, used for dedup
 * @param minScore - Minimum relevance score (0-1) to include a result
 * @returns Formatted markdown block, or empty string if nothing found
 */
export async function retrieveColdMemories(params: {
  manager: MemorySearchManager;
  query: string;
  recentContext?: string;
  hotKeys?: ReadonlySet<string>;
  minScore?: number;
}): Promise<string> {
  const { manager } = params;
  const minScore = params.minScore ?? 0.35;

  // Short-query enrichment: if the raw message is too short (e.g. "好的", "继续"),
  // FTS5 keyword search will return garbage. Use recent context as the query instead.
  let effectiveQuery = params.query.trim();
  if (effectiveQuery.length < MIN_QUERY_LENGTH && params.recentContext?.trim()) {
    effectiveQuery = params.recentContext.trim();
  }
  if (effectiveQuery.length < MIN_QUERY_LENGTH) return "";

  try {
    const results = await manager.search(effectiveQuery, { maxResults: MAX_RETRIEVAL_RESULTS + 5 });
    if (!results || results.length === 0) return "";

    // Apply time-decay to scores: penalize stale entries before filtering.
    const now = Date.now();
    const decayedResults = results.map((r) => {
      if (!r.updatedAt) return r;
      const ageDays = (now - r.updatedAt) / (1000 * 60 * 60 * 24);
      if (ageDays <= DECAY_START_DAYS) return r;
      const excessDays = ageDays - DECAY_START_DAYS;
      const factor = Math.pow(0.5, excessDays / DECAY_HALF_LIFE_DAYS);
      return { ...r, score: r.score * factor };
    });

    // Filter by minimum score (after decay)
    let filtered = decayedResults.filter((r) => r.score >= minScore);
    if (filtered.length === 0) return "";

    // Re-sort by decayed score so most relevant+recent entries come first
    filtered.sort((a, b) => b.score - a.score);

    // Dedup against hot profile: skip cold results whose snippet contains a hot key+value.
    // Hot profile format is "category:key" (lowercased). Cold snippets from profile-archive.md
    // have format "- [category] key: value". We check if the snippet's key is already hot.
    if (params.hotKeys && params.hotKeys.size > 0) {
      filtered = filtered.filter((r) => {
        const snippet = r.snippet?.trim() ?? "";
        // Match archive format: "- [category] key: value ..."
        const archiveMatch = snippet.match(/^\s*-?\s*\[(\w+)]\s*(.+?):\s/);
        if (archiveMatch) {
          const cat = archiveMatch[1].toLowerCase();
          const key = archiveMatch[2].trim().toLowerCase();
          return !params.hotKeys!.has(`${cat}:${key}`);
        }
        return true; // Non-archive results (e.g. from MEMORY.md) always pass
      });
    }

    if (filtered.length === 0) return "";

    const lines: string[] = ["## Related Memories (auto-retrieved)"];
    let totalChars = lines[0].length;
    let count = 0;

    for (const result of filtered) {
      if (count >= MAX_RETRIEVAL_RESULTS) break;
      const snippet = result.snippet?.trim();
      if (!snippet) continue;

      // Sanitize newlines for safe prompt injection
      const safeSnippet = snippet.replace(/[\r\n]+/g, " ").trim();
      const source = result.path ? ` (${result.path})` : "";
      const line = `- ${safeSnippet}${source}`;

      if (totalChars + line.length + 1 > MAX_RETRIEVAL_CHARS) break;
      lines.push(line);
      totalChars += line.length + 1;
      count++;
    }

    if (lines.length <= 1) return ""; // Only header, no results
    lines.push("");
    return lines.join("\n");
  } catch {
    // Never block agent turn due to retrieval failure
    return "";
  }
}

/**
 * Try to get the memory search manager for cold memory retrieval.
 * Returns null if the memory system is not enabled or not configured.
 */
export async function getRetrievalManager(params: {
  cfg?: OpenClawCNConfig;
  agentId: string;
}): Promise<MemorySearchManager | null> {
  if (!params.cfg) return null;

  try {
    const { getMemorySearchManager } = await import("./search-manager.js");
    const result = await getMemorySearchManager({
      cfg: params.cfg,
      agentId: params.agentId,
    });
    return result.manager;
  } catch {
    return null;
  }
}
