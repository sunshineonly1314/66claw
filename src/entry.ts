#!/usr/bin/env node
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { applyCliProfileEnv, parseCliProfileArgs } from "./cli/profile.js";
import { isTruthyEnvValue } from "./infra/env.js";
import { installProcessWarningFilter } from "./infra/warnings.js";
import { attachChildProcessBridge } from "./process/child-process-bridge.js";

process.title = "clawdbot";
installProcessWarningFilter();

// Catch unhandled promise rejections to prevent silent crashes from background
// tasks (heartbeat, cron, skills sync, MCP marketplace sync, etc.).
process.on("unhandledRejection", (reason) => {
  console.error(
    "[clawdbot] Unhandled promise rejection:",
    reason instanceof Error ? (reason.stack ?? reason.message) : reason,
  );
  // Do NOT exit — background task failures should not kill the gateway.
});

// Catch uncaught synchronous exceptions to prevent the gateway from crashing.
// Combined with the unhandledRejection handler above, this ensures the gateway
// stays alive even when unexpected errors occur in API call chains.
process.on("uncaughtException", (error) => {
  console.error(
    "[clawdbot] Uncaught exception:",
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  // Do NOT exit — the gateway should attempt to continue serving other requests.
  // Critical errors (OOM, etc.) will still cause the OS to kill the process.
});

// Ensure Windows console uses UTF-8 (code page 65001) so Chinese/CJK text
// from plugins and log messages does not appear as garbled GBK mojibake.
if (process.platform === "win32") {
  try {
    execSync("chcp 65001", { stdio: "ignore" });
  } catch {
    // ignore — best-effort
  }
}

if (process.argv.includes("--no-color")) {
  process.env.NO_COLOR = "1";
  process.env.FORCE_COLOR = "0";
}

/** Node-level flags that suppress noisy warnings before any JS code runs. */
const SUPPRESSED_WARNING_FLAGS = [
  "--disable-warning=ExperimentalWarning",
  "--disable-warning=DEP0040", // punycode (transitive dep)
  "--disable-warning=DEP0060", // util._extend (transitive dep)
];

function hasWarningsSuppressed(nodeOptions: string): boolean {
  if (!nodeOptions) return false;
  if (nodeOptions.includes("--no-warnings")) return true;
  return SUPPRESSED_WARNING_FLAGS.every((flag) => nodeOptions.includes(flag));
}

function ensureWarningsSuppressed(): boolean {
  if (isTruthyEnvValue(process.env.CLAWDBOT_NO_RESPAWN)) return false;
  if (isTruthyEnvValue(process.env.CLAWDBOT_NODE_OPTIONS_READY)) return false;
  const nodeOptions = process.env.NODE_OPTIONS ?? "";
  if (hasWarningsSuppressed(nodeOptions)) return false;

  process.env.CLAWDBOT_NODE_OPTIONS_READY = "1";
  const missing = SUPPRESSED_WARNING_FLAGS.filter((f) => !nodeOptions.includes(f));
  process.env.NODE_OPTIONS = `${nodeOptions} ${missing.join(" ")}`.trim();

  const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: "inherit",
    env: process.env,
  });

  attachChildProcessBridge(child);

  child.once("exit", (code, signal) => {
    if (signal) {
      process.exitCode = 1;
      return;
    }
    process.exit(code ?? 1);
  });

  child.once("error", (error) => {
    console.error(
      "[clawdbot] Failed to respawn CLI:",
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exit(1);
  });

  // Parent must not continue running the CLI.
  return true;
}

function normalizeWindowsArgv(argv: string[]): string[] {
  if (process.platform !== "win32") return argv;
  if (argv.length < 2) return argv;
  const stripControlChars = (value: string): string => {
    let out = "";
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code >= 32 && code !== 127) {
        out += value[i];
      }
    }
    return out;
  };
  const normalizeArg = (value: string): string =>
    stripControlChars(value)
      .replace(/^['"]+|['"]+$/g, "")
      .trim();
  const normalizeCandidate = (value: string): string =>
    normalizeArg(value).replace(/^\\\\\\?\\/, "");
  const execPath = normalizeCandidate(process.execPath);
  const execPathLower = execPath.toLowerCase();
  const execBase = path.basename(execPath).toLowerCase();
  const isExecPath = (value: string | undefined): boolean => {
    if (!value) return false;
    const lower = normalizeCandidate(value).toLowerCase();
    return (
      lower === execPathLower ||
      path.basename(lower) === execBase ||
      lower.endsWith("\\node.exe") ||
      lower.endsWith("/node.exe") ||
      lower.includes("node.exe")
    );
  };
  const next = [...argv];
  for (let i = 1; i <= 3 && i < next.length; ) {
    if (isExecPath(next[i])) {
      next.splice(i, 1);
      continue;
    }
    i += 1;
  }
  const filtered = next.filter((arg, index) => index === 0 || !isExecPath(arg));
  if (filtered.length < 3) return filtered;
  const cleaned = [...filtered];
  for (let i = 2; i < cleaned.length; ) {
    const arg = cleaned[i];
    if (!arg || arg.startsWith("-")) {
      i += 1;
      continue;
    }
    if (isExecPath(arg)) {
      cleaned.splice(i, 1);
      continue;
    }
    break;
  }
  return cleaned;
}

process.argv = normalizeWindowsArgv(process.argv);

/**
 * Lightweight entry-point integrity check.
 *
 * Verifies that critical security modules exist before loading the main CLI.
 * This runs BEFORE any security/ or license/ module is imported, so it must
 * be self-contained (only uses Node.js built-ins).
 *
 * Purpose: prevent an attacker from simply deleting security modules to
 * bypass all protection, or replacing them with empty stubs.
 */
function verifyEntryIntegrity(): boolean {
  // Only check in production builds (__DEV_BUILD__ is replaced at build time)
  const isDevBuild = typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__;
  if (isDevBuild) return true;

  try {
    const entryDir = path.dirname(fileURLToPath(import.meta.url));

    // Critical modules that MUST exist in a valid installation
    const criticalModules = [
      "security/integrity.js",
      "security/anti-debug.js",
      "license/rsa-verify.js",
      "license/verify.js",
      "gateway/license-check.js",
    ];

    for (const mod of criticalModules) {
      const modPath = path.join(entryDir, mod);
      if (!existsSync(modPath)) {
        console.error(`[clawdbot] Critical module missing: ${mod}`);
        return false;
      }
    }

    return true;
  } catch {
    // If the check itself fails, don't block startup in dev scenarios
    return true;
  }
}

if (!ensureWarningsSuppressed()) {
  // Entry-point integrity check — runs before any security module loads
  if (!verifyEntryIntegrity()) {
    console.error("[clawdbot] Integrity check failed — installation may be corrupted or tampered.");
    process.exit(78); // EX_CONFIG (sysexits.h)
  }

  const parsed = parseCliProfileArgs(process.argv);
  if (!parsed.ok) {
    // Keep it simple; Commander will handle rich help/errors after we strip flags.
    console.error(`[clawdbot] ${parsed.error}`);
    process.exit(2);
  }

  if (parsed.profile) {
    applyCliProfileEnv({ profile: parsed.profile });
    // Keep Commander and ad-hoc argv checks consistent.
    process.argv = parsed.argv;
  }

  import("./cli/run-main.js")
    .then(({ runCli }) => runCli(process.argv))
    .catch((error) => {
      console.error(
        "[clawdbot] Failed to start CLI:",
        error instanceof Error ? (error.stack ?? error.message) : error,
      );
      process.exitCode = 1;
    });
}
