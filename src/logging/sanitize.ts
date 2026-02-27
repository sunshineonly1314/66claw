/**
 * Unified log sanitization module.
 *
 * Merges the two previously separate redaction systems:
 * 1. logging/redact.ts — tool output redaction (16 patterns)
 * 2. log-report.ts — log upload redaction (8 patterns)
 *
 * This module provides a single, consistent set of patterns for all
 * sensitive data removal, used both at log-write time (optional) and
 * at log-upload time (mandatory).
 */

import { createHash } from "node:crypto";

// ── Combined Sensitive Patterns ─────────────────────────────────────
// Each pattern includes the original source for traceability.

const SANITIZE_PATTERNS: Array<{ pattern: RegExp; replacement: string; source: string }> = [
  // ── API Key Prefixes (from both sources) ──
  { pattern: /\bsk-[a-zA-Z0-9_-]{8,}\b/g, replacement: "sk-[REDACTED]", source: "both" },
  { pattern: /\bghp_[a-zA-Z0-9]{16,}\b/g, replacement: "ghp_[REDACTED]", source: "both" },
  { pattern: /\bgho_[a-zA-Z0-9]{16,}\b/g, replacement: "gho_[REDACTED]", source: "log-report" },
  { pattern: /\bghr_[a-zA-Z0-9]{16,}\b/g, replacement: "ghr_[REDACTED]", source: "log-report" },
  {
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    replacement: "github_pat_[REDACTED]",
    source: "redact",
  },
  { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, replacement: "xox_[REDACTED]", source: "redact" },
  { pattern: /\bxapp-[A-Za-z0-9-]{10,}\b/g, replacement: "xapp-[REDACTED]", source: "redact" },
  { pattern: /\bgsk_[A-Za-z0-9_-]{10,}\b/g, replacement: "gsk_[REDACTED]", source: "redact" },
  { pattern: /\bAIza[0-9A-Za-z\-_]{20,}\b/g, replacement: "AIza[REDACTED]", source: "redact" },
  { pattern: /\bpplx-[A-Za-z0-9_-]{10,}\b/g, replacement: "pplx-[REDACTED]", source: "redact" },
  { pattern: /\bnpm_[A-Za-z0-9]{10,}\b/g, replacement: "npm_[REDACTED]", source: "redact" },

  // ── Encrypted fields ──
  { pattern: /ENC\{[^}]+\}/g, replacement: "ENC{[REDACTED]}", source: "log-report" },

  // ── Bearer / Authorization tokens ──
  { pattern: /Bearer\s+[a-zA-Z0-9._-]{20,}/gi, replacement: "Bearer [REDACTED]", source: "both" },
  {
    pattern: /Authorization\s*[:=]\s*Bearer\s+([A-Za-z0-9._\-+=]+)/g,
    replacement: "Authorization: Bearer [REDACTED]",
    source: "redact",
  },

  // ── Generic secret assignments (ENV, JSON, CLI) ──
  {
    pattern: /\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD)\b\s*[=:]\s*(["']?)([^\s"'\\]+)\1/gi,
    replacement: "[SENSITIVE_FIELD_REDACTED]",
    source: "both",
  },
  {
    pattern: /"(?:apiKey|token|secret|password|passwd|accessToken|refreshToken)"\s*:\s*"([^"]+)"/g,
    replacement: '"[SENSITIVE_JSON_FIELD]":"[REDACTED]"',
    source: "redact",
  },
  {
    pattern: /--(?:api[-_]?key|token|secret|password|passwd)\s+(["']?)([^\s"']+)\1/gi,
    replacement: "--[REDACTED_FLAG] [REDACTED]",
    source: "redact",
  },

  // ── PEM private keys ──
  {
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "-----BEGIN PRIVATE KEY-----\n...[REDACTED]...\n-----END PRIVATE KEY-----",
    source: "redact",
  },

  // ── Google OAuth ──
  { pattern: /\bGOCSPX-[A-Za-z0-9_-]+\b/g, replacement: "GOCSPX-[REDACTED]", source: "log-report" },

  // ── Telegram-style bot tokens ──
  {
    pattern: /\b(\d{6,}:[A-Za-z0-9_-]{20,})\b/g,
    replacement: "[BOT_TOKEN_REDACTED]",
    source: "redact",
  },
];

/**
 * Sanitize a single string by applying all sensitive data patterns.
 * Safe to call on any text — returns the input unchanged if no matches.
 */
export function sanitizeText(text: string): string {
  if (!text) return text;
  let result = text;
  for (const { pattern, replacement } of SANITIZE_PATTERNS) {
    // Reset lastIndex for global regexes to prevent stateful matching issues.
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Sanitize an array of log entry strings.
 */
export function sanitizeLogEntries(entries: string[]): string[] {
  return entries.map(sanitizeText);
}

/**
 * Anonymize a hostname to a short hash prefix.
 * Returns "host-XXXXXX" where XXXXXX is the first 6 chars of a SHA-256 base64url digest.
 * Using a cryptographic hash ensures similar hostnames (e.g. DESKTOP-ABC vs DESKTOP-ABD)
 * produce completely different outputs.
 */
export function anonymizeHostname(hostname: string): string {
  if (!hostname) return "host-unknown";
  return `host-${createHash("sha256").update(hostname).digest("base64url").slice(0, 6)}`;
}
