import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { danger, shouldLogVerbose } from "../globals.js";
import { logDebug, logError } from "../logger.js";
import { resolveCommandStdio } from "./spawn-utils.js";

const execFileAsync = promisify(execFile);

/**
 * Sensitive directories that should not be used as cwd.
 * OpenClawCN: block access to sensitive system directories.
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
 * Validate environment variables to prevent injection attacks.
 * Blocks dangerous environment variables that could lead to code execution.
 *
 * @param env - Environment variables object to validate
 */
export function validateEnvVars(env: Record<string, string | undefined> | undefined): void {
  if (!env) {
    return;
  }

  // Dangerous environment variables that can lead to code execution
  const DANGEROUS_ENV_VARS = new Set([
    "NODE_OPTIONS", // Can load arbitrary modules
    "LD_PRELOAD", // Linux library injection
    "LD_LIBRARY_PATH", // Can hijack shared libraries
    "DYLD_INSERT_LIBRARIES", // macOS library injection
    "DYLD_LIBRARY_PATH", // macOS library path hijacking
    "PERL5LIB", // Perl module injection
    "PYTHONPATH", // Python module injection
    "RUBYLIB", // Ruby library injection
  ]);

  // Validate each environment variable
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      continue;
    }

    // Block dangerous variables
    if (DANGEROUS_ENV_VARS.has(key)) {
      throw new Error(
        `SECURITY: Forbidden environment variable: ${key}\n` +
          `This variable can be used for code injection attacks.\n` +
          `If you need to set this variable, please use a controlled wrapper.`,
      );
    }

    // Validate value length (prevent buffer overflow attacks)
    if (value.length > 10000) {
      throw new Error(
        `SECURITY: Environment variable ${key} exceeds maximum length (10000 characters)`,
      );
    }

    // Check for suspicious patterns in values
    const suspiciousPatterns = [
      /[;&|`$()]/, // Shell metacharacters
      /\x00/, // Null byte injection
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(value)) {
        throw new Error(
          `SECURITY: Suspicious pattern detected in environment variable ${key}\n` +
            `Value contains potentially dangerous characters: ${value.substring(0, 100)}`,
        );
      }
    }
  }
}

/**
 * Validate cwd path to prevent path traversal and access to sensitive directories.
 * OpenClawCN: path injection protection.
 *
 * @param cwd - The working directory path to validate (undefined is allowed and skips validation)
 * @param baseDir - Optional base directory; if provided, cwd must be within it
 */
export function validateCwdPath(cwd: string | undefined, baseDir?: string): void {
  if (cwd === undefined) {
    return;
  }

  // Normalize the path to resolve any . or .. components
  const normalizedCwd = path.resolve(cwd);

  // If baseDir is specified, verify path is within it
  if (baseDir !== undefined) {
    const normalizedBase = path.resolve(baseDir);
    if (!normalizedCwd.startsWith(normalizedBase + path.sep) && normalizedCwd !== normalizedBase) {
      throw new Error(
        `Blocked cwd: path traversal detected - path is outside base directory: ${cwd}`,
      );
    }
  }

  // Check against blocked patterns
  for (const pattern of BLOCKED_CWD_PATTERNS) {
    if (pattern.test(normalizedCwd)) {
      throw new Error(`Blocked cwd: access to system directory not allowed: ${cwd}`);
    }
  }

  // Verify the directory exists and is a directory
  try {
    const stat = fs.statSync(normalizedCwd);
    if (!stat.isDirectory()) {
      throw new Error(`Invalid cwd: ${cwd} is not a directory`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Invalid cwd: directory does not exist: ${cwd}`);
    }
    // Re-throw our own errors (e.g., "not a directory")
    if (err instanceof Error && err.message.startsWith("Invalid cwd:")) {
      throw err;
    }
    throw err;
  }
}

/**
 * Resolves a command for Windows compatibility.
 * On Windows, non-.exe commands (like npm, pnpm) require their .cmd extension.
 */
function resolveCommand(command: string): string {
  if (process.platform !== "win32") {
    return command;
  }
  const basename = path.basename(command).toLowerCase();
  // Skip if already has an extension (.cmd, .exe, .bat, etc.)
  const ext = path.extname(basename);
  if (ext) {
    return command;
  }
  // Common npm-related commands that need .cmd extension on Windows
  const cmdCommands = ["npm", "pnpm", "yarn", "npx"];
  if (cmdCommands.includes(basename)) {
    return `${command}.cmd`;
  }
  return command;
}

export function shouldSpawnWithShell(params: {
  resolvedCommand: string;
  platform: NodeJS.Platform;
}): boolean {
  // SECURITY: never enable `shell` for argv-based execution.
  // `shell` routes through cmd.exe on Windows, which turns untrusted argv values
  // (like chat prompts passed as CLI args) into command-injection primitives.
  // If you need a shell, use an explicit shell-wrapper argv (e.g. `cmd.exe /c ...`)
  // and validate/escape at the call site.
  void params;
  return false;
}

