import { Type } from "@sinclair/typebox";
import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

import type { ClawdbotPluginApi } from "../../../src/plugins/types.js";

/**
 * Sensitive directories that should not be used as cwd.
 * ClawdbotCN 专属：阻止访问敏感系统目录
 */
const BLOCKED_CWD_PATTERNS = [
  // Windows system directories (match directory and all subdirectories)
  /^[a-z]:\\windows(\\|$)/i,
  /^[a-z]:\\windows\\system32(\\|$)/i,
  /^[a-z]:\\windows\\syswow64(\\|$)/i,
  // Unix system directories (match directory and all subdirectories)
  /^\/etc(\/|$)/,
  /^\/root(\/|$)/,
  /^\/var\/log(\/|$)/,
  /^\/proc(\/|$)/,
  /^\/sys(\/|$)/,
  /^\/dev(\/|$)/,
];

/**
 * Validate cwd path to prevent path traversal and access to sensitive directories.
 * ClawdbotCN 专属：路径注入防护
 */
function validateCwdPath(cwd: string, gatewayWorkingDir: string): void {
  // cwd must be a relative path; absolute paths are not allowed
  if (path.isAbsolute(cwd)) {
    throw new Error(`cwd must be a relative path (got absolute: ${cwd})`);
  }

  // Resolve relative to gateway working directory and ensure it stays within
  const resolved = path.resolve(gatewayWorkingDir, cwd);
  const normalizedGwd = path.resolve(gatewayWorkingDir);
  const gwdWithSep = normalizedGwd.endsWith(path.sep) ? normalizedGwd : normalizedGwd + path.sep;
  if (resolved !== normalizedGwd && !resolved.startsWith(gwdWithSep)) {
    throw new Error(`cwd must stay within the gateway working directory: ${cwd}`);
  }

  // Check against blocked patterns
  for (const pattern of BLOCKED_CWD_PATTERNS) {
    if (pattern.test(resolved)) {
      throw new Error(`Blocked cwd: access to system directory not allowed: ${cwd}`);
    }
  }

  // Verify the directory exists
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      throw new Error(`Invalid cwd: ${cwd} is not a directory`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Invalid cwd: directory does not exist: ${cwd}`);
    }
    throw err;
  }
}

type LobsterEnvelope =
  | {
      ok: true;
      status: "ok" | "needs_approval" | "cancelled";
      output: unknown[];
      requiresApproval: null | {
        type: "approval_request";
        prompt: string;
        items: unknown[];
        resumeToken?: string;
      };
    }
  | {
      ok: false;
      error: { type?: string; message: string };
    };

const ALLOWED_LOBSTER_BASENAMES = new Set(["lobster", "lobster.exe", "lobster.cmd", "lobster.bat"]);

function resolveExecutablePath(lobsterPathRaw: string | undefined) {
  const lobsterPath = lobsterPathRaw?.trim() || "lobster";
  if (lobsterPath === "lobster") return lobsterPath; // use PATH lookup
  if (!path.isAbsolute(lobsterPath)) {
    throw new Error("lobsterPath must be an absolute path (or omit to use PATH)");
  }
  // Security: verify basename is an allowed lobster executable name
  const base = path.basename(lobsterPath).toLowerCase();
  if (!ALLOWED_LOBSTER_BASENAMES.has(base)) {
    throw new Error(`lobsterPath basename "${base}" is not an allowed lobster executable`);
  }
  // Verify file exists
  try {
    const stat = fs.statSync(lobsterPath);
    if (!stat.isFile()) {
      throw new Error(`lobsterPath is not a file: ${lobsterPath}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`lobsterPath does not exist: ${lobsterPath}`);
    }
    throw err;
  }
  return lobsterPath;
}

function isWindowsSpawnErrorThatCanUseShell(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "EINVAL" || code === "ENOENT";
}

async function runLobsterSubprocessOnce(
  params: {
    execPath: string;
    argv: string[];
    cwd: string;
    timeoutMs: number;
    maxStdoutBytes: number;
  },
  useShell: boolean,
) {
  const { execPath, argv, cwd } = params;
  const timeoutMs = Math.max(200, params.timeoutMs);
  const maxStdoutBytes = Math.max(1024, params.maxStdoutBytes);

  const env = { ...process.env, LOBSTER_MODE: "tool" } as Record<string, string | undefined>;
  const nodeOptions = env.NODE_OPTIONS ?? "";
  if (nodeOptions.includes("--inspect")) {
    delete env.NODE_OPTIONS;
  }

  return await new Promise<{ stdout: string }>((resolve, reject) => {
    const child = spawn(execPath, argv, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env,
      shell: useShell,
      windowsHide: useShell ? true : undefined,
    });

    let stdout = "";
    let stdoutBytes = 0;
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk) => {
      const str = String(chunk);
      stdoutBytes += Buffer.byteLength(str, "utf8");
      if (stdoutBytes > maxStdoutBytes) {
        try {
          child.kill("SIGKILL");
        } finally {
          reject(new Error("lobster output exceeded maxStdoutBytes"));
        }
        return;
      }
      stdout += str;
    });

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } finally {
        reject(new Error("lobster subprocess timed out"));
      }
    }, timeoutMs);

    child.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`lobster failed (${code ?? "?"}): ${stderr.trim() || stdout.trim()}`));
        return;
      }
      resolve({ stdout });
    });
  });
}

