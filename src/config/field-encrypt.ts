/**
 * Field-Level Transparent Encryption for Config Sensitive Fields
 * 配置敏感字段透明加密
 *
 * 对配置文件中标记为 sensitive 的字段（API Key、Token、Password、License Key 等）
 * 进行 AES-256-CBC 机器绑定加密。磁盘上存储为 ENC{base64} 格式，
 * 读取时自动解密，写入时自动加密。
 *
 * 设计参照 env-substitution.ts / env-preserve.ts 的 ${VAR} 替换模式：
 * - 读取路径: 深度遍历解密 ENC{...} → 明文
 * - 写入路径: 深度遍历加密明文 → ENC{...}（仅 sensitive 路径）
 */

import {
  encryptConfigField,
  decryptConfigField,
  isEncryptionEnabled,
} from "../security/content-vault.js";
import { containsEnvVarReference } from "./env-substitution.js";
import { mapSensitivePaths, buildBaseHints, type ConfigUiHints } from "./schema.hints.js";
import { OpenClawCNSchema } from "./zod-schema.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("config/field-encrypt");

// ============================================================================
// Decrypt failure rate limiter — prevents log flooding when encrypted fields
// cannot be decrypted (wrong machine, corrupted data). Only log the first
// failure per unique error message, then suppress duplicates for a cooldown
// window. This avoids the "service looks dead" scenario where loadConfig()
// is called frequently (200ms cache TTL) and each call produces N warnings
// for N undecryptable ENC{...} fields.
// ============================================================================

const DECRYPT_LOG_COOLDOWN_MS = 60_000; // 1 minute cooldown per unique error
let decryptFailureLoggedAt = 0;
let decryptFailureCount = 0;
let decryptFailureSuppressed = 0;

function logDecryptFailure(errMsg: string): void {
  const now = Date.now();
  if (now - decryptFailureLoggedAt < DECRYPT_LOG_COOLDOWN_MS) {
    decryptFailureSuppressed++;
    decryptFailureCount++;
    return;
  }
  // Log with count of suppressed messages since last log
  if (decryptFailureSuppressed > 0) {
    log.warn(
      `Failed to decrypt config field: ${errMsg} (${decryptFailureSuppressed} similar errors suppressed in the last ${Math.round((now - decryptFailureLoggedAt) / 1000)}s)`,
    );
  } else {
    log.warn(`Failed to decrypt config field: ${errMsg}`);
  }
  decryptFailureLoggedAt = now;
  decryptFailureCount++;
  decryptFailureSuppressed = 0;
}

// ============================================================================
// ENC{...} Format
// ============================================================================

const ENC_PREFIX = "ENC{";
const ENC_SUFFIX = "}";

/** Detect whether a string value is an ENC{base64} ciphertext wrapper. */
export function isEncryptedValue(value: string): boolean {
  return (
    value.length > ENC_PREFIX.length + ENC_SUFFIX.length &&
    value.startsWith(ENC_PREFIX) &&
    value.endsWith(ENC_SUFFIX)
  );
}

function extractEncPayload(value: string): string {
  return value.slice(ENC_PREFIX.length, -ENC_SUFFIX.length);
}

function wrapEncPayload(encrypted: Buffer): string {
  return `${ENC_PREFIX}${encrypted.toString("base64")}${ENC_SUFFIX}`;
}

// ============================================================================
// Sensitive Path Resolution
// ============================================================================

let cachedHints: ConfigUiHints | null = null;
let cachedLookup: Set<string> | null = null;

/**
 * Build the sensitive-path lookup set from the Zod schema.
 *
 * Reuses the same `buildRedactionLookup` approach from redact-snapshot.ts:
 * for each sensitive leaf path, all ancestor prefixes + wildcard variants
 * are added to the set so the deep-walk can short-circuit non-sensitive
 * subtrees efficiently.
 */
