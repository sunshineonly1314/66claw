import type { ConfigValidationIssue } from "../../config/config.js";

export interface SafetyCheckResult {
  /** Always true — safety check never blocks writes. */
  ok: true;
  /** Advisory warnings for the AI to consider. Empty when no concerns found. */
  warnings: ConfigValidationIssue[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

/**
 * Count meaningful entries in an object or array.
 * Returns -1 if val is neither (i.e. not countable).
 */
function countEntries(val: unknown): number {
  if (Array.isArray(val)) return val.length;
  if (isPlainObject(val)) return Object.keys(val).length;
  return -1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Advisory pre-write safety check.
 *
 * Runs after schema validation passes but before `writeConfigFile()`.
 * **Never blocks the write** — it only produces warnings that are
 * attached to the success response so the AI can self-correct if needed.
 *
 * Design principles:
 * - **Schema-agnostic**: does NOT hard-code field names. All checks are
 *   generic comparisons (key disappeared, array/object shrunk, size dropped).
 *   This means upstream can add/rename/restructure config fields freely
 *   and this module keeps working without code changes.
 * - **Graceful degradation**: every check is wrapped in try/catch.
 *   If a check encounters an unexpected shape, it silently skips.
 * - **Non-blocking**: `ok` is always `true`.
 */
export function runConfigSafetyCheck(
  incoming: unknown,
  current: unknown,
  mode: "apply" | "patch",
): SafetyCheckResult {
  const warnings: ConfigValidationIssue[] = [];

  // Nothing to compare against — first-time write, no warnings.
  if (!current || !isPlainObject(current) || !isPlainObject(incoming)) {
    return { ok: true, warnings };
  }

  // --- Check 1 (apply only): any top-level key that existed but is now missing ---
  if (mode === "apply") {
    try {
      const currentKeys = Object.keys(current);
      const incomingKeys = new Set(Object.keys(incoming));
      const dropped = currentKeys.filter((k) => !incomingKeys.has(k));
      for (const key of dropped) {
        // Skip "meta" — it's auto-stamped, safe to drop.
        if (key === "meta") continue;
        warnings.push({
          path: key,
          message: `字段 "${key}" 在当前配置中存在但新配置中缺失，可能是遗漏。`,
        });
      }
    } catch {
      // skip
    }
  }

  // --- Check 2 (apply only): overall config size dropped > 50% ---
  if (mode === "apply") {
    try {
      const currentSize = JSON.stringify(current).length;
      const incomingSize = JSON.stringify(incoming).length;
      if (currentSize >= 512 && incomingSize < Math.floor(currentSize * 0.5)) {
        warnings.push({
          path: "<root>",
          message: `配置体积从 ${currentSize} 字符缩小到 ${incomingSize} 字符（超过50%），建议检查是否遗漏了字段。`,
        });
      }
    } catch {
      // skip
    }
  }

  // --- Check 3 (apply + patch): any top-level object/array entry count shrunk ---
  // Generically detects: agents.list shrunk, channels lost keys, mcp.servers
  // reduced, plugins.entries lost keys, etc. — without knowing field names.
  try {
    const keysToCheck =
      mode === "apply"
        ? Object.keys(current)
        : // In patch mode only check keys that the patch explicitly touches.
          Object.keys(incoming);

    for (const key of keysToCheck) {
      const curVal = current[key];
      const incVal = incoming[key];
      if (curVal === undefined || incVal === undefined) continue;

      // Direct array / object comparison at top level
      const curCount = countEntries(curVal);
      const incCount = countEntries(incVal);
      if (curCount > 0 && incCount >= 0 && incCount < curCount) {
        warnings.push({
          path: key,
          message: `"${key}" 的条目从 ${curCount} 个减少到 ${incCount} 个。`,
        });
        continue;
      }

      // One level deeper: e.g. agents.list, mcp.servers, plugins.entries
      if (isPlainObject(curVal) && isPlainObject(incVal)) {
        for (const subKey of Object.keys(curVal)) {
          const curSub = curVal[subKey];
          const incSub = incVal[subKey];
          if (curSub === undefined || incSub === undefined) continue;
          const curSubCount = countEntries(curSub);
          const incSubCount = countEntries(incSub);
          if (curSubCount > 0 && incSubCount >= 0 && incSubCount < curSubCount) {
            warnings.push({
              path: `${key}.${subKey}`,
              message: `"${key}.${subKey}" 的条目从 ${curSubCount} 个减少到 ${incSubCount} 个。`,
            });
          }
        }
      }
    }
  } catch {
    // skip
  }

  return { ok: true, warnings };
}