async function runLobsterSubprocess(params: {
  execPath: string;
  argv: string[];
  cwd: string;
  timeoutMs: number;
  maxStdoutBytes: number;
}) {
  try {
    return await runLobsterSubprocessOnce(params, false);
  } catch (err) {
    if (process.platform === "win32" && isWindowsSpawnErrorThatCanUseShell(err)) {
      return await runLobsterSubprocessOnce(params, true);
    }
    throw err;
  }
}

function parseEnvelope(stdout: string): LobsterEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    // Tolerate noisy stdout before the JSON envelope: find the first '{' or '['
    const jsonStart = stdout.search(/[\[{]/);
    if (jsonStart > 0) {
      try {
        parsed = JSON.parse(stdout.slice(jsonStart));
      } catch {
        throw new Error("lobster returned invalid JSON");
      }
    } else {
      throw new Error("lobster returned invalid JSON");
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("lobster returned invalid JSON envelope");
  }

  const ok = (parsed as { ok?: unknown }).ok;
  if (ok === true || ok === false) {
    return parsed as LobsterEnvelope;
  }

  throw new Error("lobster returned invalid JSON envelope");
}

export function createLobsterTool(api: ClawdbotPluginApi) {
  return {
    name: "lobster",
    label: "Lobster",
    description:
      "Run Lobster pipelines as a local-first workflow runtime (typed JSON envelope + resumable approvals).",
    parameters: Type.Object({
      // NOTE: Prefer string enums in tool schemas; some providers reject unions/anyOf.
      action: Type.Unsafe<"run" | "resume">({ type: "string", enum: ["run", "resume"] }),
      pipeline: Type.Optional(Type.String()),
      argsJson: Type.Optional(Type.String()),
      token: Type.Optional(Type.String()),
      approve: Type.Optional(Type.Boolean()),
      lobsterPath: Type.Optional(Type.String()),
      cwd: Type.Optional(Type.String()),
      timeoutMs: Type.Optional(Type.Number()),
      maxStdoutBytes: Type.Optional(Type.Number()),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const action = String(params.action || "").trim();
      if (!action) throw new Error("action required");

      // Resolve lobsterPath: tool param > pluginConfig > default PATH lookup
      const lobsterPathParam =
        typeof params.lobsterPath === "string" ? params.lobsterPath : undefined;
      const pluginLobsterPath =
        typeof api.pluginConfig?.lobsterPath === "string"
          ? api.pluginConfig.lobsterPath
          : undefined;
      const execPath = resolveExecutablePath(lobsterPathParam ?? pluginLobsterPath);

      const gatewayWorkingDir = process.cwd();
      const rawCwd =
        typeof params.cwd === "string" && params.cwd.trim() ? params.cwd.trim() : undefined;

      let cwd: string;
      if (rawCwd) {
        // ClawdbotCN 专属：cwd 路径验证 - 防止路径遍历攻击
        validateCwdPath(rawCwd, gatewayWorkingDir);
        cwd = path.resolve(gatewayWorkingDir, rawCwd);
      } else {
        cwd = gatewayWorkingDir;
      }

      const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : 20_000;
      const maxStdoutBytes =
        typeof params.maxStdoutBytes === "number" ? params.maxStdoutBytes : 512_000;

      const argv = (() => {
        if (action === "run") {
          const pipeline = typeof params.pipeline === "string" ? params.pipeline : "";
          if (!pipeline.trim()) throw new Error("pipeline required");
          const argv = ["run", "--mode", "tool", pipeline];
          const argsJson = typeof params.argsJson === "string" ? params.argsJson : "";
          if (argsJson.trim()) {
            argv.push("--args-json", argsJson);
          }
          return argv;
        }
        if (action === "resume") {
          const token = typeof params.token === "string" ? params.token : "";
          if (!token.trim()) throw new Error("token required");
          const approve = params.approve;
          if (typeof approve !== "boolean") throw new Error("approve required");
          return ["resume", "--token", token, "--approve", approve ? "yes" : "no"];
        }
        throw new Error(`Unknown action: ${action}`);
      })();

      if (api.runtime?.version && api.logger?.debug) {
        api.logger.debug(`lobster plugin runtime=${api.runtime.version}`);
      }

      const { stdout } = await runLobsterSubprocess({
        execPath,
        argv,
        cwd,
        timeoutMs,
        maxStdoutBytes,
      });

      const envelope = parseEnvelope(stdout);

      return {
        content: [{ type: "text" as const, text: JSON.stringify(envelope, null, 2) }],
        details: envelope,
      };
    },
  };
}