function getSensitiveLookup(): Set<string> {
  if (cachedLookup) return cachedLookup;

  const hints = cachedHints ?? mapSensitivePaths(OpenClawCNSchema, "", buildBaseHints());
  cachedHints = hints;

  const result = new Set<string>();
  for (const [path, hint] of Object.entries(hints)) {
    if (!hint.sensitive) continue;

    const parts = path.split(".");
    let joinedPath = parts.shift() ?? "";
    result.add(joinedPath);
    if (joinedPath.endsWith("[]")) {
      result.add(joinedPath.slice(0, -2));
    }
    for (const part of parts) {
      if (part.endsWith("[]")) {
        result.add(`${joinedPath}.${part.slice(0, -2)}`);
      }
      joinedPath = `${joinedPath}.${part}`;
      result.add(joinedPath);
    }
  }

  if (result.size !== 0) {
    result.add("");
  }

  cachedLookup = result;
  return result;
}

/**
 * Check if a concrete path is a sensitive **leaf** (i.e., the field itself
 * should be encrypted, not just a parent container).
 */
function isSensitiveLeaf(concretePath: string, lookup: Set<string>): boolean {
  // Direct match
  if (lookup.has(concretePath)) return true;
  // Wildcard match: replace the last-but-one segment with *
  // e.g. "models.providers.openai.apiKey" → "models.providers.*.apiKey"
  const dotIdx = concretePath.lastIndexOf(".");
  if (dotIdx < 0) return false;
  const prefix = concretePath.slice(0, dotIdx);
  const suffix = concretePath.slice(dotIdx); // ".apiKey"
  const parentDot = prefix.lastIndexOf(".");
  if (parentDot >= 0) {
    const wildcardPath = prefix.slice(0, parentDot) + ".*" + suffix;
    if (lookup.has(wildcardPath)) return true;
  }
  // Also try direct parent wildcard: "prefix.*"
  const wildcardDirect = prefix + ".*";
  if (lookup.has(wildcardDirect)) return true;

  return false;
}

/**
 * Check if a path (possibly a container) is in the sensitive subtree,
 * meaning we should recurse into it.
 */
function isInSensitiveSubtree(path: string, lookup: Set<string>): boolean {
  if (!path) return lookup.has("");
  if (lookup.has(path)) return true;
  // Wildcard: "models.providers.*" should match "models.providers.openai"
  const dotIdx = path.lastIndexOf(".");
  if (dotIdx >= 0) {
    const wildcardPath = path.slice(0, dotIdx) + ".*";
    if (lookup.has(wildcardPath)) return true;
  }
  return false;
}

// ============================================================================
// Helpers
// ============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ============================================================================
// Decryption (Read Path)
// ============================================================================

/**
 * Deep-walk a parsed config object and decrypt all ENC{...} string values.
 *
 * Called after JSON5 parse + $include + overlay, before ${VAR} substitution
 * and Zod validation.
 *
 * Non-encrypted strings pass through unchanged (backward-compatible with
 * plaintext configs that haven't been encrypted yet).
 */
export function decryptConfigFields(obj: unknown): unknown {
  if (!isEncryptionEnabled()) return obj;
  return decryptWalk(obj);
}

function decryptWalk(value: unknown): unknown {
  if (typeof value === "string") {
    if (!isEncryptedValue(value)) return value;
    try {
      const payload = extractEncPayload(value);
      const buf = Buffer.from(payload, "base64");
      return decryptConfigField(buf);
    } catch (err) {
      // Decryption failed (wrong machine, corrupted data).
      // Return as-is; Zod validation will surface the error.
      // Rate-limited to prevent log flooding when many fields fail.
      logDecryptFailure(err instanceof Error ? err.message : String(err));
      return value;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => decryptWalk(item));
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = decryptWalk(child);
    }
    return result;
  }

  return value;
}

// ============================================================================
// Encryption (Write Path)
// ============================================================================

/**
 * Deep-walk a config-to-write and encrypt sensitive plaintext values.
 *
 * Called after env-var restoration (restoreEnvVarRefs / restoreEnvRefsFromMap),
 * before stampConfigVersion and JSON.stringify.
 *
 * @param obj - The config about to be serialized to disk
 * @param diskParsed - The raw parsed config from disk (pre-substitution),
 *   used to detect values that are already ENC{...} and avoid re-encrypting
 *   unchanged values (prevents ciphertext churn from random IVs).
 */
export function encryptConfigFields(obj: unknown, diskParsed?: unknown): unknown {
  if (!isEncryptionEnabled()) return obj;
  const lookup = getSensitiveLookup();
  if (!lookup.has("")) return obj; // no sensitive fields at all
  return encryptWalk(obj, diskParsed, "", lookup);
}

