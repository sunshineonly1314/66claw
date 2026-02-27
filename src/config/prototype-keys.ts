/**
 * Centralized guard against prototype-pollution keys.
 *
 * Every config merge / deep-set path **must** call this function before
 * writing a user-supplied key into a plain object.  Without this check
 * an attacker could craft a config value keyed by `__proto__` or
 * `constructor` and modify `Object.prototype` globally.
 */

const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function isBlockedObjectKey(key: string): boolean {
  return BLOCKED_KEYS.has(key);
}
