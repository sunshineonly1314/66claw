import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { danger, shouldLogVerbose } from "../globals.js";
import { logDebug, logError } from "../logger.js";
import { resolveCommandStdio } from "./spawn-utils.js";

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
 * 
 * @param cwd - The working directory path to validate
 * @param baseDir - Optional base directory to restrict cwd within
 * @throws Error if cwd is invalid or potentially dangerous
 */
export function validateCwdPath(cwd: string | undefined, baseDir?: string): void {
  if (!cwd) return;

  // Normalize the path to resolve any . or .. components
  const normalizedCwd = path.resolve(cwd);

  // Check against blocked patterns
  for (const pattern of BLOCKED_CWD_PATTERNS) {
    if (pattern.test(normalizedCwd)) {
      throw new Error(`Blocked cwd: access to system directory not allowed: ${cwd}`);
    }
  }

  // If baseDir is provided, ensure cwd is within it
  if (baseDir) {
    const normalizedBase = path.resolve(baseDir);
    // Ensure cwd starts with baseDir (prevent escape via ..)
    if (!normalizedCwd.startsWith(normalizedBase)) {
      throw new Error(`Blocked cwd: path traversal detected, cwd must be within ${baseDir}`);
    }
  }

  // Verify the directory exists (optional, but good practice)
  // Only check if cwd looks like an absolute path to avoid false positives
  if (path.isAbsolute(normalizedCwd)) {
    try {
      const stat = fs.statSync(normalizedCwd);
      if (!stat.isDirectory()) {
        throw new Error(`Invalid cwd: ${cwd} is not a directory`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Invalid cwd: directory does not exist: ${cwd}`);
      }
      // Re-throw other errors (permission denied, etc.)
      throw err;
    }
  }
}

const execFileAsync = promisify(execFile);

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
    const { stdout, stderr } = await execFileAsync(command, args, options);
    if (shouldLogVerbose()) {
      if (stdout.trim()) logDebug(stdout.trim());
      if (stderr.trim()) logError(stderr.trim());
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
  /**
   * Skip cwd validation. Use with caution - only for trusted internal calls.
   * ClawdbotCN: 跳过 cwd 验证，仅用于可信的内部调用
   */
  skipCwdValidation?: boolean;
  /**
   * Base directory to restrict cwd within. If provided, cwd must be within this directory.
   * ClawdbotCN: 限制 cwd 必须在此目录内
   */
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

  // ClawdbotCN 专属：cwd 路径验证 - 防止路径遍历攻击
  if (!skipCwdValidation && cwd) {
    validateCwdPath(cwd, cwdBaseDir);
  }

  const shouldSuppressNpmFund = (() => {
    const cmd = path.basename(argv[0] ?? "");
    if (cmd === "npm" || cmd === "npm.cmd" || cmd === "npm.exe") return true;
    if (cmd === "node" || cmd === "node.exe") {
      const script = argv[1] ?? "";
      return script.includes("npm-cli.js");
    }
    return false;
  })();

  const resolvedEnv = env ? { ...process.env, ...env } : { ...process.env };
  if (shouldSuppressNpmFund) {
    if (resolvedEnv.NPM_CONFIG_FUND == null) resolvedEnv.NPM_CONFIG_FUND = "false";
    if (resolvedEnv.npm_config_fund == null) resolvedEnv.npm_config_fund = "false";
    // ClawdbotCN 专属：禁用 npm 的 progress/spinner 输出
    // 避免在非 TTY 环境下产生乱码字符（如 ◆◆◆）
    if (resolvedEnv.NPM_CONFIG_PROGRESS == null) resolvedEnv.NPM_CONFIG_PROGRESS = "false";
    if (resolvedEnv.NPM_CONFIG_SPIN == null) resolvedEnv.NPM_CONFIG_SPIN = "false";
    // 设置日志级别为 error，减少无关输出
    if (resolvedEnv.NPM_CONFIG_LOGLEVEL == null) resolvedEnv.NPM_CONFIG_LOGLEVEL = "error";
  }

  const stdio = resolveCommandStdio({ hasInput, preferInherit: true });
  
  // ClawdbotCN 专属：Windows 上执行 .cmd/.bat 文件需要使用 shell
  const isWindows = process.platform === "win32";
  const cmdPath = argv[0] ?? "";
  const needsShell = isWindows && (
    cmdPath.toLowerCase().endsWith(".cmd") ||
    cmdPath.toLowerCase().endsWith(".bat")
  );
  
  const child = spawn(argv[0], argv.slice(1), {
    stdio,
    cwd,
    env: resolvedEnv,
    windowsVerbatimArguments,
    shell: needsShell,
  });
  // Spawn with inherited stdin (TTY) so tools like `pi` stay interactive when needed.
  return await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (typeof child.kill === "function") {
        child.kill("SIGKILL");
      }
    }, timeoutMs);

    if (hasInput && child.stdin) {
      child.stdin.write(input ?? "");
      child.stdin.end();
    }

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code, signal, killed: child.killed });
    });
  });
}