// Simple promise-wrapped execFile with optional verbosity logging.
export async function runExec(
  command: string,
  args: string[],
  opts: number | { timeoutMs?: number; maxBuffer?: number } = 10_000,
): Promise<{ stdout: string; stderr: string }> {
  const options =
    typeof opts === "number"
      ? { timeout: opts, encoding: "utf8" as const }
      : {
          timeout: opts.timeoutMs,
          maxBuffer: opts.maxBuffer,
          encoding: "utf8" as const,
        };
  try {
    const resolved = resolveCommand(command);
    // Node.js v24+ on Windows: execFile() rejects .cmd/.bat with EINVAL.
    // Use cmd.exe /c wrapper (same approach as runCommandWithTimeout).
    const execCmd = process.platform === "win32" && /\.cmd$/i.test(resolved) ? "cmd.exe" : resolved;
    const execArgs = execCmd === "cmd.exe" ? ["/c", resolved, ...args] : args;
    const { stdout, stderr } = await execFileAsync(execCmd, execArgs, options);
    if (shouldLogVerbose()) {
      if (stdout.trim()) {
        logDebug(stdout.trim());
      }
      if (stderr.trim()) {
        logError(stderr.trim());
      }
    }
    return { stdout, stderr };
  } catch (err) {
    if (shouldLogVerbose()) {
      logError(danger(`Command failed: ${command} ${args.join(" ")}`));
    }
    throw err;
  }
}

export type SpawnResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  killed: boolean;
};

export type CommandOptions = {
  timeoutMs: number;
  cwd?: string;
  input?: string;
  env?: NodeJS.ProcessEnv;
  windowsVerbatimArguments?: boolean;
  /** Skip cwd validation for trusted internal calls. */
  skipCwdValidation?: boolean;
  /** If set, cwd must be within this base directory. */
  cwdBaseDir?: string;
};

export async function runCommandWithTimeout(
  argv: string[],
  optionsOrTimeout: number | CommandOptions,
): Promise<SpawnResult> {
  const options: CommandOptions =
    typeof optionsOrTimeout === "number" ? { timeoutMs: optionsOrTimeout } : optionsOrTimeout;
  const { timeoutMs, cwd, input, env } = options;
  const { windowsVerbatimArguments, skipCwdValidation, cwdBaseDir } = options;
  const hasInput = input !== undefined;

  // OpenClawCN: validate cwd unless explicitly skipped
  if (!skipCwdValidation) {
    validateCwdPath(cwd, cwdBaseDir);
  }

  // SECURITY: validate environment variables for injection attempts
  validateEnvVars(env);

  const shouldSuppressNpmFund = (() => {
    const cmd = path.basename(argv[0] ?? "");
    if (cmd === "npm" || cmd === "npm.cmd" || cmd === "npm.exe") {
      return true;
    }
    if (cmd === "node" || cmd === "node.exe") {
      const script = argv[1] ?? "";
      return script.includes("npm-cli.js");
    }
    return false;
  })();

  const mergedEnv = env ? { ...process.env, ...env } : { ...process.env };
  const resolvedEnv = Object.fromEntries(
    Object.entries(mergedEnv)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  if (shouldSuppressNpmFund) {
    if (resolvedEnv.NPM_CONFIG_FUND == null) {
      resolvedEnv.NPM_CONFIG_FUND = "false";
    }
    if (resolvedEnv.npm_config_fund == null) {
      resolvedEnv.npm_config_fund = "false";
    }
  }

  const stdio = resolveCommandStdio({ hasInput, preferInherit: true });
  const resolvedCommand = resolveCommand(argv[0] ?? "");

  // Node.js v24+ on Windows: spawn() rejects .cmd/.bat files with EINVAL
  // because they are batch scripts, not PE executables.
  // Wrap via `cmd.exe /c` instead of `shell: true` to avoid command-injection.
  let spawnCmd = resolvedCommand;
  let spawnArgs = argv.slice(1);
  if (process.platform === "win32" && /\.cmd$/i.test(resolvedCommand)) {
    spawnArgs = ["/c", resolvedCommand, ...spawnArgs];
    spawnCmd = "cmd.exe";
  }

  const child = spawn(spawnCmd, spawnArgs, {
    stdio,
    cwd,
    env: resolvedEnv,
    windowsVerbatimArguments,
    ...(shouldSpawnWithShell({ resolvedCommand, platform: process.platform })
      ? { shell: true }
      : {}),
  });
  // Spawn with inherited stdin (TTY) so tools like `pi` stay interactive when needed.
  return await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let killed = false;
    const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB limit to prevent memory exhaustion

    const timer = setTimeout(() => {
      if (typeof child.kill === "function" && !killed) {
        killed = true;
        // Try graceful SIGTERM first, then SIGKILL
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!settled && typeof child.kill === "function") {
            child.kill("SIGKILL");
          }
        }, 2000); // 2s grace period
      }
    }, timeoutMs);

    if (hasInput && child.stdin) {
      child.stdin.write(input ?? "");
      child.stdin.end();
    }

    child.stdout?.on("data", (d) => {
      const chunk = d.toString();
      if (stdout.length + chunk.length > MAX_OUTPUT_SIZE) {
        if (!killed && !settled) {
          killed = true;
          settled = true;
          clearTimeout(timer);
          child.kill("SIGKILL");
          reject(
            new Error(
              `Process output exceeded maximum size (${MAX_OUTPUT_SIZE} bytes). stdout: ${stdout.length} bytes, stderr: ${stderr.length} bytes`,
            ),
          );
        }
        return;
      }
      stdout += chunk;
    });
    child.stderr?.on("data", (d) => {
      const chunk = d.toString();
      if (stderr.length + chunk.length > MAX_OUTPUT_SIZE) {
        if (!killed && !settled) {
          killed = true;
          settled = true;
          clearTimeout(timer);
          child.kill("SIGKILL");
          reject(
            new Error(
              `Process output exceeded maximum size (${MAX_OUTPUT_SIZE} bytes). stdout: ${stdout.length} bytes, stderr: ${stderr.length} bytes`,
            ),
          );
        }
        return;
      }
      stderr += chunk;
    });
    child.on("error", (err) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code, signal, killed: child.killed });
    });
  });
}