function encryptWalk(
  value: unknown,
  diskValue: unknown,
  path: string,
  lookup: Set<string>,
): unknown {
  if (typeof value === "string") {
    // Only encrypt at sensitive leaf paths
    if (!isSensitiveLeaf(path, lookup)) return value;

    // Skip empty strings
    if (!value) return value;

    // Skip ${VAR} env var references — these are templates, not secrets
    if (containsEnvVarReference(value)) return value;

    // Skip values already in ENC{...} format
    if (isEncryptedValue(value)) return value;

    // Ciphertext stability: if the disk value was ENC{...} and decrypting it
    // yields the same plaintext, reuse the existing ciphertext to avoid churn
    if (typeof diskValue === "string" && isEncryptedValue(diskValue)) {
      try {
        const payload = extractEncPayload(diskValue);
        const buf = Buffer.from(payload, "base64");
        const decrypted = decryptConfigField(buf);
        if (decrypted === value) {
          return diskValue; // value unchanged, keep existing ciphertext
        }
      } catch {
        // Disk ciphertext can't be decrypted; encrypt fresh below
      }
    }

    // Encrypt the plaintext
    try {
      const encrypted = encryptConfigField(value);
      return wrapEncPayload(encrypted);
    } catch (err) {
      log.warn(
        `Failed to encrypt config field at ${path}: ${err instanceof Error ? err.message : err}`,
      );
      return value; // fail open: store plaintext rather than lose data
    }
  }

  if (Array.isArray(value)) {
    // Short-circuit: if this path is not in the sensitive subtree, skip
    const arrayPath = `${path}[]`;
    if (!isInSensitiveSubtree(path, lookup) && !isInSensitiveSubtree(arrayPath, lookup)) {
      return value;
    }
    const diskArr = Array.isArray(diskValue) ? diskValue : [];
    return value.map((item, i) => encryptWalk(item, diskArr[i], arrayPath, lookup));
  }

  if (isPlainObject(value)) {
    // Short-circuit: if this path is not in the sensitive subtree, skip
    if (path && !isInSensitiveSubtree(path, lookup)) {
      return value;
    }
    const diskObj = isPlainObject(diskValue) ? diskValue : {};
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      result[key] = encryptWalk(child, diskObj[key], childPath, lookup);
    }
    return result;
  }

  return value;
}

// ============================================================================
// Cache Invalidation (for tests)
// ============================================================================

/** @internal Reset cached sensitive paths and log rate limiter (for testing). */
export function clearFieldEncryptCache(): void {
  cachedHints = null;
  cachedLookup = null;
  decryptFailureLoggedAt = 0;
  decryptFailureCount = 0;
  decryptFailureSuppressed = 0;
}

// ============================================================================
// Repair: Strip undecryptable ENC{...} fields
// ============================================================================

/**
 * Walk a raw parsed config and replace any ENC{...} values that cannot be
 * decrypted on this machine with empty strings. Returns the cleaned config
 * and a list of field paths that were stripped.
 *
 * Used by doctor --fix / config-repair to recover from configs that were
 * encrypted on a different machine (different MachineGuid) or whose
 * ciphertext has been corrupted.
 */
export function stripUndecryptableFields(obj: unknown): {
  config: unknown;
  stripped: string[];
} {
  if (!isEncryptionEnabled()) return { config: obj, stripped: [] };
  const stripped: string[] = [];
  const config = stripWalk(obj, "", stripped);
  return { config, stripped };
}

function stripWalk(value: unknown, path: string, stripped: string[]): unknown {
  if (typeof value === "string") {
    if (!isEncryptedValue(value)) return value;
    try {
      const payload = extractEncPayload(value);
      const buf = Buffer.from(payload, "base64");
      decryptConfigField(buf);
      return value; // decryptable — keep as-is
    } catch {
      stripped.push(path || "<root>");
      return ""; // undecryptable — clear to empty string
    }
  }

  if (Array.isArray(value)) {
    return value.map((item, i) => stripWalk(item, path ? `${path}[${i}]` : `[${i}]`, stripped));
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      result[key] = stripWalk(child, childPath, stripped);
    }
    return result;
  }

  return value;
}
