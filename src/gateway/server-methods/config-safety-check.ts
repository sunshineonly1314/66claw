import type { ConfigValidationIssue } from "../../config/config.js";

export interface SafetyCheckResult {
  /** true = write is allowed; false = write must be blocked (critical fields dropped in apply mode). */
  ok: boolean;
  /** Human-readable reason when ok=false. */
  blockReason?: string;
  /** Advisory warnings for the AI to consider. Empty when no concerns found. */
  warnings: ConfigValidationIssue[];
}

/**
 * Top-level config keys that are critical for OpenClawCN to start correctly.
 * If any of these disappear in a config.apply, we hard-block the write.
 * This list is intentionally conservative: it covers fields that, if missing,
 * will cause the gateway to fail on next boot.
 *
 * IMPORTANT: these must be real top-level keys in OpenClawCNSchema (zod-schema.ts).
 * Verified against schema: agents, models, channels, tools, and mcp are
 * direct keys of OpenClawCNSchema. (security and sandbox are NOT top-level;
 * sandbox lives at agents.defaults.sandbox, security has no top-level key.)
 *
 * [CN-PATCH:safety-check] These fields are CN-specific or universally required.
 */
const CRITICAL_TOP_LEVEL_FIELDS = [
  "agents", // agents.list — agent definitions; gateway can't route without this
  "models", // model/provider config — without this no AI calls work
  "channels", // channel integrations — silently removes all messaging if dropped
  "tools", // CN-specific: tools.exec, tools.write, tools.browser policies
  "mcp", // MCP server config — dropping kills external tool integrations
] as const;

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
 * Pre-write safety check for config.apply and config.patch.
 *
 * Runs after schema validation passes but before `writeConfigFile()`.
 *
 * **Blocking checks (apply mode only):**
 * - If any CRITICAL_TOP_LEVEL_FIELDS field is dropped, returns ok=false → write is rejected.
 * - If overall config size shrinks by >70%, returns ok=false → write is rejected.
 * These hard-blocks protect against AI submitting an incomplete config via config.apply.
 *
 * **Advisory checks (both modes):**
 * - Non-critical field drops and array/object shrinkage produce warnings (ok=true).
 * - Warnings are attached to the success response so the AI can self-correct.
 *
 * Design principles:
 * - **Schema-agnostic for advisory checks**: generic comparisons only, no field names.
 * - **Graceful degradation**: every check is wrapped in try/catch. If a check throws,
 *   it degrades to allowing the write (never blocks on a check failure).
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

  // --- Hard-block (apply only): critical top-level fields dropped ---
  // If the incoming config is missing a field that existed AND that field is in
  // the CRITICAL_TOP_LEVEL_FIELDS list, block the write entirely.
  // This prevents AI from accidentally deleting e.g. agents/models/channels
  // by submitting an incomplete config via config.apply.
  if (mode === "apply") {
    try {
      const incomingKeys = new Set(Object.keys(incoming));
      const criticalDropped = (CRITICAL_TOP_LEVEL_FIELDS as readonly string[]).filter(
        (k) => k in current && !incomingKeys.has(k),
      );
      if (criticalDropped.length > 0) {
        return {
          ok: false,
          blockReason:
            `config.apply would delete critical fields: ${criticalDropped.join(", ")}. ` +
            `Use config.patch instead, or include all existing top-level fields in your config.apply payload. ` +
            `Re-run config.get to retrieve the full current config.`,
          warnings,
        };
      }
    } catch {
      // If the check itself throws, do not block — degrade gracefully.
    }
  }

  // --- Hard-block (apply only): config size shrank by >50% ---
  // Threshold aligned with io.ts resolveConfigWriteSuspiciousReasons (also 50%).
  // A legitimate full-replace should be close in size to the original.
  // Shrinking by more than 50% almost certainly means the AI constructed
  // an incomplete skeleton config rather than editing the full one.
  if (mode === "apply") {
    try {
      const currentSize = JSON.stringify(current).length;
      const incomingSize = JSON.stringify(incoming).length;
      if (currentSize >= 512 && incomingSize < Math.floor(currentSize * 0.5)) {
        return {
          ok: false,
          blockReason:
            `config.apply payload is ${incomingSize} chars but current config is ${currentSize} chars ` +
            `(>50% reduction). This strongly suggests the payload is incomplete. ` +
            `Use config.patch to change specific fields, or re-run config.get to base your changes on the full config.`,
          warnings,
        };
      }
    } catch {
      // degrade gracefully
    }
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
