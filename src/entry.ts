#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";
import { applyCliProfileEnv, parseCliProfileArgs } from "./cli/profile.js";
import { shouldSkipRespawnForArgv } from "./cli/respawn-policy.js";
import { normalizeWindowsArgv } from "./cli/windows-argv.js";
import { isTruthyEnvValue, normalizeEnv } from "./infra/env.js";
import { installProcessWarningFilter } from "./infra/warning-filter.js";
import { attachChildProcessBridge } from "./process/child-process-bridge.js";

process.title = "openclawcn";

// ── Node.js / .jsc bytecode version compatibility check ──
// Delta updates may replace node.exe without updating .jsc files (or vice versa).
// V8 bytecode is version-specific: a mismatch causes silent crashes or white screens.
// Exit with code 78 (EX_CONFIG) so the Tauri shell or service wrapper can show a
// user-friendly "please reinstall" message instead of a cryptic stack trace.
{
  const buildMetaPath = new URL("./build-meta.json", import.meta.url);
  try {
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(buildMetaPath, "utf-8");
    const meta = JSON.parse(raw) as {
      nodeVersion?: string;
      v8Version?: string;
      platform?: string;
      arch?: string;
    };
    if (meta.v8Version && meta.v8Version !== process.versions.v8) {
      console.error(`[openclawcn] V8 engine version mismatch!`);
      console.error(`  Build V8:   ${meta.v8Version} (node ${meta.nodeVersion ?? "?"})`);
      console.error(`  Running V8: ${process.versions.v8} (node ${process.version})`);
      console.error(`  .jsc bytecode is incompatible with this Node.js version.`);
      console.error(`  Please download the latest full installer to fix this.`);
      process.exit(78);
    }
    if (meta.platform && meta.platform !== process.platform) {
      console.error(`[openclawcn] Platform mismatch!`);
      console.error(`  Build platform: ${meta.platform}-${meta.arch ?? "?"}`);
      console.error(`  Running on:     ${process.platform}-${process.arch}`);
      console.error(`  .jsc bytecode compiled for a different OS cannot run here.`);
      console.error(`  Please download the installer for your platform.`);
      process.exit(78);
    }
  } catch {
    // build-meta.json missing (dev mode, git clone, etc.) — skip check
  }
}

installProcessWarningFilter();
normalizeEnv();

if (process.argv.includes("--no-color")) {
  process.env.NO_COLOR = "1";
  process.env.FORCE_COLOR = "0";
}

const EXPERIMENTAL_WARNING_FLAG = "--disable-warning=ExperimentalWarning";

function hasExperimentalWarningSuppressed(): boolean {
  const nodeOptions = process.env.NODE_OPTIONS ?? "";
  if (nodeOptions.includes(EXPERIMENTAL_WARNING_FLAG) || nodeOptions.includes("--no-warnings")) {
    return true;
  }
  for (const arg of process.execArgv) {
    if (arg === EXPERIMENTAL_WARNING_FLAG || arg === "--no-warnings") {
      return true;
    }
  }
  return false;
}

function ensureExperimentalWarningSuppressed(): boolean {
  if (shouldSkipRespawnForArgv(process.argv)) {
    return false;
  }
  if (isTruthyEnvValue(process.env.OPENCLAWCN_NO_RESPAWN)) {
    return false;
  }
  if (isTruthyEnvValue(process.env.OPENCLAWCN_NODE_OPTIONS_READY)) {
    return false;
  }
  if (hasExperimentalWarningSuppressed()) {
    return false;
  }

  // Respawn guard (and keep recursion bounded if something goes wrong).
  process.env.OPENCLAWCN_NODE_OPTIONS_READY = "1";
  // Pass flag as a Node CLI option, not via NODE_OPTIONS (--disable-warning is disallowed in NODE_OPTIONS).
  const child = spawn(
    process.execPath,
    [EXPERIMENTAL_WARNING_FLAG, ...process.execArgv, ...process.argv.slice(1)],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

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
      "[openclawcn] Failed to respawn CLI:",
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exit(1);
  });

  // Parent must not continue running the CLI.
  return true;
}

process.argv = normalizeWindowsArgv(process.argv);

if (!ensureExperimentalWarningSuppressed()) {
  const parsed = parseCliProfileArgs(process.argv);
  if (!parsed.ok) {
    // Keep it simple; Commander will handle rich help/errors after we strip flags.
    console.error(`[openclawcn] ${parsed.error}`);
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
        "[openclawcn] Failed to start CLI:",
        error instanceof Error ? (error.stack ?? error.message) : error,
      );
      process.exitCode = 1;
    });
}
